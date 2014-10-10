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
        .spread(function (json, tree, flattened) {
            var promise = when.resolve();

            names.forEach(function (name) {
                var endpoint = flattened[name];

                // Check if it is not installed
                if (!endpoint || endpoint.missing) {
                    packages[name] = null;
                    return;
                }

                promise = promise
                    .then(function () {
                        var message;
                        var data;
                        var dependantsNames;
                        var dependants = [];

                        // Walk the down the tree, gathering dependants of the package
                        that.walkTree(tree, function (node, nodeName) {
                            if (name === nodeName) {
                                dependants.push.apply(dependants, mout.object.values(node.dependants));
                            }
                        }, true);

                        // Remove duplicates
                        dependants = mout.array.unique(dependants);

                        // Note that the root is filtered from the dependants
                        // as well as other dependants marked to be uninstalled
                        dependants = dependants.filter(function (dependant) {
                            return !dependant.root && names.indexOf(dependant.name) === -1;
                        });

                        // If the package has no dependants or the force config is enabled,
                        // mark it to be removed
                        if (!dependants.length || that._config.force) {
                            packages[name] = endpoint.canonicalDir;
                            return;
                        }

                        // Otherwise we need to figure it out if the user really wants to remove it,
                        // even with dependants
                        // As such we need to prompt the user with a meaningful message
                        dependantsNames = dependants.map(function (dep) {
                            return dep.name;
                        });
                        dependantsNames.sort(function (name1, name2) {
                            return name1.localeCompare(name2);
                        });
                        dependantsNames = mout.array.unique(dependantsNames);
                        dependants = dependants.map(function (dependant) {
                            return that._manager.toData(dependant);
                        });
                        message = dependantsNames.join(', ') + ' depends on ' + endpoint.name;
                        data = {
                            name: endpoint.name,
                            dependants: dependants
                        };

                        // If interactive is disabled, error out
                        if (!that._config.interactive) {
                            throw errors.create(message, 'ECONFLICT', {
                                data: data
                            });
                        }

                        that._logger.conflict('mutual', message, data);

                        // Prompt the user
                        return nfn.call(that._logger.prompt.bind(that._logger), {
                            type: 'confirm',
                            message: 'Continue anyway?',
                            default: true
                        })
                            .then(function (confirmed) {
                                // If the user decided to skip it, remove from the array so that it won't
                                // influence subsequent dependants
                                if (!confirmed) {
                                    mout.array.remove(names, name);
                                } else {
                                    packages[name] = endpoint.canonicalDir;
                                }
                            });
                    });
            });

            return promise;
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

Project.prototype.getTree = function (config) {
    this._config = config || {};

    return this._analyse()
        .spread(function (json, tree, flattened) {
            var extraneous = [];
            var additionalKeys = ['missing', 'extraneous', 'different', 'linked'];

            // Convert tree
            tree = this._manager.toData(tree, additionalKeys);

            // Mark incompatibles
            this.walkTree(tree, function (node) {
                var version;
                var target = node.endpoint.target;

                if (node.pkgMeta && semver.validRange(target)) {
                    version = node.pkgMeta.version;

                    // Ignore if target is '*' and resolved to a non-semver release
                    if (!version && target === '*') {
                        return;
                    }

                    if (!version || !semver.satisfies(version, target)) {
                        node.incompatible = true;
                    }
                }
            }, true);

            // Convert extraneous
            mout.object.forOwn(flattened, function (pkg) {
                if (pkg.extraneous) {
                    extraneous.push(this._manager.toData(pkg, additionalKeys));
                }
            }, this);

            // Convert flattened
            flattened = mout.object.map(flattened, function (node) {
                return this._manager.toData(node, additionalKeys);
            }, this);

            return [tree, flattened, extraneous];
        }.bind(this));
};

Project.prototype.walkTree = function (node, fn, onlyOnce) {
    var result;
    var dependencies;
    var queue = mout.object.values(node.dependencies);

    if (onlyOnce === true) {
        onlyOnce = [];
    }

    while (queue.length) {
        node = queue.shift();
        result = fn(node, node.endpoint ? node.endpoint.name : node.name);

        // Abort traversal if result is false
        if (result === false) {
            continue;
        }

        // Add dependencies to the queue
        dependencies = mout.object.values(node.dependencies);

        // If onlyOnce was true, do not add if already traversed
        if (onlyOnce) {
            dependencies = dependencies.filter(function (dependency) {
                return !mout.array.find(onlyOnce, function (stacked) {
                    if (dependency.endpoint) {
                        return mout.object.equals(dependency.endpoint, stacked.endpoint);
                    }

                    return dependency.name === stacked.name &&
                        dependency.source === stacked.source &&
                        dependency.target === stacked.target;
                });
            });

            onlyOnce.push.apply(onlyOnce, dependencies);
        }

        queue.unshift.apply(queue, dependencies);
    }
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

Project.prototype._bootstrap = function (targets, resolved, incompatibles) {
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

Project.prototype._restoreNode = function (node, flattened, jsonKey, processed) {
    var deps;

    // Do not restore if the node is missing
    if (node.missing) {
        return;
    }

    node.dependencies = node.dependencies || {};
    node.dependants = node.dependants || {};
    processed = processed || {};

    // Only process deps that are not yet processed
    deps = mout.object.filter(node.pkgMeta[jsonKey], function (value, key) {
        return !processed[node.name + ':' + key];
    });

    mout.object.forOwn(deps, function (value, key) {
        var local = flattened[key];
        var json = ep.json2decomposed(key, value);
        var restored;
        var compatible;
        var originalSource;

        // Check if the dependency is not installed
        if (!local) {
            flattened[key] = restored = json;
            restored.missing = true;
            // Even if it is installed, check if it's compatible
            // Note that linked packages are interpreted as compatible
            // This might change in the future: #673
        } else {
            compatible = local.linked || (!local.missing && json.target === local.pkgMeta._target);

            if (!compatible) {
                restored = json;

                if (!local.missing) {
                    restored.pkgMeta = local.pkgMeta;
                    restored.canonicalDir = local.canonicalDir;
                    restored.incompatible = true;
                } else {
                    restored.missing = true;
                }
            } else {
                restored = local;
                mout.object.mixIn(local, json);
            }

            // Check if source changed, marking as different if it did
            // We only do this for direct root dependencies that are compatible
            if (node.root && compatible) {
                originalSource = mout.object.get(local, 'pkgMeta._originalSource');
                if (originalSource && originalSource !== json.source) {
                    restored.different = true;
                }
            }
        }

        // Cross reference
        node.dependencies[key] = restored;
        processed[node.name + ':' + key] = true;

        restored.dependants = restored.dependants || {};
        restored.dependants[node.name] = mout.object.mixIn({}, node);  // We need to clone due to shared objects in the manager!

        // Call restore for this dependency
        this._restoreNode(restored, flattened, 'dependencies', processed);

        // Do the same for the incompatible local package
        if (local && restored !== local) {
            this._restoreNode(local, flattened, 'dependencies', processed);
        }
    }, this);
};

module.exports = Project;
