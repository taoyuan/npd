"use strict";

var glob = require('glob');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var sequence = require('when/sequence');
var mout = require('mout');
var Logger = require('./logger');
var Manager = require('./manager');
var npdconf = require('./npdconf');
var md5 = require('./utils/md5');
var errors = require('./errors');
var utils = require('./utils');
var scripts = require('./scripts');
var Repository = require('./repository');
var npm = require('./npm');
var links = require('./utils/links');

module.exports = Project;

function Project(config, logger) {
    // This is the only architecture component that ensures defaults
    // on config and logger
    // The reason behind it is that users can likely use this component
    // directly if commands do not fulfil their needs
    this._config = npdconf(config);
    this._logger = logger || new Logger();
    this._manager = new Manager(this._config, this._logger);
}

// -----------------

Project.prototype.install = function (endpoints, config) {
    var that = this;
    var targets = [];
    var resolved = {};
    var incompatibles = [];

    // If already working, error out
    if (this._working) {
        return when.reject(errors.create('Already working', 'EWORKING'));
    }

    this._config = config || {};
    this._working = true;

    var repodir = path.resolve(this._config.dir);
    // Analyse the project
    return this._analyse()
        .then(function (installed) {
            mout.object.forOwn(installed, function (endpoint) {
                targets.push(endpoint);
            });

            // Add decomposed endpoints as targets
            endpoints = endpoints || [];
            endpoints.forEach(function (endpoint) {
                // Mark as new so that a conflict for this target
                // always require a choice
                // Also allows for the target to be converted in case
                // of being *
                endpoint.newly = true;
                targets.push(endpoint);
            });

            // Bootstrap the process
            return that._bootstrap(targets, resolved, incompatibles);
        })
        .then(function () {
            return that._manager.preinstall();
        })
        .then(function () {
            return that._manager.install();
        })
        .then(function (installed) {
            // handle npm install
            var promises = [];
            mout.object.forOwn(installed, function (pkg, name) {
                promises.push(npm.install(path.resolve(repodir, name)).then(function (result) {
                    return that._linkBins(pkg.pkgMeta, pkg.canonicalDir, repodir, that._config.global);
                }));
            });

            return when.all(promises).then(function () {
                return that._manager.postinstall().then(function () {
                    return installed;
                });
            });
        })
        .finally(function () {
            Repository.clearRuntimeCache();
            that._installed = null;
            that._working = false;
        });
};

Project.prototype.update = function (names, config) {
    var that = this;
    var targets = [];
    var resolved = {};
    var incompatibles = [];

    // If already working, error out
    if (this._working) {
        return when.reject(errors.create('Already working', 'EWORKING'));
    }

    this._config = config || {};
    this._working = true;

    // Analyse the project
    return this._analyse()
        .then(function (installed) {
            // If no names were specified, update every package
            if (!names) {
                // Mark each installed as targets
                mout.object.forOwn(installed, function (endpoint) {
                    targets.push(endpoint);
                });
                // Otherwise, selectively update the specified ones
            } else {
                // Error out if some of the specified names
                // are not installed
                names.forEach(function (name) {
                    if (!installed[name]) {
                        throw errors.create('Package ' + name + ' is not installed', 'ENOTINS', {
                            name: name
                        });
                    }
                });

                // Add packages whose names are specified to be updated
                mout.object.forOwn(installed, function (endpoint, name) {
                    if (names.indexOf(name) !== -1) {
                        // We don't know the real source of linked packages
                        // Instead we read its dependencies

                        targets.push(endpoint);

                        return false;
                    }
                }, true);

            }

            // Bootstrap the process
            return that._bootstrap(targets, resolved, incompatibles)
                .then(function () {
                    return that._manager.preinstall();
                })
                .then(function () {
                    return that._manager.install();
                })
                .then(function (installed) {
                    // Save JSON, might contain changes to resolutions
                    return that._manager.postinstall(that._json).then(function () {
                        return installed;
                    });
                });
        })
        .finally(function () {
            Repository.clearRuntimeCache();
            that._installed = null;
            that._working = false;
        });
};

Project.prototype.uninstall = function (names, config) {
    var that = this;
    var packages = {};

    // If already working, error out
    if (this._working) {
        return when.reject(errors.create('Already working', 'EWORKING'));
    }

    this._config = config || {};
    this._working = true;

    // Analyse the project
    return this._analyse()
        // Fill in the packages to be uninstalled
        .then(function (flattened) {
            names.forEach(function (name) {
                var endpoint = flattened[name];

                // Check if it is not installed
                if (!endpoint || endpoint.missing) {
                    packages[name] = null;
                    return;
                }

                packages[name] = endpoint.canonicalDir;
            });
        })
        // Remove packages
        .then(function () {
            return that._removePackages(packages);
        })
        .finally(function () {
            that._installed = null;
            that._working = false;
        });
};

Project.prototype.getManager = function () {
    return this._manager;
};

Project.prototype.getRepository = function () {
    return this._manager.getRepository();
};

// -----------------

Project.prototype._analyse = function () {
    return this._readInstalled();
};

Project.prototype._bootstrap = function (targets, resolved) {
    var installed = mout.object.map(this._installed, function (endpoint) {
        return endpoint.pkgMeta;
    });

    // Configure the manager and kick in the resolve process
    return this._manager
        .configure({
            targets: targets,
            resolved: resolved,
            installed: installed,
            forceLatest: this._config.forceLatest
        })
        .resolve();
};

Project.prototype._readInstalled = function () {
    var repodir;
    var that = this;

    if (this._installed) {
        return when.resolve(this._installed);
    }

    // Gather all folders that are actual packages by
    // looking for the package metadata file
    repodir = path.resolve(this._config.dir);
    return this._installed = nfn.call(glob, '*/.package.json', {
        cwd: repodir,
        dot: true
    })
        .then(function (filenames) {
            var promises;
            var endpoints = {};

            // Foreach package.json found
            promises = filenames.map(function (filename) {
                var name = path.dirname(filename);
                var metaFile = path.join(repodir, filename);

                // Read package metadata
                return utils.readJson(metaFile)
                    .then(function (pkgMeta) {
                        endpoints[name] = {
                            name: name,
                            source: pkgMeta._originalSource || pkgMeta._source,
                            target: pkgMeta._target,
                            canonicalDir: path.dirname(metaFile),
                            pkgMeta: pkgMeta
                        };
                    });
            });

            // Wait until all files have been read
            // and resolve with the decomposed endpoints
            return when.all(promises)
                .then(function () {
                    return that._installed = endpoints;
                });
        });
};

Project.prototype._removePackages = function (packages) {
    var that = this;
    var promises = [];

    return scripts.preuninstall(that._config, that._logger, packages, that._installed)
        .then(function () {

            mout.object.forOwn(packages, function (dir, name) {
                var promise;

                // Delete directory
                if (!dir) {
                    promise = when.resolve();
                    that._logger.warn('not-installed', '\'' + name + '\'' + ' cannot be uninstalled as it is not currently installed', {
                        name: name
                    });
                } else {
                    promise = nfn.call(fs.remove, dir);
                    that._logger.action('uninstall', name, {
                        name: name,
                        dir: dir
                    });
                }

                promises.push(promise);
            });

            return when.all(promises);

        })
        // Resolve with removed packages
        .then(function () {
            return mout.object.filter(packages, function (dir) {
                return !!dir;
            });
        });
};

Project.prototype._linkBins = function linkBins(pkg, folder, parent, top) {
    if (!pkg.bin) return when.resolve();

    var c = this._config;
    var binRoot = c.bin;
//    log.verbose("link bins", [pkg.bin, binRoot, gtop])

    var promises = [];
    mout.object.forOwn(pkg.bin, function (bin, name) {
        promises.push(linkBin(path.resolve(folder, bin), path.resolve(binRoot, name)).then(function () {
            var src = path.resolve(folder, bin);
            return nfn.call(fs.chmod, src, npm.modes.exec).then(function () {
                if (!top) return;
                var dest = path.resolve(binRoot, name),
                    out = npm.config.get("parseable") ? dest + "::" + src + ":BINFILE" : dest + " -> " + src;
                console.log(out)
            }).catch(function (er) {
                if (er.code === "ENOENT" && npm.config.get("ignore-scripts")) {
                    return null;
                }
                throw er;
            });
        }));
    });
    return when.all(promises);
};

function linkBin(from, to) {
    if (process.platform !== "win32") {
        return links.linkIfExists(from, to)
    } else {
//        return cmdShimIfExists(from, to)
    }
}

Project.prototype._rmBins = function rmBins (pkg, folder, parent, top) {
    if (!pkg.bin) return when.resolve();

    var binRoot = top ? npm.bin : path.resolve(parent, ".bin");
//    log.verbose([binRoot, pkg.bin], "binRoot");

    var promises = [], promise;
    mout.object.forOwn(pkg.bin, function (bin, name) {
        if (process.platform === "win32") {
            promise = sequence([
                nfn.lift(fs.remove, path.resolve(binRoot, name) + ".cmd"),
                nfn.lift(fs.remove, path.resolve(binRoot, name)),
            ]);
        } else {
            promise = nfn.call(fs.remove, path.resolve(binRoot, name));
        }
        promises.push(promise);
    });

    return when.all(promises);
};
