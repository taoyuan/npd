"use strict";

var _ = require('lodash');
var path = require('path');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

var logger = require('../logs').logger;
var ep = require('../ep');
var npd = require('../npd');
var dissector = require('../dissector');
var lifecycle = require('../lifecycle');
var copy = require('../utils/copy');

var mdu = require('../mdu');

var build = require('./build');
var unbuild = require('./unbuild');

module.exports = install;
require('util');

function install(what) {
    var where;
    if (arguments.length === 2) {
        where = what;
        what = arguments[1];
    }

    where = where || path.resolve(npd.config.dir, '..');
    what = what || [];

    logger.verbose("install", "where, what", where, what);

    if (!npd.config.global) {
        what = what.filter(function (s) {
            return path.resolve(s) !== where
        })
    }

    var endpoints, context;

    return fs.mkdirpAsync(where).then(function () {
        var c = npd.config;
        // install modules locally by default, or install current folder globally
        if (!what.length) {
            if (c.global) {
                what = ['.'];
            } else return mdu.readModuleJson(where, {throw: true}).then(function (data) {
                var deps = Object.keys(data.extensions);
                logger.verbose("install", "where, what", where, deps);

                context = {
                    explicit: true,
                    parent: data,
                    root: true
                };

                endpoints = deps.map(function (dep) {
                    return ep.json2decomposed(dep, data.extensions[dep]);
                });

                return installManyTop(endpoints, where, context);
            });
        }

        endpoints = what.map(function (pkg) {
            return typeof pkg === 'string' ? ep.decompose(pkg) : pkg;
        });

        context = {
            explicit: true,
            parent: null,
            root: true,
            modsdir: c.global ? npd.config.dir : undefined
        };

        var fn = c.global ? installManyTop : installMany;
        return fn(endpoints, where, context);
    });

}

function installManyTop(endpoints, where, context) {
    function done(result) {
        if (context.explicit) return result;
        // since this wasn't an explicit install, let's build the top
        // folder, so that `npd install` also runs the lifecycle scripts.
        return build([where], false, true).then(function () {
            return result;
        });
    }

    if (context.explicit) return next();

    return mdu.requireModuleJson(context.parent, where).then(function (data) {
        return lifecycle.preinstall(data, where)
    }).then(next);

    function next() {
        return _installManyTop(endpoints, where, context).then(done);
    }
}

function _installManyTop(endpoints, where, context) {
    return installMany(endpoints, where, context);
}

function installMany(endpoints, where, context) {
    var parent, modsdir;

    return mdu.readMetas(where)
        .spread(function (modmeta, pkgmeta) {
            parent = modmeta;
            modsdir = context.modsdir
            || (modmeta && modmeta.directories && modmeta.directories.mods)
            || (pkgmeta && pkgmeta.directories && pkgmeta.directories.mods)
            || 'modules';
        })
        .then(function () {
            return dissector.readInstalled(path.resolve(where, modsdir));
        })
        .then(function (installed) {
            return dissector.resolve(endpoints).then(function (resolved) {
                _.forEach(resolved, function (endpoint) {
                    var local = installed[endpoint.name];
                    if (local) {
                        endpoint.installed = local.installed;
                    } else {
                        endpoint.missing = true; // TODO is this necessary ?
                    }
                });
                return resolved;
            });
        })
        .then(function () {
            return Promise.resolve(endpoints).each(function (endpoint) {
                var newContext = {
                    parent: parent,
                    modsdir: modsdir,
                    explicit: false
                };
                return installOne(endpoint, where, newContext);
            });
        });
}

function installOne(endpoint, where, context) {
    var modsdir = path.resolve(where, context.modsdir);
    var targetFolder = path.resolve(modsdir, endpoint.name);
    var name = endpoint.name;
    var parent = context.parent;

    var release = endpoint.pkgMeta._release;

    logger.action('install', name + (release ? '#' + release : ''), dissector.toData(endpoint));

    return unbuild([targetFolder], true)
        .then(function () {
            // copy target module from cache dir to target folder
            return copy.copyDir(endpoint.canonicalDir, targetFolder);
        })
        .then(function () {
            return mdu.readModuleJson(targetFolder);
        })
        .then(function (modMeta) {
            // update endpoint
            endpoint.canonicalDir = targetFolder;
            endpoint.modMeta = modMeta;

            // update target .package.json
            return write(endpoint, targetFolder);
        })
        .then(function () {
            lifecycle.preinstall(endpoint.modMeta, targetFolder);
        })
        .then(function () {
            // install target's extensions
            return mdu.readModuleJson(targetFolder)
                .then(function (data) {
                    if (!data) return;
                    var deps = Object.keys(data.extensions);
                    deps = deps.map(function (dep) {
                        return ep.json2decomposed(dep, data.extensions[dep]);
                    });
                    endpoint.extensions = deps;

                    var depsTargetFolder = targetFolder;
                    var depsContext = {
                        parent: endpoint.pkgMeta,
                        explicit: false
                    };
                    return installMany(deps, depsTargetFolder, depsContext);
                })
                .then(function () {
                    return build([targetFolder], npd.config.global, true);
                });
        })
        .then(function () {
            return endpoint;
        });
}

function write(endpoint, dir) {
    logger.verbose('write', endpoint.name, endpoint);
    var file = path.join(dir, '.package.json');
    return fs.readJsonAsync(file)
        .then(function (json) {
            json._target = endpoint.target;
            json._originalSource = endpoint.source;
            if (!endpoint.installed) {
                json._direct = true;
            }

            json = JSON.stringify(json, null, 2);
            return fs.writeFileAsync(file, json);
        });
}
