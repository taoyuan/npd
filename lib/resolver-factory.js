"use strict";

var when = require('when');
var fn = require('when/function');
var nfn = require('when/node');
var fs = require('fs-extra');
var path = require('path');
var mout = require('mout');
var errors = require('./errors');
var utils = require('./utils');

var resolvers = require('./resolvers');

function createInstance(endpoint, config, logger, registryClient) {
    return getConstructor(endpoint.source, config, registryClient)
        .spread(function (ConcreteResolver, source, fromRegistry) {
            var endpointCopy = mout.object.pick(endpoint, ['name', 'target']);

            endpointCopy.source = source;

            // Signal if it was fetched from the registry
            if (fromRegistry) {
                endpoint.registry = true;
                // If no name was specified, assume the name from the registry
                if (!endpointCopy.name) {
                    endpointCopy.name = endpoint.name = endpoint.source;
                }
            }

            return new ConcreteResolver(endpointCopy, config, logger);
        });
}

function getConstructor(source, config, registryClient) {
    var absolutePath,
        promise;

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    //           git@ at the start
    if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source) || /^git@/i.test(source)) {
        source = source.replace(/^git\+/, '');
        return fn.call(function () {

            // If it's a GitHub repository, return the specialized resolver
            if (resolvers.GitHub.getOrgRepoPair(source)) {
                return [resolvers.GitHub, source];
            }

            return [resolvers.GitRemote, source];
        });
    }

    // SVN case: svn, svn+ssh, svn+http, svn+https, svn+file
    if (/^svn(\+(ssh|https?|file))?:\/\//i.test(source)) {
        return fn.call(function () {
            return [resolvers.Svn, source];
        });
    }

    // URL case
    if (/^https?:\/\//i.exec(source)) {
        return fn.call(function () {
            return [resolvers.Url, source];
        });
    }

    // Below we try a series of async tests to guess the type of resolver to use
    // If a step was unable to guess the resolver, it throws an error
    // If a step was able to guess the resolver, it resolves with a function
    // That function returns a promise that will resolve with the concrete type

    // If source is ./ or ../ or an absolute path
    absolutePath = path.resolve(config.prefix, source);

    if (/^\.\.?[\/\\]/.test(source) || /^~\//.test(source) || path.normalize(source).replace(/[\/\\]+$/, '') === absolutePath) {
        promise = nfn.call(fs.stat, path.join(absolutePath, '.git'))
            .then(function (stats) {
                if (stats.isDirectory()) {
                    return function () {
                        return when.resolve([resolvers.GitFs, absolutePath]);
                    };
                }

                throw new Error('Not a Git repository');
            })
            // If not, check if source is a valid Subversion repository
            .catch(function () {
                return nfn.call(fs.stat, path.join(absolutePath, '.svn'))
                    .then(function (stats) {
                        if (stats.isDirectory()) {
                            return function () {
                                return when.resolve([resolvers.Svn, absolutePath]);
                            };
                        }

                        throw new Error('Not a Subversion repository');
                    });
            })
            // If not, check if source is a valid file/folder
            .catch(function () {
                return nfn.call(fs.stat, absolutePath)
                    .then(function () {
                        return function () {
                            return when.resolve([resolvers.Fs, absolutePath]);
                        };
                    });
            });
    } else {
        promise = when.reject(new Error('Not an absolute or relative file'));
    }

    return promise
        // Check if is a shorthand and expand it
        .catch(function (err) {
            var parts, i, host;
            var short = source[0] === '@';

            // Skip ssh and/or URL with auth
            if (!short && /[:@]/.test(source)) {
                throw err;
            }

            // Ensure exactly only one "/"
            parts = source.split('/');
            if (parts.length === 2) {
                i = parts[0].indexOf(':');
                if (i > 0 && short) {
                    host = parts[0].substr(1, i - 1);
                    parts[0] = parts[0].substr(i + 1);
                }

                var lookup = utils.lookup(config.hosts);
                if (host) {
                    host = lookup(host);
                } else if (config.host) {
                    host = config.host;
                } else {
                    host = lookup();
                }

                if (!host) throw err;

                source = mout.string.interpolate(host, {
                    shorthand: source,
                    owner: parts[0],
                    package: parts[1]
                });

                return function () {
                    return getConstructor(source, config, registryClient);
                };
            }

            throw err;
        })
        // As last resort, we try the registry
        .catch(function (err) {
            if (!registryClient) {
                throw err;
            }

            return function () {
                return nfn.call(registryClient.lookup.bind(registryClient), source)
                    .then(function (entry) {
                        if (!entry) {
                            throw errors.create('Package ' + source + ' not found', 'ENOTFOUND');
                        }

                        // TODO: Handle entry.type.. for now it's only 'alias'
                        //       When we got published packages, this needs to be adjusted
                        source = entry.url;

                        return getConstructor(source, config, registryClient)
                            .spread(function (ConcreteResolver, source) {
                                return [ConcreteResolver, source, true];
                            });
                    });
            };
        })
        // If we got the function, simply call and return
        .then(function (func) {
            return func();
            // Finally throw a meaningful error
        }, function () {
            throw errors.create('Could not find appropriate resolver for ' + source, 'ENORESOLVER');
        });
}

function clearRuntimeCache() {
    mout.object.values(resolvers).forEach(function (ConcreteResolver) {
        ConcreteResolver.clearRuntimeCache();
    });
}

module.exports = createInstance;
module.exports.create = createInstance;
module.exports.getConstructor = getConstructor;
module.exports.clearRuntimeCache = clearRuntimeCache;



