"use strict";

var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var mout = require('mout');
var path = require('path');
var fs = require('fs-extra');
var glob = require('glob');
var utils = require('./utils');
var copy = require('./utils/copy');
var errors = require('./errors');

var Repository = require('./Repository');

function Dissector(config, logger) {
    this._config = config;
    this._logger = logger;
    this._repository = new Repository(this._config, this._logger);
}

Dissector.prototype.readInstalled = function readInstalled() {
    var dir = path.resolve(this._config.dir);
    var opts = { cwd: dir, dot: true };
    return nfn.call(glob, '*/.package.json', opts).then(function (filenames) {
        var promises;
        var endpoints = {};

        // Foreach package.json found
        promises = filenames.map(function (filename) {
            var name = path.dirname(filename);
            var metaFile = path.join(dir, filename);

            // Read package metadata
            return utils.readJson(metaFile).then(function (pkgMeta) {
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
        return when.all(promises).then(function () {
            return endpoints;
        });
    });
};


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

Dissector.prototype.toData = function (endpoint, extraKeys) {
    var extra;

    var data = {};

    data.endpoint = mout.object.pick(endpoint, ['name', 'source', 'target']);

    if (endpoint.canonicalDir) {
        data.canonicalDir = endpoint.canonicalDir;
        data.pkgMeta = endpoint.pkgMeta;
    }

    if (extraKeys) {
        extra = mout.object.pick(endpoint, extraKeys);
        extra = mout.object.filter(extra, function (value) {
            return !!value;
        });
        mout.object.mixIn(data, extra);
    }

    return data;
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

Dissector.prototype._onFetchSuccess = function (endpoint, canonicalDir, pkgMeta, isTargetable) {
    var name;
    var initialName = endpoint.initialName != null ? endpoint.initialName : endpoint.name;
    var fetching = this._fetching[initialName];

    // Remove from being fetched list
    mout.array.remove(fetching, endpoint);
    this._nrFetching--;

    // Store some needed stuff
    endpoint.name = name = endpoint.name || pkgMeta.name;
    endpoint.canonicalDir = canonicalDir;
    endpoint.resolvedMeta = pkgMeta;
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
    var dir;
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
        if (endpoint.resolvedMeta.version && endpoint.newly && endpoint.target === '*' && !endpoint.untargetable) {
            endpoint.target = '^' + endpoint.resolvedMeta.version;
            endpoint.originalTarget = '*';
        }
    });

    // After a suitable version has been elected for every package
    promise.then(function () {
        // Filter only packages that need to be installed
        dir = path.resolve(that._config.dir);
        return that._dissected = mout.object.filter(resolved, function (endpoint, name) {
            var installedMeta = endpoint.pkgMeta;//that._installed[name];
            var dst = path.join(dir, name);

            // Skip if source is the same as dest
            if (dst === endpoint.canonicalDir) {
                return false;
            }

            // Analyse a few props
            if (installedMeta &&
                installedMeta._target === endpoint.target &&
                installedMeta._originalSource === endpoint.source &&
                installedMeta._release === endpoint.resolvedMeta._release
                ) {
                return that._config.force;
            }

            return true;
        }, that);
    }).then(this._deferred.resolve, this._deferred.reject);
};

module.exports = Dissector;
