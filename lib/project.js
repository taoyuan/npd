"use strict";

var glob = require('glob');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var mout = require('mout');
var ep = require('./ep');
var Logger = require('./logger');
var Manager = require('./manager');
var noapconf = require('./noapconf');
var semver = require('./utils/semver');
var md5 = require('./utils/md5');
var errors = require('./errors');
var utils = require('./utils');
//var validLink = require('../util/validLink');
var scripts = require('./scripts');
var Repository = require('./repository');

function Project(config, logger) {
    // This is the only architecture component that ensures defaults
    // on config and logger
    // The reason behind it is that users can likely use this component
    // directly if commands do not fulfil their needs
    this._config = noapconf(config).load();
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
            return that._manager.postinstall().then(function () {
                return installed;
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
    var componentsDir;
    var that = this;

    if (this._installed) {
        return when.resolve(this._installed);
    }

    // Gather all folders that are actual packages by
    // looking for the package metadata file
    componentsDir = path.resolve(this._config.repo);
    return this._installed = nfn.call(glob, '*/.package.json', {
        cwd: componentsDir,
        dot: true
    })
        .then(function (filenames) {
            var promises;
            var endpoints = {};

            // Foreach package.json found
            promises = filenames.map(function (filename) {
                var name = path.dirname(filename);
                var metaFile = path.join(componentsDir, filename);

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

module.exports = Project;
