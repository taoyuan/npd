"use strict";

var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var mout = require('mout');
var path = require('path');
var fs = require('fs-extra');

var Promise = require('bluebird');
var glob = Promise.promisify(require('glob'));

var logger = require('./logs').logger;
var utils = require('./utils');
var copy = require('./utils/copy');
var errors = require('./errors');
var mdu = require('./mdu');

var Repository = require('./repository');

function Dissector(config) {
    this._config = config;
    this._repository = new Repository(this._config, logger);
}

Dissector.prototype.resolve = function (targets) {
    // If already resolving, error out
    if (this._working) {
        return when.reject(errors.create('Already working', 'EWORKING'));
    }

    var that = this;

    // Reset stuff
    this._resolved = [];
    this._fetching = {};
    this._nrFetching = 0;
    this._failed = {};
    this._hasFailed = false;
    this._deferred = when.defer();

    // If there's nothing to resolve, simply dissect
    if (!targets.length) {
        process.nextTick(this._dissect.bind(this));
        // Otherwise, fetch each target from the repository
        // and let the process roll out
    } else {
        targets.forEach(this._fetch.bind(this));
    }

    // Unset working flag when done
    return this._deferred.promise.finally(function () {
        that._working = false;
    });
};

Dissector.prototype.getRepository = function () {
    return this._repository;
};

// -----------------

Dissector.prototype._fetch = function (endpoint) {
    var name = endpoint.name;

    // Check if the whole process started to catch fast
    if (this._hasFailed) {
        return;
    }

    // Mark as being fetched
    this._fetching[name] = this._fetching[name] || [];
    this._fetching[name].push(endpoint);
    this._nrFetching++;

    // Fetch it from the repository
    // Note that the promise is stored in the decomposed endpoint
    // because it might be reused if a similar endpoint needs to be resolved
    return endpoint.promise = this._repository.fetch(endpoint)
        // When done, call onFetchSuccess
        .spread(this._onFetchSuccess.bind(this, endpoint))
        // If it fails, call onFetchFailure
        .catch(this._onFetchError.bind(this, endpoint));
};

Dissector.prototype._onFetchSuccess = function (endpoint, canonicalDir, pkgmeta, isTargetable) {
    var name;
    var initialName = endpoint.initialName != null ? endpoint.initialName : endpoint.name;
    var fetching = this._fetching[initialName];

    // Remove from being fetched list
    mout.array.remove(fetching, endpoint);
    this._nrFetching--;

    // Store some needed stuff
    endpoint.name = name = endpoint.name || pkgmeta.name;
    endpoint.canonicalDir = canonicalDir;
    endpoint.pkgmeta = pkgmeta;
    delete endpoint.promise;

    this._resolved[name] = endpoint;

    // If the package is not targetable, flag it
    // It will be needed later so that untargetable endpoint
    // will not get * converted to ~version
    if (!isTargetable) {
        endpoint.untargetable = true;
    }

    // If there are no more packages being fetched,
    // finish the resolve process by dissecting all resolved packages
    if (this._nrFetching <= 0) {
        process.nextTick(this._dissect.bind(this));
    }
};

Dissector.prototype._onFetchError = function (endpoint, err) {
    var name = endpoint.name;

    err.data = err.data || {};
    err.data.endpoint = mout.object.pick(endpoint, ['name', 'source', 'target']);

    // Remove from being fetched list
    mout.array.remove(this._fetching[name], endpoint);
    this._nrFetching--;

    this._failed[name] = err;
    delete endpoint.promise;

    // Make the whole process to catch fast
    this._failFast();

    // If there are no more packages being fetched,
    // finish the resolve process (with an error)
    if (this._nrFetching <= 0) {
        process.nextTick(this._dissect.bind(this));
    }
};

Dissector.prototype._failFast = function () {
    if (this._hasFailed) {
        return;
    }

    this._hasFailed = true;

    // If after some amount of time all pending tasks haven't finished,
    // we force the process to end
    this._failFastTimeout = setTimeout(function () {
        this._nrFetching = Infinity;
        this._dissect();
    }.bind(this), 20000);
};

Dissector.prototype._dissect = function () {
    var err;
    //var dir = this._dir;
    var promise = when.resolve();
    var resolved = this._resolved;
    var that = this;

    // If something failed, reject the whole resolve promise
    // with the first error
    if (this._hasFailed) {
        clearTimeout(this._failFastTimeout); // Cancel catch fast timeout

        err = mout.object.values(this._failed)[0];
        this._deferred.reject(err);
        return;
    }

    _.forEach(resolved, function (endpoint) {
        if (endpoint.pkgmeta.version && !endpoint.installed && endpoint.target === '*' && !endpoint.untargetable) {
            endpoint.target = '^' + endpoint.pkgmeta.version;
            endpoint.originalTarget = '*';
        }
    });

    // After a suitable version has been elected for every package
    promise.then(function () {
        // Filter only packages that need to be installed
        return that._dissected = mout.object.filter(resolved, function (endpoint, name) {
            var installedMeta = endpoint.installed && endpoint.installed.pkgmeta;
            //var dst = path.join(dir, name);

            // Skip if source is the same as dst
            //if (dst === endpoint.canonicalDir) {
            //    return false;
            //}

            // Analyse a few props
            if (installedMeta &&
                installedMeta._target === endpoint.target &&
                installedMeta._originalSource === endpoint.source &&
                installedMeta._release === endpoint.pkgmeta._release
            ) {
                return that._config.force;
            }

            return true;
        }, that);
    }).then(this._deferred.resolve, this._deferred.reject);
};

// exports public methods
exports.readEndpoint = readEndpoint;
function readEndpoint(dir) {
    // Read package metadata
    return mdu.readJsons(dir, ['.package.json', 'package.json'], 'module.json')
        .spread(function (pkgmeta, modmeta) {
            return {
                name: pkgmeta && pkgmeta.name,
                source: pkgmeta && (pkgmeta._originalSource || pkgmeta._source),
                target: pkgmeta && pkgmeta._target,
                canonicalDir: dir,
                pkgmeta: pkgmeta,
                modmeta: modmeta
            };
        });
}

exports.readInstalled = readInstalled;
function readInstalled(dir) {
    var opts = {cwd: dir, dot: true};
    return glob('*/.package.json', opts)
        .then(function (filenames) {
            // Foreach package.json found
            return Promise.map(filenames, function (filename) {
                var name = path.dirname(filename);

                return readEndpoint(path.join(dir, name)).then(function (endpoint) {
                    endpoint.installed = {
                        pkgmeta: endpoint.pkgmeta,
                        modmeta: endpoint.modmeta
                    };
                    delete endpoint.pkgmeta;
                    delete endpoint.modmeta;
                });
            });
        })
        .then(function (endpoints) {
            var result = {};
            endpoints.forEach(function (endpoint) {
                result[endpoint.name] = endpoint;
            });
            return result;
        });
}

exports.toData = function (endpoint, extraKeys) {
    var extra;

    var data = {};

    data.endpoint = mout.object.pick(endpoint, ['name', 'source', 'target']);

    if (endpoint.canonicalDir) {
        data.canonicalDir = endpoint.canonicalDir;
        data.pkgmeta = endpoint.pkgmeta;
    }

    if (extraKeys) {
        extra = _.pick(endpoint, extraKeys);
        extra = _.filter(extra, function (value) {
            return !!value;
        });
        _.assign(data, extra);
    }

    return data;
};

exports.resolve = function (targets) {
    var dissector = new Dissector(require('./npd').config);
    return dissector.resolve(targets);
};

