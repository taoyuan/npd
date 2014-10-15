"use strict";

var _ = require('lodash');
var t = require('chai').assert;
var fs = require('fs-extra');
var path = require('path');
var mout = require('mout');
var when = require('when');
var RegistryClient = require('../lib/registry');
var Logger = require('bower-logger');
var resolverFactory = require('../lib/resolver-factory');
var resolvers = require('../lib/resolvers');
var npdconf = require('../lib/npdconf');

describe('resolverFactory', function () {
    var tempSource;
    var logger = new Logger();
    var config = npdconf({dir: process.cwd()});
    var registryClient = new RegistryClient(npdconf({
        cache: config._registry
    }));

    afterEach(function (next) {
        logger.removeAllListeners();

        if (tempSource) {
            fs.remove(tempSource, next);
            tempSource = null;
        } else {
            next();
        }
    });

    after(function (next) {
        fs.remove('docpad', next);
    });

    function callFactory(endpoint, config) {
        config = _.assign({dir: process.cwd()}, config);
        return resolverFactory(endpoint, npdconf(config), logger, registryClient);
    }

    it('should recognize git remote endpoints correctly', function (next) {
        var promise = when.resolve();
        var endpoints;

        endpoints = {
            // git:
            'git://hostname.com/user/project': 'git://hostname.com/user/project',
            'git://hostname.com/user/project/': 'git://hostname.com/user/project',
            'git://hostname.com/user/project.git': 'git://hostname.com/user/project.git',
            'git://hostname.com/user/project.git/': 'git://hostname.com/user/project.git',

            // git@:
            'git@hostname.com:user/project': 'git@hostname.com:user/project',
            'git@hostname.com:user/project/': 'git@hostname.com:user/project',
            'git@hostname.com:user/project.git': 'git@hostname.com:user/project.git',
            'git@hostname.com:user/project.git/': 'git@hostname.com:user/project.git',

            // git+ssh:
            'git+ssh://user@hostname.com:project': 'ssh://user@hostname.com:project',
            'git+ssh://user@hostname.com:project/': 'ssh://user@hostname.com:project',
            'git+ssh://user@hostname.com:project.git': 'ssh://user@hostname.com:project.git',
            'git+ssh://user@hostname.com:project.git/': 'ssh://user@hostname.com:project.git',
            'git+ssh://user@hostname.com/project': 'ssh://user@hostname.com/project',
            'git+ssh://user@hostname.com/project/': 'ssh://user@hostname.com/project',
            'git+ssh://user@hostname.com/project.git': 'ssh://user@hostname.com/project.git',
            'git+ssh://user@hostname.com/project.git/': 'ssh://user@hostname.com/project.git',

            // git+http
            'git+http://hostname.com/project/blah': 'http://hostname.com/project/blah',
            'git+http://hostname.com/project/blah/': 'http://hostname.com/project/blah',
            'git+http://hostname.com/project/blah.git': 'http://hostname.com/project/blah.git',
            'git+http://hostname.com/project/blah.git/': 'http://hostname.com/project/blah.git',
            'git+http://user@hostname.com/project/blah': 'http://user@hostname.com/project/blah',
            'git+http://user@hostname.com/project/blah/': 'http://user@hostname.com/project/blah',
            'git+http://user@hostname.com/project/blah.git': 'http://user@hostname.com/project/blah.git',
            'git+http://user@hostname.com/project/blah.git/': 'http://user@hostname.com/project/blah.git',

            // git+https
            'git+https://hostname.com/project/blah': 'https://hostname.com/project/blah',
            'git+https://hostname.com/project/blah/': 'https://hostname.com/project/blah',
            'git+https://hostname.com/project/blah.git': 'https://hostname.com/project/blah.git',
            'git+https://hostname.com/project/blah.git/': 'https://hostname.com/project/blah.git',
            'git+https://user@hostname.com/project/blah': 'https://user@hostname.com/project/blah',
            'git+https://user@hostname.com/project/blah/': 'https://user@hostname.com/project/blah',
            'git+https://user@hostname.com/project/blah.git': 'https://user@hostname.com/project/blah.git',
            'git+https://user@hostname.com/project/blah.git/': 'https://user@hostname.com/project/blah.git',

            // ssh .git$
            'ssh://user@hostname.com:project.git': 'ssh://user@hostname.com:project.git',
            'ssh://user@hostname.com:project.git/': 'ssh://user@hostname.com:project.git',
            'ssh://user@hostname.com/project.git': 'ssh://user@hostname.com/project.git',
            'ssh://user@hostname.com/project.git/': 'ssh://user@hostname.com/project.git',

            // http .git$
            'http://hostname.com/project.git': 'http://hostname.com/project.git',
            'http://hostname.com/project.git/': 'http://hostname.com/project.git',
            'http://user@hostname.com/project.git': 'http://user@hostname.com/project.git',
            'http://user@hostname.com/project.git/': 'http://user@hostname.com/project.git',

            // https .git$
            'https://hostname.com/project.git': 'https://hostname.com/project.git',
            'https://hostname.com/project.git/': 'https://hostname.com/project.git',
            'https://user@hostname.com/project.git': 'https://user@hostname.com/project.git',
            'https://user@hostname.com/project.git/': 'https://user@hostname.com/project.git',

            // shorthand
            'bower/bower': 'git://github.com/bower/bower.git'
        };

        mout.object.forOwn(endpoints, function (value, key) {

            // Test without name and target
            promise = promise.then(function () {
                return callFactory({ source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitRemote);
                    t.equal(resolver.getSource(), value);
                    t.equal(resolver.getTarget(), '*');
                });

            // Test with target
            promise = promise.then(function () {
                return callFactory({ source: key, target: 'commit-ish' });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitRemote);
                    t.equal(resolver.getSource(), value);
                    t.equal(resolver.getTarget(), 'commit-ish');
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitRemote);
                    t.equal(resolver.getSource(), value);
                    t.equal(resolver.getName(), 'foo');
                    t.equal(resolver.getTarget(), '*');
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    it('should recognize GitHub endpoints correctly', function (next) {
        var promise = when.resolve();
        var gitHub;
        var nonGitHub;

        gitHub = {
            // git:
            'git://github.com/user/project': 'git://github.com/user/project.git',
            'git://github.com/user/project/': 'git://github.com/user/project.git',
            'git://github.com/user/project.git': 'git://github.com/user/project.git',
            'git://github.com/user/project.git/': 'git://github.com/user/project.git',

            // git@:
            'git@github.com:user/project': 'git@github.com:user/project.git',
            'git@github.com:user/project/': 'git@github.com:user/project.git',
            'git@github.com:user/project.git': 'git@github.com:user/project.git',
            'git@github.com:user/project.git/': 'git@github.com:user/project.git',

            // git+ssh:
            'git+ssh://git@github.com:project/blah': 'ssh://git@github.com:project/blah.git',
            'git+ssh://git@github.com:project/blah/': 'ssh://git@github.com:project/blah.git',
            'git+ssh://git@github.com:project/blah.git': 'ssh://git@github.com:project/blah.git',
            'git+ssh://git@github.com:project/blah.git/': 'ssh://git@github.com:project/blah.git',
            'git+ssh://git@github.com/project/blah': 'ssh://git@github.com/project/blah.git',
            'git+ssh://git@github.com/project/blah/': 'ssh://git@github.com/project/blah.git',
            'git+ssh://git@github.com/project/blah.git': 'ssh://git@github.com/project/blah.git',
            'git+ssh://git@github.com/project/blah.git/': 'ssh://git@github.com/project/blah.git',

            // git+http
            'git+http://github.com/project/blah': 'http://github.com/project/blah.git',
            'git+http://github.com/project/blah/': 'http://github.com/project/blah.git',
            'git+http://github.com/project/blah.git': 'http://github.com/project/blah.git',
            'git+http://github.com/project/blah.git/': 'http://github.com/project/blah.git',
            'git+http://user@github.com/project/blah': 'http://user@github.com/project/blah.git',
            'git+http://user@github.com/project/blah/': 'http://user@github.com/project/blah.git',
            'git+http://user@github.com/project/blah.git': 'http://user@github.com/project/blah.git',
            'git+http://user@github.com/project/blah.git/': 'http://user@github.com/project/blah.git',

            // git+https
            'git+https://github.com/project/blah': 'https://github.com/project/blah.git',
            'git+https://github.com/project/blah/': 'https://github.com/project/blah.git',
            'git+https://github.com/project/blah.git': 'https://github.com/project/blah.git',
            'git+https://github.com/project/blah.git/': 'https://github.com/project/blah.git',
            'git+https://user@github.com/project/blah': 'https://user@github.com/project/blah.git',
            'git+https://user@github.com/project/blah/': 'https://user@github.com/project/blah.git',
            'git+https://user@github.com/project/blah.git': 'https://user@github.com/project/blah.git',
            'git+https://user@github.com/project/blah.git/': 'https://user@github.com/project/blah.git',

            // ssh .git$
            'ssh://git@github.com:project/blah.git': 'ssh://git@github.com:project/blah.git',
            'ssh://git@github.com:project/blah.git/': 'ssh://git@github.com:project/blah.git',
            'ssh://git@github.com/project/blah.git': 'ssh://git@github.com/project/blah.git',
            'ssh://git@github.com/project/blah.git/': 'ssh://git@github.com/project/blah.git',

            // http .git$
            'http://github.com/project/blah.git': 'http://github.com/project/blah.git',
            'http://github.com/project/blah.git/': 'http://github.com/project/blah.git',
            'http://user@github.com/project/blah.git': 'http://user@github.com/project/blah.git',
            'http://user@github.com/project/blah.git/': 'http://user@github.com/project/blah.git',

            // https
            'https://github.com/project/blah.git': 'https://github.com/project/blah.git',
            'https://github.com/project/blah.git/': 'https://github.com/project/blah.git',
            'https://user@github.com/project/blah.git': 'https://user@github.com/project/blah.git',
            'https://user@github.com/project/blah.git/': 'https://user@github.com/project/blah.git',

            // shorthand
            'bower/bower': 'git://github.com/bower/bower.git'
        };

        nonGitHub = [
            'git://github.com/user/project/bleh.git',
            'git://xxxxgithub.com/user/project.git',
            'git@xxxxgithub.com:user:project.git',
            'git@xxxxgithub.com:user/project.git',
            'git+ssh://git@xxxxgithub.com:user/project',
            'git+ssh://git@xxxxgithub.com/user/project',
            'git+http://user@xxxxgithub.com/user/project',
            'git+https://user@xxxxgithub.com/user/project',
            'ssh://git@xxxxgithub.com:user/project.git',
            'ssh://git@xxxxgithub.com/user/project.git',
            'http://xxxxgithub.com/user/project.git',
            'https://xxxxgithub.com/user/project.git',
            'http://user@xxxxgithub.com/user/project.git',
            'https://user@xxxxgithub.com/user/project.git'
        ];

        // Test GitHub ones
        mout.object.forOwn(gitHub, function (value, key) {
            // Test without name and target
            promise = promise.then(function () {
                return callFactory({ source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitHub);
                    t.equal(resolver.getSource(), value);
                    t.equal(resolver.getTarget(), '*');
                });

            // Test with target
            promise = promise.then(function () {
                return callFactory({ source: key, target: 'commit-ish' });
            })
                .then(function (resolver) {
                    if (value) {
                        t.instanceOf(resolver, resolvers.GitHub);
                        t.equal(resolver.getSource(), value);
                        t.equal(resolver.getTarget(), 'commit-ish');
                    } else {
                        t.notInstanceOf(resolver, resolvers.GitHub);
                    }
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: key });
            })
                .then(function (resolver) {
                    if (value) {
                        t.instanceOf(resolver, resolvers.GitHub);
                        t.equal(resolver.getSource(), value);
                        t.equal(resolver.getName(), 'foo');
                        t.equal(resolver.getTarget(), '*');
                    } else {
                        t.notInstanceOf(resolver, resolvers.GitHub);
                    }
                });
        });

        // Test similar to GitHub but not real GitHub
        nonGitHub.forEach(function (value) {
            promise = promise.then(function () {
                return callFactory({ source: value });
            })
                .then(function (resolver) {
                    t.notInstanceOf(resolver, resolvers.GitHub);
                    t.instanceOf(resolver, resolvers.GitRemote);
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    it('should recognize local fs git endpoints correctly', function (next) {
        var promise = when.resolve();
        var endpoints;
        var temp;

        endpoints = {};

        // Absolute path
        temp = path.resolve(__dirname, './fixtures/package-a');
        endpoints[temp] = temp;

        // Absolute path that ends with a /
        // See: https://github.com/bower/bower/issues/898
        temp = path.resolve(__dirname, './fixtures/package-a') + '/';
        endpoints[temp] = temp;

        // Relative path
        endpoints[__dirname + '/./fixtures/package-a'] = temp;

        // TODO: test with backslashes on windows and ~/ on unix

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name
            promise = promise.then(function () {
                return callFactory({ source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitFs);
                    t.equal(resolver.getTarget(), '*');
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.GitFs);
                    t.equal(resolver.getName(), 'foo');
                    t.equal(resolver.getTarget(), '*');
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    it.skip('should recognize svn remote endpoints correctly', function (next) {
        var promise = when.resolve();
        var endpoints;

        endpoints = {
            // svn:
            'svn://hostname.com/user/project': 'http://hostname.com/user/project',
            'svn://hostname.com/user/project/': 'http://hostname.com/user/project',

            // svn@:
            'svn://svn@hostname.com:user/project': 'http://svn@hostname.com:user/project',
            'svn://svn@hostname.com:user/project/': 'http://svn@hostname.com:user/project',

            // svn+http
            'svn+http://hostname.com/project/blah': 'http://hostname.com/project/blah',
            'svn+http://hostname.com/project/blah/': 'http://hostname.com/project/blah',
            'svn+http://user@hostname.com/project/blah': 'http://user@hostname.com/project/blah',
            'svn+http://user@hostname.com/project/blah/': 'http://user@hostname.com/project/blah',

            // svn+https
            'svn+https://hostname.com/project/blah': 'https://hostname.com/project/blah',
            'svn+https://hostname.com/project/blah/': 'https://hostname.com/project/blah',
            'svn+https://user@hostname.com/project/blah': 'https://user@hostname.com/project/blah',
            'svn+https://user@hostname.com/project/blah/': 'https://user@hostname.com/project/blah',

            // svn+ssh
            'svn+ssh://hostname.com/project/blah': 'svn+ssh://hostname.com/project/blah',
            'svn+ssh://hostname.com/project/blah/': 'svn+ssh://hostname.com/project/blah',
            'svn+ssh://user@hostname.com/project/blah': 'svn+ssh://user@hostname.com/project/blah',
            'svn+ssh://user@hostname.com/project/blah/': 'svn+ssh://user@hostname.com/project/blah',

            // svn+file
            'svn+file:///project/blah': 'file:///project/blah',
            'svn+file:///project/blah/': 'file:///project/blah'
        };

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name and target
            promise = promise.then(function () {
                return callFactory({ source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Svn);
                    t.instanceOf(resolver, resolvers.GitHub);
                    t.equal(resolvers.Svn.getSource(resolver.getSource()), value);
                    t.equal(resolver.getTarget(), '*');
                });

            // Test with target
            promise = promise.then(function () {
                return callFactory({ source: key, target: 'commit-ish' });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Svn);
                    t.instanceOf(resolver, resolvers.GitHub);
                    t.equal(resolvers.Svn.getSource(resolver.getSource()), value);
                    t.equal(resolver.getTarget(), 'commit-ish');
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Svn);
                    t.instanceOf(resolver, resolvers.GitHub);
                    t.equal(resolvers.Svn.getSource(resolver.getSource()), value);
                    t.equal(resolver.getName(), 'foo');
                    t.equal(resolver.getTarget(), '*');
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    it('should recognize local fs files/folder endpoints correctly', function (next) {
        var promise = when.resolve();
        var endpoints;
        var temp;

        tempSource = path.resolve(__dirname, '../tmp/tmp');
        fs.mkdirpSync(tempSource);
        fs.writeFileSync(path.join(tempSource, '.git'), 'foo');
        fs.writeFileSync(path.join(tempSource, 'file.with.multiple.dots'), 'foo');

        endpoints = {};

        // Absolute path to folder with .git file
        endpoints[tempSource] = tempSource;
        // Relative path to folder with .git file
        endpoints[__dirname + '/../tmp/tmp'] = tempSource;

        // Absolute path to folder
        temp = path.resolve(__dirname, './fixtures/test-temp-dir');
        endpoints[temp] = temp;
        // Absolute + relative path to folder
        endpoints[__dirname + '/./fixtures/test-temp-dir'] = temp;

        // Absolute path to file
        temp = path.resolve(__dirname, './fixtures/package-zip.zip');
        endpoints[temp] = temp;
        // Absolute + relative path to file
        endpoints[__dirname + '/./fixtures/package-zip.zip'] = temp;

        // Relative ../
        endpoints['../'] = path.normalize(__dirname + '/../..');

        // Relative ./
        endpoints['./test/fixtures'] = path.join(__dirname, './fixtures');

        // Relative with just one slash, to test fs resolution
        // priority against shorthands
        endpoints['./test'] = __dirname;

        // Test files with multiple dots (PR #474)
        temp = path.join(tempSource, 'file.with.multiple.dots');
        endpoints[temp] = temp;

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name
            promise = promise.then(function () {
                return callFactory({ source: key });
            })
                .then(function (resolver) {
                    t.equal(resolver.getSource(), value);
                    t.instanceOf(resolver, resolvers.Fs);
                    t.equal(resolver.getTarget(), '*');
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: key });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Fs);
                    t.equal(resolver.getName(), 'foo');
                    t.equal(resolver.getTarget(), '*');
                    t.equal(resolver.getSource(), value);
                });
        });


        promise
            .then(next.bind(next, null))
            .done();
    });

    it('should recognize URL endpoints correctly', function (next) {
        var promise = when.resolve();
        var endpoints;

        endpoints = [
            'http://bower.io/foo.js',
            'https://bower.io/foo.js'
        ];

        endpoints.forEach(function (source) {
            // Test without name
            promise = promise.then(function () {
                return callFactory({ source: source });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Url);
                    t.equal(resolver.getSource(), source);
                });

            // Test with name
            promise = promise.then(function () {
                return callFactory({ name: 'foo', source: source });
            })
                .then(function (resolver) {
                    t.instanceOf(resolver, resolvers.Url);
                    t.equal(resolver.getName(), 'foo');
                    t.equal(resolver.getSource(), source);
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    it.skip('should recognize registry endpoints correctly', function (next) {
        // Create a 'docpad' file at the root to prevent regressions of #666
        fs.writeFileSync('docpad', 'foo');

        callFactory({ source: 'docpad' })
            .then(function (resolver) {
                t.instanceOf(resolver, resolvers.GitRemote);
                t.equal(resolver.getSource(), 'git://github.com/docpad/docpad.git');
                t.equal(resolver.getTarget(), '*');
            })
            .then(function () {
                // Test with name
                return callFactory({ source: 'docpad', name: 'foo' })
                    .then(function (resolver) {
                        t.instanceOf(resolver, resolvers.GitRemote);
                        t.equal(resolver.getSource(), 'git://github.com/docpad/docpad.git');
                        t.equal(resolver.getName(), 'foo');
                        t.equal(resolver.getTarget(), '*');
                    });
            })
            .then(function () {
                // Test with target
                return callFactory({ source: 'docpad', target: '~2.0.0' })
                    .then(function (resolver) {
                        t.instanceOf(resolver, resolvers.GitRemote);
                        t.equal(resolver.getTarget(), '~2.0.0');

                        next();
                    });
            })
            .done();
    });

    it('should error out if the package was not found in the registry', function (next) {
        callFactory({ source: 'some-package-that-will-never-exist' })
            .then(function () {
                throw new Error('Should have failed');
            }, function (err) {
                t.instanceOf(err, Error);
                t.equal(err.code, 'ENOTFOUND');
                t.include(err.message, 'some-package-that-will-never-exist');

                next();
            })
            .done();
    });

    it.skip('should set registry to true on the decomposed endpoint if fetched from the registry', function (next) {
        var endpoint = { source: 'docpad' };

        callFactory(endpoint)
            .then(function () {
                t.isTrue(endpoint.registry);
                next();
            })
            .done();
    });

    it('should use the configured shorthand resolver', function (next) {
        callFactory({ source: 'bower/bower' })
            .then(function (resolver) {
                var config = {
                    shorthand: 'git://bower.io/{{owner}}/{{package}}/{{shorthand}}'
                };

                t.equal(resolver.getSource(), 'git://github.com/bower/bower.git');

                return callFactory({ source: 'IndigoUnited/promptly' }, config);
            })
            .then(function (resolver) {
                t.equal(resolver.getSource(), 'git://bower.io/IndigoUnited/promptly/IndigoUnited/promptly');
                next();
            })
            .done();
    });

    it('should not expand using the shorthand resolver if it looks like a SSH URL', function (next) {
        callFactory({ source: 'bleh@xxx.com:foo/bar' })
            .then(function (resolver) {
                throw new Error('Should have failed');
            }, function (err) {
                t.instanceOf(err, Error);
                t.equal(err.code, 'ENOTFOUND');
                t.include(err.message, 'bleh@xxx.com:foo/bar');
                next();
            })
            .done();
    });


    it('should error out if there\'s no suitable resolver for a given source', function (next) {
        resolverFactory({ source: 'some-package-that-will-never-exist' }, config, logger)
            .then(function () {
                throw new Error('Should have failed');
            }, function (err) {
                t.instanceOf(err, Error);
                t.equal(err.code, 'ENORESOLVER');
                t.include(err.message, 'appropriate resolver');
                next();
            })
            .done();
    });

    it.skip('should use config.dir when resolving relative paths');

    it('should not swallow constructor errors when instantiating resolvers', function (next) {
        var promise = when.resolve();
        var endpoints;

        // TODO: test with others
        endpoints = [
            'http://bower.io/foo.js',
            path.resolve(__dirname, './fixtures/test-temp-dir')
        ];

        endpoints.forEach(function (source) {
            promise = promise.then(function () {
                return callFactory({ source: source, target: 'bleh' });
            })
                .then(function () {
                    throw new Error('Should have failed');
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.match(err.message, /can't resolve targets/i);
                    t.equal(err.code, 'ENORESTARGET');
                });
        });

        promise
            .then(next.bind(next, null))
            .done();
    });

    describe('.clearRuntimeCache', function () {
        it('should call every resolver static method that clears the runtime cache', function () {
            var originalMethods = {};
            var called = [];
            var error;

            mout.object.forOwn(resolvers, function (ConcreteResolver, key) {
                originalMethods[key] = ConcreteResolver.clearRuntimeCache;
                ConcreteResolver.clearRuntimeCache = function () {
                    called.push(key);
                    return originalMethods[key].apply(this, arguments);
                };
            });

            try {
                resolverFactory.clearRuntimeCache();
            } catch (e) {
                error = e;
            } finally {
                mout.object.forOwn(resolvers, function (ConcreteResolver, key) {
                    ConcreteResolver.clearRuntimeCache = originalMethods[key];
                });
            }

            if (error) {
                throw error;
            }

            t.deepEqual(called.sort(), Object.keys(resolvers).sort());
        });
    });
});
