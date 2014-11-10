"use strict";

var t = require('chai').assert;
var when = require('when');
var path = require('path');
var mout = require('mout');
var fs = require('fs-extra');
var Registry = require('../lib/registry');
var Logger = require('wide').Logger;
var proxyquire = require('proxyquire');
var npdconf = require('../lib/npdconf');
var Cache = require('../lib/cache');
var resolvers = require('../lib/resolvers');
var copy = require('../lib/utils/copy');

describe('Repository', function () {
    var repository;
    var resolver;
    var resolverFactoryHook;
    var resolverFactoryClearHook;
    var testPackage = path.resolve(__dirname, './fixtures/package-a');
    var tempPackage = path.resolve(__dirname, './tmp/temp-package');
    var packagesCacheDir = path.join(__dirname, './tmp/temp-resolve-cache');
    var registryCacheDir = path.join(__dirname, './tmp/temp-registry-cache');
    var mockSource = 'file://' + testPackage;
    var forceCaching = true;

    after(function () {
        fs.removeSync(registryCacheDir);
        fs.removeSync(packagesCacheDir);
    });

    beforeEach(function (next) {
        var Repository;
        var config;
        var logger = new Logger();

        // Config
        config = npdconf({
            storage: {
                packages: packagesCacheDir,
                registry: registryCacheDir
            }
        });

        // Mock the resolver factory to always return a resolver for the test package
        function resolverFactory(endpoint, _config, _logger, _registry) {
            t.deepEqual(_config, config);
            t.instanceOf(_logger, Logger);
            t.instanceOf(_registry, Registry);

            endpoint = mout.object.deepMixIn({}, endpoint);
            endpoint.source = mockSource;

            resolver = new resolvers.GitRemote(endpoint, _config, _logger);

            if (forceCaching) {
                // Force to use cache even for local resources
                resolver.isCacheable = function () {
                    return true;
                };
            }

            resolverFactoryHook(resolver);

            return when.resolve(resolver);
        }
        resolverFactory.getConstructor = function () {
            return when.resolve([resolvers.GitRemote, 'file://' + testPackage, false]);
        };
        resolverFactory.clearRuntimeCache = function () {
            resolverFactoryClearHook();
        };

        Repository = proxyquire('../lib/repository', {
            './resolver-factory': resolverFactory
        });
        repository = new Repository(config, logger);

        // Reset hooks
        resolverFactoryHook = resolverFactoryClearHook = function () {};

        // Remove temp package
        fs.removeSync(tempPackage);

        // Clear the repository
        repository.clear()
            .then(next.bind(next, null), next);
    });

    describe('.constructor', function () {
        it('should pass the config correctly to the registry client, including its cache folder', function () {
            t.equal(repository._registry._config.cache, registryCacheDir);
        });
    });

    describe('.fetch', function () {
        it('should call the resolver factory to get the appropriate resolver', function (next) {
            var called = false;

            resolverFactoryHook = function () {
                called = true;
            };

            repository.fetch({ name: '', source: 'foo', target: '~0.1.0' })
                .spread(function (canonicalDir, pkgmeta) {
                    t.isTrue(called);
                    t.isTrue(fs.existsSync(canonicalDir));
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.name, 'package-a');
                    t.equal(pkgmeta.version, '0.1.1');
                    next();
                })
                .done();
        });

        it('should just call the resolver resolve method if force was specified', function (next) {
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return when.resolve(false);
                };
            };

            repository._cache.retrieve = function () {
                called.push('retrieve');
                return when.resolve([]);
            };

            repository._config.force = true;
            repository.fetch({ name: '', source: 'foo', target: ' ~0.1.0' })
                .spread(function (canonicalDir, pkgmeta) {
                    t.deepEqual(called, ['resolve']);
                    t.isTrue(fs.existsSync(canonicalDir));
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.name, 'package-a');
                    t.equal(pkgmeta.version, '0.1.1');
                    next();
                })
                .done();
        });

        it('should attempt to retrieve a resolved package from the resolve package', function (next) {
            var called = false;
            var originalRetrieve = repository._cache.retrieve;

            repository._cache.retrieve = function (source) {
                called = true;
                t.equal(source, mockSource);
                return originalRetrieve.apply(this, arguments);
            };

            repository.fetch({ name: '', source: 'foo', target: '~0.1.0' })
                .spread(function (canonicalDir, pkgmeta) {
                    t.isTrue(called);
                    t.isTrue(fs.existsSync(canonicalDir));
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.name, 'package-a');
                    t.equal(pkgmeta.version, '0.1.1');
                    next();
                })
                .done();
        });

        it('should avoid using cache for local resources', function (next) {
            forceCaching = false;

            var called = false;
            var originalRetrieve = repository._cache.retrieve;

            repository._cache.retrieve = function (source) {
                called = true;
                t.equal(source, mockSource);
                return originalRetrieve.apply(this, arguments);
            };

            repository.fetch({ name: '', source: testPackage, target: '~0.1.0' })
                .spread(function (canonicalDir, pkgmeta) {
                    t.isFalse(called);
                    t.isTrue(fs.existsSync(canonicalDir));
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.name, 'package-a');
                    t.equal(pkgmeta.version, '0.1.1');
                    forceCaching = true;
                    next();
                })
                .done();
        });

        it('should just call the resolver resolve method if no appropriate package was found in the resolve cache', function (next) {
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                };
            };

            repository._cache.retrieve = function () {
                return when.resolve([]);
            };

            repository.fetch({ name: '', source: 'foo', target: ' ~0.1.0' })
                .spread(function (canonicalDir, pkgmeta) {
                    t.deepEqual(called, ['resolve']);
                    t.isTrue(fs.existsSync(canonicalDir));
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.name, 'package-a');
                    t.equal(pkgmeta.version, '0.1.1');
                    next();
                })
                .done();
        });

        it('should call the resolver hasNew method if an appropriate package was found in the resolve cache', function (next) {
            var json = {
                name: 'a',
                version: '0.2.1'
            };
            var called = false;

            resolverFactoryHook = function (resolver) {
                var originalHasNew = resolver.hasNew;

                resolver.hasNew = function (canonicalDir, pkgmeta) {
                    t.equal(canonicalDir, tempPackage);
                    t.deepEqual(pkgmeta, json);
                    called = true;
                    return originalHasNew.apply(this, arguments);
                };
            };

            repository._cache.retrieve = function () {
                return when.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
                .then(function () {
                    fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                    return repository.fetch({ name: '', source: 'foo', target: '~0.1.0' })
                        .spread(function (canonicalDir, pkgmeta) {
                            t.isTrue(called);
                            t.isTrue(fs.existsSync(canonicalDir));
                            t.typeOf(pkgmeta, 'object');
                            t.equal(pkgmeta.name, 'package-a');
                            t.equal(pkgmeta.version, '0.1.1');
                            next();
                        });
                })
                .done();
        });

        it('should call the resolver resolve method if hasNew resolved to true', function (next) {
            var json = {
                name: 'a',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function (canonicalDir, pkgmeta) {
                    t.equal(canonicalDir, tempPackage);
                    t.deepEqual(pkgmeta, json);
                    called.push('hasNew');
                    return when.resolve(true);
                };
            };

            repository._cache.retrieve = function () {
                return when.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
                .then(function () {
                    fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                    return repository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                        .spread(function (canonicalDir, pkgmeta) {
                            t.deepEqual(called, ['hasNew', 'resolve']);
                            t.isTrue(fs.existsSync(canonicalDir));
                            t.typeOf(pkgmeta, 'object');
                            t.equal(pkgmeta.name, 'a');
                            t.equal(pkgmeta.version, '0.2.2');
                            next();
                        });
                })
                .done();
        });

        it('should resolve to the cached package if hasNew resolve to false', function (next) {
            var json = {
                name: 'a',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function (canonicalDir, pkgmeta) {
                    t.equal(canonicalDir, tempPackage);
                    t.deepEqual(pkgmeta, json);
                    called.push('hasNew');
                    return when.resolve(false);
                };
            };

            repository._cache.retrieve = function () {
                return when.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
                .then(function () {
                    fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                    return repository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                        .spread(function (canonicalDir, pkgmeta) {
                            t.deepEqual(called, ['hasNew']);
                            t.equal(canonicalDir, tempPackage);
                            t.deepEqual(pkgmeta, json);
                            next();
                        });
                })
                .done();
        });

        it('should just use the cached package if offline was specified', function (next) {
            var json = {
                name: 'a',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.hasNew = function (canonicalDir, pkgmeta) {
                    t.equal(canonicalDir, tempPackage);
                    t.deepEqual(pkgmeta, json);
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return when.resolve(false);
                };
            };

            repository._cache.retrieve = function () {
                return when.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
                .then(function () {
                    fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                    repository._config.offline = true;
                    return repository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                        .spread(function (canonicalDir, pkgmeta) {
                            t.equal(called.length, 0);
                            t.equal(canonicalDir, tempPackage);
                            t.deepEqual(pkgmeta, json);
                            next();
                        });
                })
                .done();
        });

        it('should error out if there is no appropriate package in the resolve cache and offline was specified', function (next) {
            repository._config.offline = true;
            repository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                .then(function () {
                    throw new Error('Should have failed');
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'ENOCACHE');

                    next();
                })
                .done();
        });
    });

    describe('.versions', function () {
        it('should call the versions method on the concrete resolver', function (next) {
            var called = [];
            var originalVersions = resolvers.GitRemote.versions;

            resolvers.GitRemote.versions = function (source) {
                t.equal(source, mockSource);
                called.push('resolver');
                return when.resolve([]);
            };

            repository._cache.versions = function () {
                called.push('resolve-cache');
                return when.resolve([]);
            };

            repository.versions('foo')
                .then(function (versions) {
                    t.deepEqual(called, ['resolver']);
                    t.typeOf(versions, 'array');
                    t.equal(versions.length, 0);

                    next();
                })
                .finally(function () {
                    resolvers.GitRemote.versions = originalVersions;
                })
                .done();
        });

        it('should call the versions method on the resolve cache if offline was specified', function (next) {
            var called = [];
            var originalVersions = resolvers.GitRemote.versions;

            resolvers.GitRemote.versions = function () {
                called.push('resolver');
                return when.resolve([]);
            };

            repository._cache.versions = function (source) {
                t.equal(source, mockSource);
                called.push('resolve-cache');
                return when.resolve([]);
            };

            repository._config.offline = true;
            repository.versions('foo')
                .then(function (versions) {
                    t.deepEqual(called, ['resolve-cache']);
                    t.typeOf(versions, 'array');
                    t.equal(versions.length, 0);

                    next();
                })
                .finally(function () {
                    resolvers.GitRemote.versions = originalVersions;
                })
                .done();
        });
    });

    describe('.eliminate', function () {
        it('should call the eliminate method from the resolve cache', function (next) {
            var called = false;
            var json = {
                name: 'a',
                version: '0.2.0',
                _source: 'foo'
            };

            repository._cache.eliminate = function (pkgmeta) {
                t.deepEqual(pkgmeta, json);
                called = true;
                return when.resolve();
            };

            repository.eliminate(json)
                .then(function () {
                    t.isTrue(called);
                    next();
                })
                .done();
        });

        it('should call the clearCache method with the name from the registry client', function (next) {
            var called = false;
            var json = {
                name: 'a',
                version: '0.2.0',
                _source: 'foo'
            };

            repository._registry.clearCache = function (name, callback) {
                t.deepEqual(name, json.name);
                called = true;
                callback();
            };

            repository.eliminate(json)
                .then(function () {
                    t.isTrue(called);
                    next();
                })
                .done();
        });
    });

    describe('.list', function () {
        it('should proxy to the resolve cache list method', function (next) {
            var called = false;
            var originalList = repository._cache.list;

            repository._cache.list = function () {
                called = true;
                return originalList.apply(this, arguments);
            };

            repository.list()
                .then(function (entries) {
                    t.isTrue(called);
                    t.typeOf(entries, 'array');
                    next();
                })
                .done();
        });
    });

    describe('.clear', function () {
        it('should call the clear method from the resolve cache', function (next) {
            var called = false;

            repository._cache.clear = function () {
                called = true;
                return when.resolve();
            };

            repository.clear()
                .then(function () {
                    t.isTrue(called);
                    next();
                })
                .done();
        });

        it('should call the clearCache method without name from the registry client', function (next) {
            var called = false;

            repository._registry.clearCache = function (callback) {
                called = true;
                callback();
            };

            repository.clear()
                .then(function () {
                    t.isTrue(called);
                    next();
                })
                .done();
        });
    });

    describe('.reset', function () {
        it('should call the reset method from the resolve cache', function () {
            var called = false;

            repository._cache.reset = function () {
                called = true;
                return repository._cache;
            };

            repository.reset();
            t.isTrue(called);
        });

        it('should call the resetCache method without name from the registry client', function () {
            var called = false;

            repository._registry.resetCache = function () {
                called = true;
                return repository._registry;
            };

            repository.reset();
            t.isTrue(called);
        });
    });

    describe('.getRegistry', function () {
        it('should return the underlying registry client', function () {
            t.instanceOf(repository.getRegistry(), Registry);
        });
    });

    describe('.getCache', function () {
        it('should return the underlying resolve cache', function () {
            t.instanceOf(repository.getCache(), Cache);
        });
    });

    describe('#clearRuntimeCache', function () {
        it('should clear the resolve cache runtime cache', function () {
            var called = false;
            var originalClearRuntimeCache = Cache.clearRuntimeCache;

            // No need to restore the original method since the constructor
            // gets re-assigned every time in beforeEach
            Cache.clearRuntimeCache = function () {
                called = true;
                return originalClearRuntimeCache.apply(Cache, arguments);
            };

            repository.constructor.clearRuntimeCache();
            t.isTrue(called);
        });

        it('should clear the resolver factory runtime cache', function () {
            var called = false;

            resolverFactoryClearHook = function () {
                called = true;
            };

            repository.constructor.clearRuntimeCache();
            t.isTrue(called);
        });

        it('should clear the registry runtime cache', function () {
            var called = false;
            var originalClearRuntimeCache = Registry.clearRuntimeCache;

            // No need to restore the original method since the constructor
            // gets re-assigned every time in beforeEach
            Registry.clearRuntimeCache = function () {
                called = true;
                return originalClearRuntimeCache.apply(Registry, arguments);
            };

            repository.constructor.clearRuntimeCache();
            t.isTrue(called);
        });
    });
});
