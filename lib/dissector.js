"use strict";

var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var mout = require('mout');
var path = require('path');
var fs = require('fs-extra');
var glob = require('glob');
var utils = require('./utils');
var semver = require('./utils/semver');
var copy = require('./utils/copy');
var errors = require('./errors');

var Repository = require('./Repository');

function Dissector(config, logger) {
    this._config = config;
    this._logger = logger;
    this._repository = new Repository(this._config, this._logger);
}

Dissector.prototype.analyse = function analyse(endpoints, strictly) {
    return when.all(this.readInstalled())
        .then(function (installed) {
            if (_.isEmpty(endpoints) && !strictly) {
                endpoints = _.clone(installed);
            }
            _.forEach(endpoints, function (endpoint) {
                var local = installed[endpoint.name];
                if (!local) {
                    endpoint.missing = true;
                } else {
                    var compatible = json.target === local.pkgMeta._target;
                    if (!compatible) {
                        endpoint.pkgMeta = local.pkgMeta;
                        endpoint.canonicalDir = local.canonicalDir;
                        endpoint.incompatible = true;
                    } else {
                        _.defaults(endpoint, local);
                    }

                    if (compatible) {
                        var originalSource = mout.object.get(local, 'pkgMeta._originalSource');
                        if (originalSource && originalSource !== endpoint.source) {
                            endpoint.different = true;
                        }
                    }
                }
            });
            return endpoints;
        });
};

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


Dissector.prototype.resolve = function (targets, installed) {
    // If already resolving, error out
    if (this._working) {
        return when.reject(errors.create('Already working', 'EWORKING'));
    }

    var that = this;
    this._installed = installed || {};

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
    return this._deferred.promise
        .finally(function () {
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
    var resolved;
    var initialName = endpoint.initialName != null ? endpoint.initialName : endpoint.name;
    var fetching = this._fetching[initialName];

    // Remove from being fetched list
    mout.array.remove(fetching, endpoint);
    this._nrFetching--;

    // Store some needed stuff
    endpoint.name = name = endpoint.name || pkgMeta.name;
    endpoint.canonicalDir = canonicalDir;
    endpoint.pkgMeta = pkgMeta;
    delete endpoint.promise;

    // Add to the resolved list
    // If there's an exact equal endpoint, replace instead of adding
    // This can happen because the name might not be known from the start
    resolved = this._resolved[name] = this._resolved[name] || [];
    resolved.push(endpoint);

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

    // Add to the failed list
    this._failed[name] = this._failed[name] || [];
    this._failed[name].push(err);
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
    var suitables = {};
    var that = this;

    // If something failed, reject the whole resolve promise
    // with the first error
    if (this._hasFailed) {
        clearTimeout(this._failFastTimeout); // Cancel catch fast timeout

        err = mout.object.values(this._failed)[0][0];
        this._deferred.reject(err);
        return;
    }

    // Find a suitable version for each package name
    mout.object.forOwn(this._resolved, function (endpoints, name) {
        var semvers;
        var nonSemvers;

        // Filter out non-semver ones
        semvers = endpoints.filter(function (endpoint) {
            return !!endpoint.pkgMeta.version;
        });

        // Sort semver ones DESC
        semvers.sort(function (first, second) {
            var result = semver.rcompare(first.pkgMeta.version, second.pkgMeta.version);

            // If they are equal and one of them is a wildcard target,
            // give lower priority
            if (!result) {
                if (first.target === '*') {
                    return 1;
                }
                if (second.target === '*') {
                    return -1;
                }
            }

            return result;
        });

        // Convert wildcard targets to semver range targets if they are newly
        // Note that this can only be made if they can be targetable
        // If they are not, the resolver is incapable of handling targets
        semvers.forEach(function (endpoint) {
            if (endpoint.newly && endpoint.target === '*' && !endpoint.untargetable) {
                endpoint.target = '~' + endpoint.pkgMeta.version;
                endpoint.originalTarget = '*';
            }
        });

        // Filter non-semver ones
        nonSemvers = endpoints.filter(function (endpoint) {
            return !endpoint.pkgMeta.version;
        });

        promise = promise.then(function () {
            return that._electSuitable(name, semvers, nonSemvers)
                .then(function (suitable) {
                    suitables[name] = suitable;
                });
        });
    }, this);

    // After a suitable version has been elected for every package
    promise.then(function () {
        // Filter only packages that need to be installed
        dir = path.resolve(that._config.dir);
        return that._dissected = mout.object.filter(suitables, function (endpoint, name) {
            var installedMeta = endpoint.pkgMeta;//that._installed[name];
            var dst;

            // Skip linked dependencies
            if (endpoint.linked) {
                return false;
            }

            // Skip if source is the same as dest
            dst = path.join(dir, name);
            if (dst === endpoint.canonicalDir) {
                return false;
            }

            // Analyse a few props
            if (installedMeta &&
                installedMeta._target === endpoint.target &&
                installedMeta._originalSource === endpoint.source &&
                installedMeta._release === endpoint.pkgMeta._release
                ) {
                return that._config.force;
            }

            return true;
        }, that);
    }).then(this._deferred.resolve, this._deferred.reject);
};

Dissector.prototype._electSuitable = function (name, semvers, nonSemvers) {
    var suitable;
    var dataPicks;
    var save;
    var picks = [];

    // If there are both semver and non-semver, there's no way
    // to figure out the suitable one
    if (semvers.length && nonSemvers.length) {
        picks.push.apply(picks, semvers);
        picks.push.apply(picks, nonSemvers);
        // If there are only non-semver ones, the suitable is elected
        // only if there's one
    } else if (nonSemvers.length) {
        if (nonSemvers.length === 1) {
            return when.resolve(nonSemvers[0]);
        }

        picks.push.apply(picks, nonSemvers);
        // If there are only semver ones, figure out which one is
        // compatible with every requirement
    } else {
        suitable = mout.array.find(semvers, function (subject) {
            return semvers.every(function (endpoint) {
                return subject === endpoint ||
                    semver.satisfies(subject.pkgMeta.version, endpoint.target);
            });
        });

        if (suitable) {
            return when.resolve(suitable);
        }

        picks.push.apply(picks, semvers);
    }

    // At this point, there's a conflict
    this._conflicted[name] = true;

    // Prepare data to be sent bellow
    // 1 - Sort picks by version/release
    picks.sort(function (pick1, pick2) {
        var version1 = pick1.pkgMeta.version;
        var version2 = pick2.pkgMeta.version;
        var comp;

        // If both have versions, compare their versions using semver
        if (version1 && version2) {
            comp = semver.compare(version1, version2);
            if (comp) {
                return comp;
            }
        } else {
            // If one of them has a version, it's considered higher
            if (version1) {
                return 1;
            }
            if (version2) {
                return -1;
            }
        }

        return 0;
    });

    // 2 - Transform data
    dataPicks = picks.map(function (pick) {
        return this.toData(pick);
    }, this);

    // If force latest is enabled, resolve to the highest semver version
    // or whatever non-semver if none available
    if (this._forceLatest) {
        suitable = picks.length - 1;

        this._logger.conflict('solved', 'Unable to find suitable version for ' + name, {
            name: name,
            picks: dataPicks,
            suitable: dataPicks[suitable],
            forced: true
        });

        return when.resolve(picks[suitable]);
    }

    // If interactive is disabled, error out
    if (!this._config.interactive) {
        throw errors.create('Unable to find suitable version for ' + name, 'ECONFLICT', {
            name: name,
            picks: dataPicks
        });
    }

    // At this point the user needs to make a decision
    this._logger.conflict('incompatible', 'Unable to find suitable version for ' + name, {
        name: name,
        picks: dataPicks
    });

    return nfn.call(this._logger.prompt.bind(this._logger), {
        type: 'input',
        message: 'Answer:',
        validate: function (choice) {
            choice = Number(mout.string.trim(choice.trim(), '!'));

            if (!choice || choice < 1 || choice > picks.length) {
                return 'Invalid choice';
            }

            return true;
        }
    }).then(function (choice) {
        var pick;

        // Sanitize choice
        choice = choice.trim();
        save = /^!/.test(choice) || /!$/.test(choice);  // Save if prefixed or suffixed with !
        choice = Number(mout.string.trim(choice, '!'));
        pick = picks[choice - 1];

        return pick;
    });
};

/**
 * Checks if some endpoint is compatible with already resolved target.
 *
 * It is used in two situations:
 *   * checks if resolved component matches dependency constraint
 *   * checks if not resolved component matches alredy fetched component
 *
 * If candidate matches already resolved component, it won't be downloaded.
 *
 * @param {*} candidate endpoint
 * @param {*} resolved endpoint
 *
 * @return {Boolean}
 */
Dissector.prototype._areCompatible = function (candidate, resolved) {
    var resolvedVersion;
    var highestCandidate;
    var highestResolved;
    var candidateIsRange = semver.validRange(candidate.target);
    var resolvedIsRange = semver.validRange(resolved.target);
    var candidateIsVersion = semver.valid(candidate.target);
    var resolvedIsVersion = semver.valid(resolved.target);

    // Check if targets are equal
    if (candidate.target === resolved.target) {
        return true;
    }

    resolvedVersion = resolved.pkgMeta && resolved.pkgMeta.version;
    // If there is no pkgMeta, resolvedVersion is downloading now
    // Check based on target requirements
    if (!resolvedVersion) {
        // If one of the targets is range and other is version,
        // check version against the range
        if (candidateIsVersion && resolvedIsRange) {
            return semver.satisfies(candidate.target, resolved.target);
        }

        if (resolvedIsVersion && candidateIsRange) {
            return semver.satisfies(resolved.target, candidate.target);
        }

        if (resolvedIsVersion && candidateIsVersion) {
            return semver.eq(resolved.target, candidate.target);
        }

        // If both targets are range, check that both have same
        // higher cap
        if (resolvedIsRange && candidateIsRange) {
            highestCandidate =
                this._getCap(semver.toComparators(candidate.target), 'highest');
            highestResolved =
                this._getCap(semver.toComparators(resolved.target), 'highest');

            // This never happens, but you can't be sure without tests
            if (!highestResolved.version || !highestCandidate.version) {
                return false;
            }

            return semver.eq(highestCandidate.version, highestResolved.version) &&
                highestCandidate.comparator === highestResolved.comparator;
        }
        return false;
    }

    // If target is a version, compare against the resolved version
    if (candidateIsVersion) {
        return semver.eq(candidate.target, resolvedVersion);
    }

    // If target is a range, check if resolved version satisfies it
    if (candidateIsRange) {
        return semver.satisfies(resolvedVersion, candidate.target);
    }

    return false;
};

/**
 * Gets highest/lowest version from set of comparators.
 *
 * The only thing that matters for this function is version number.
 * Returned comparator is splitted to comparator and version parts.
 *
 * It is used to receive lowest / highest bound of toComparators result:
 * semver.toComparators('~0.1.1') // => [ [ '>=0.1.1-0', '<0.2.0-0' ] ]
 *
 * Examples:
 *
 * _getCap([['>=2.1.1-0', '<2.2.0-0'], '<3.2.0'], 'highest')
 * // => { comparator: '<', version: '3.2.0' }
 *
 * _getCap([['>=2.1.1-0', '<2.2.0-0'], '<3.2.0'], 'lowest')
 * // => { comparator: '>=', version: '2.1.1-0' }
 *
 * @param {Array.<Array|string>} comparators
 * @param {string} side 'highest' (default) or 'lowest'
 *
 * @return {{ comparator: string, version: string }}
 */
Dissector.prototype._getCap = function (comparators, side) {
    var matches;
    var candidate;
    var cap = {};
    var compare = side === 'lowest' ? semver.lt : semver.gt;

    comparators.forEach(function (comparator) {
        // Get version of this comparator
        // If it's an array, call recursively
        if (Array.isArray(comparator)) {
            candidate = this._getCap(comparator, side);

            // Compare with the current highest version
            if (!cap.version || compare(candidate.version, cap.version)) {
                cap = candidate;
            }
            // Otherwise extract the version from the comparator
            // using a simple regexp
        } else {
            matches = comparator.match(/(.*?)(\d+\.\d+\.\d+.*)$/);
            if (!matches) {
                return;
            }

            // Compare with the current highest version
            if (!cap.version || compare(matches[2], cap.version)) {
                cap.version = matches[2];
                cap.comparator = matches[1];
            }
        }
    }, this);

    return cap;
};

/**
 * Filters out unique endpoint, comparing by name and then source.
 *
 * It leaves last matching endpoint.
 *
 * Examples:
 *
 *  manager._uniquify([
 *      { name: 'foo', source: 'google.com' },
 *      { name: 'foo', source: 'facebook.com' }
 *  ]);
 *  // => { name: 'foo', source: 'facebook.com' }
 *
 * @param {Array.<*>} endpoints
 * @return {Array.<*>} Filtered elements of endpoints
 *
 */
Dissector.prototype._uniquify = function (endpoints) {
    var length = endpoints.length;

    return endpoints.filter(function (endpoint, index) {
        var x;
        var current;

        for (x = index + 1; x < length; ++x) {
            current = endpoints[x];

            if (current === endpoint) {
                return false;
            }

            // Compare name if both set
            // Fallback to compare sources
            if (!current.name && !endpoint.name) {
                if (current.source !== endpoint.source) {
                    continue;
                }
            } else if (current.name !== endpoint.name) {
                continue;
            }

            // Compare targets if name/sources are equal
            if (current.target === endpoint.target) {
                return false;
            }
        }

        return true;
    });
};

module.exports = Dissector;
