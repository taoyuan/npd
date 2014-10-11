var t = require('chai').assert;
var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var chmodr = require('chmodr');
var when = require('when');
var nfn = require('when/node');
var mout = require('mout');
var Logger = require('../../lib/logger');
var copy = require('../../lib/utils/copy');
var GitResolver = require('../../lib/resolvers/git-resolver');
var npdconf = require('../../lib/npdconf');

describe('GitResolver', function () {
    var tempDir = path.resolve(__dirname, '../tmp/tmp');
    var originalrefs = GitResolver.refs;
    var logger;
    var config = npdconf().load();

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function clearResolverRuntimeCache() {
        GitResolver.refs = originalrefs;
        GitResolver.clearRuntimeCache();
    }

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new GitResolver(endpoint, config, logger);
    }

    describe('misc', function () {
        it.skip('should error out if git is not installed');
        it.skip('should setup git template dir to an empty folder');
    });

    describe('.hasNew', function () {
        before(function () {
            fs.mkdirpSync(tempDir);
        });

        afterEach(function (next) {
            clearResolverRuntimeCache();
            fs.remove(path.join(tempDir, '.package.json'), next);
        });

        after(function (next) {
            fs.remove(tempDir, next);
        });


        it('should be true when the resolution type is different', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _resolution: {
                    type: 'version',
                    tag: '0.0.0',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/master'  // same commit hash on purpose
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should be true when a higher version for a range is available', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.0',
                _resolution: {
                    type: 'version',
                    tag: '1.0.0',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.1'  // same commit hash on purpose
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should be true when a resolved to a lower version of a range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should be false when resolved to the same tag (with same commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/1.0.1'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isFalse(hasNew);
                    next();
                })
                .done();
        });

        it('should be true when resolved to the same tag (with different commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/1.0.1'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should be true when a different commit hash for a given branch is available', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'branch',
                    branch: 'master',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should be false when resolved to the the same commit hash for a given branch', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'branch',
                    branch: 'master',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isFalse(hasNew);
                    next();
                })
                .done();
        });

        it('should be false when targeting commit hashes', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'commit',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.refs = function () {
                return when.resolve([
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });
    });

    describe('._resolve', function () {
        afterEach(clearResolverRuntimeCache);

        it('should call the necessary functions by the correct order', function (next) {
            var resolver;

            function DummyResolver() {
                GitResolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, GitResolver);
            mout.object.mixIn(DummyResolver, GitResolver);

            DummyResolver.prototype.getStack = function () {
                return this._stack;
            };

            DummyResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            DummyResolver.prototype.resolve = function () {
                this._stack = [];
                return GitResolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._findResolution = function () {
                this._stack.push('before _findResolution');
                return GitResolver.prototype._findResolution.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _findResolution');
                        return val;
                    }.bind(this));
            };

            DummyResolver.prototype._checkout = function () {
                this._stack.push('before _checkout');
                return when.resolve()
                    .then(function (val) {
                        this._stack.push('after _checkout');
                        return val;
                    }.bind(this));
            };

            DummyResolver.prototype._cleanup = function () {
                this._stack.push('before _cleanup');
                return GitResolver.prototype._cleanup.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _cleanup');
                        return val;
                    }.bind(this));
            };

            resolver = new DummyResolver({ source: 'foo', target: 'master' }, config, logger);

            resolver.resolve()
                .then(function () {
                    t.deepEqual(resolver.getStack(), [
                        'before _findResolution',
                        'after _findResolution',
                        'before _checkout',
                        'after _checkout',
                        'before _cleanup',
                        'after _cleanup'
                    ]);
                    next();
                })
                .done();
        });

        it('should reject the promise if _checkout is not implemented', function (next) {
            var resolver = create('foo');

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver.resolve()
                .then(function () {
                    next(new Error('Should have rejected the promise'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.include(err.message, '_checkout not implemented');
                    next();
                })
                .done();
        });

        it('should reject the promise if #refs is not implemented', function (next) {
            var resolver = create('foo');

            resolver._checkout = function () {
                return when.resolve();
            };

            resolver.resolve()
                .then(function () {
                    next(new Error('Should have rejected the promise'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.include(err.message, 'refs not implemented');
                    next();
                })
                .done();
        });
    });

    describe('._findResolution', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an object', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('*')
                .then(function (resolution) {
                    t.typeOf(resolution, 'object');
                    next();
                })
                .done();
        });

        it('should fail to resolve * if no tags/heads are found', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([]);
            };

            resolver = create('foo');
            resolver._findResolution('*')
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.match(err.message, /branch master does not exist/i);
                    t.match(err.details, /no branches found/i);
                    t.equal(err.code, 'ENORESTARGET');
                    next();
                })
                .done();
        });

        it('should resolve "*" to the latest commit on master if a repository has no valid semver tags', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/some-tag'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('*')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'branch',
                        branch: 'master',
                        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                    });
                    next();
                })
                .done();
        });

        it('should resolve "*" to the latest version if a repository has valid semver tags, ignoring pre-releases', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.2.0-rc.1'  // Should ignore release candidates
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('*')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: 'v0.1.1',
                        commit: 'cccccccccccccccccccccccccccccccccccccccc'
                    });
                    next();
                })
                .done();
        });

        it('should resolve "0.1.*" to the latest version if a repository has valid semver tags, ignoring pre-releases', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.2-rc.1'  // Should ignore release candidates
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('0.1.*')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: 'v0.1.1',
                        commit: 'cccccccccccccccccccccccccccccccccccccccc'
                    });
                    next();
                })
                .done();
        });

        it('should resolve "*" to the latest version if a repository has valid semver tags, not ignoring pre-releases if they are the only versions', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0-rc.1',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.1.0-rc.2'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('*')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: '0.1.0-rc.2',
                        commit: 'cccccccccccccccccccccccccccccccccccccccc'
                    });
                    next();
                })
                .done();
        });

        it('should resolve "~0.1.0-rc" to the latest pre-release version if a repository has valid semver tags', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0-rc.1',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.1.0-rc.2'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('~0.1.0-rc')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: '0.1.0-rc.2',
                        commit: 'cccccccccccccccccccccccccccccccccccccccc'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the latest version that matches a range/version', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.2.0',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/v0.2.1'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.0')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: 'v0.2.1',
                        commit: 'ffffffffffffffffffffffffffffffffffffffff'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to a branch even if target is a range/version that does not exist', function (next) {
            var resolver;

            // See #771
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/3.0.0-wip',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('3.0.0-wip')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'branch',
                        branch: '3.0.0-wip',
                        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to a tag even if target is a range that does not exist', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('1.0')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'tag',
                        tag: '1.0',
                        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the latest pre-release version that matches a range/version', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.2.0',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/v0.2.1-rc.1'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.1-rc')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: 'v0.2.1-rc.1',
                        commit: 'ffffffffffffffffffffffffffffffffffffffff'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the exact version if exists', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.8.1',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.8.1+build.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.8.1+build.2',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.8.1+build.3'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('0.8.1+build.2')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'version',
                        tag: '0.8.1+build.2',
                        commit: 'dddddddddddddddddddddddddddddddddddddddd'
                    });
                    next();
                })
                .done();
        });

        it('should fail to resolve if none of the versions matched a range/version', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v0.1.1'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.0')
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.match(err.message, /was able to satisfy ~0.2.0/i);
                    t.match(err.details, /available versions: 0\.1\.1, 0\.1\.0/i);
                    t.equal(err.code, 'ENORESTARGET');
                    next();
                })
                .done();
        });

        it('should fail to resolve if there are no versions to match a range/version', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = create('foo');

            resolver._findResolution('~0.2.0')
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.match(err.message, /was able to satisfy ~0.2.0/i);
                    t.match(err.details, /no versions found in foo/i);
                    t.equal(err.code, 'ENORESTARGET');
                    next();
                })
                .done();
        });

        it('should resolve to the specified commit', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'commit',
                        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the specified short commit', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('bbbbbbb')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'commit',
                        commit: 'bbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the specified tag if it exists', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/some-tag'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('some-tag')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'tag',
                        tag: 'some-tag',
                        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should resolve to the specified branch if it exists', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('some-branch')
                .then(function (resolution) {
                    t.deepEqual(resolution, {
                        type: 'branch',
                        branch: 'some-branch',
                        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should fail to resolve to the specified tag/branch if it doesn\'t exists', function (next) {
            var resolver;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/some-tag'
                ]);
            };

            resolver = create('foo');
            resolver._findResolution('some-branch')
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.match(err.message, /tag\/branch some-branch does not exist/i);
                    t.match(err.details, /available branches: master/i);
                    t.match(err.details, /available tags: some-tag/i);
                    t.equal(err.code, 'ENORESTARGET');
                    next();
                })
                .done();
        });
    });

    describe('._cleanup', function () {
        beforeEach(function () {
            fs.mkdirpSync(tempDir);
        });

        afterEach(function (next) {
            clearResolverRuntimeCache();
            // Need to chmodr before removing..at least on windows
            // because .git has some read only files
            chmodr(tempDir, 0777, function () {
                fs.remove(tempDir, next);
            });
        });

        it('should remove the .git folder from the temp dir', function (next) {
            var resolver = create('foo');
            var dst = path.join(tempDir, '.git');

            this.timeout(30000);  // Give some time to copy

            // Copy .git folder to the tempDir
            copy.copyDir(path.resolve(__dirname, '../../.git'), dst, {
                mode: 0777
            })
                .then(function () {
                    resolver._tempDir = tempDir;

                    return resolver._cleanup()
                        .then(function () {
                            t.isFalse(fs.existsSync(dst));
                            next();
                        });
                })
                .done();
        });

        it('should not fail if .git does not exist for some reason', function (next) {
            var resolver = create('foo');
            var dst = path.join(tempDir, '.git');

            resolver._tempDir = tempDir;

            resolver._cleanup()
                .then(function () {
                    t.isFalse(fs.existsSync(dst));
                    next();
                })
                .done();
        });

        it('should sill run even if _checkout fails for some reason', function (next) {
            var resolver = create('foo');
            var called = false;

            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver._tempDir = tempDir;
            resolver._checkout = function () {
                return when.reject(new Error('Some error'));
            };

            resolver._cleanup = function () {
                called = true;
                return GitResolver.prototype._cleanup.apply(this, arguments);
            };

            resolver.resolve()
                .then(function () {
                    next(new Error('Should have failed'));
                }, function () {
                    t.isTrue(called);
                    next();
                })
                .done();
        });
    });

    describe('._savePkgMeta', function () {
        before(function () {
            fs.mkdirpSync(tempDir);
        });

        afterEach(function (next) {
            fs.remove(path.join(tempDir, '.package.json'), next);
        });

        after(function (next) {
            fs.remove(tempDir, next);
        });

        it('should save the resolution to the .package.json to be used later by .hasNew', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'version', tag: '0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
                .then(function () {
                    return nfn.call(fs.readFile, path.join(tempDir, '.package.json'));
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());

                    t.deepEqual(json._resolution, resolver._resolution);
                    next();
                })
                .done();
        });

        it('should save the release in the package meta', function (next) {
            var resolver = create('foo');
            var metaFile = path.join(tempDir, '.package.json');

            // Test with type 'version'
            resolver._resolution = { type: 'version', tag: '0.0.1', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
                .then(function () {
                    return nfn.call(fs.readFile, metaFile);
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json._release, '0.0.1');
                })
                // Test with type 'version' + build metadata
                .then(function () {
                    resolver._resolution = { type: 'version', tag: '0.0.1+build.5', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
                    return resolver._savePkgMeta({ name: 'foo' });
                })
                .then(function () {
                    return nfn.call(fs.readFile, metaFile);
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json._release, '0.0.1+build.5');
                })
                // Test with type 'tag'
                .then(function () {
                    resolver._resolution = { type: 'tag', tag: '0.0.1', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
                    return resolver._savePkgMeta({ name: 'foo' });
                })
                .then(function () {
                    return nfn.call(fs.readFile, metaFile);
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json._release, '0.0.1');
                })
                // Test with type 'branch'
                // In this case, it should be the commit
                .then(function () {
                    resolver._resolution = { type: 'branch', branch: 'foo', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
                    return resolver._savePkgMeta({ name: 'foo' });
                })
                .then(function () {
                    return nfn.call(fs.readFile, metaFile);
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json._release, 'aaaaaaaaaa');
                })
                // Test with type 'commit'
                .then(function () {
                    resolver._resolution = { type: 'commit', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
                    return resolver._savePkgMeta({ name: 'foo' });
                })
                .then(function () {
                    return nfn.call(fs.readFile, metaFile);
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json._release, 'aaaaaaaaaa');
                    next();
                })
                .done();
        });

        it('should add the version to the package meta if not present and resolution is a version', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'version', tag: 'v0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo' })
                .then(function () {
                    return nfn.call(fs.readFile, path.join(tempDir, '.package.json'));
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json.version, '0.0.1');

                    next();
                })
                .done();
        });

        it('should remove the version from the package meta if resolution is not a version', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'commit', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
                .then(function () {
                    return nfn.call(fs.readFile, path.join(tempDir, '.package.json'));
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.notProperty(json, 'version');

                    next();
                })
                .done();
        });

        it('should warn if the resolution version is different than the package meta version', function (next) {
            var resolver = create('foo');
            var notified = false;

            resolver._resolution = { type: 'version', tag: '0.0.1' };
            resolver._tempDir = tempDir;

            logger.on('log', function (log) {
                t.typeOf(log, 'object');

                if (log.level === 'warn' && log.id === 'mismatch') {
                    t.match(log.message, /\(0\.0\.0\).*different.*\(0\.0\.1\)/);
                    notified = true;
                }
            });

            resolver._savePkgMeta({ name: 'foo', version: '0.0.0' })
                .then(function () {
                    return nfn.call(fs.readFile, path.join(tempDir, '.package.json'));
                })
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json.version, '0.0.1');
                    t.isTrue(notified);

                    next();
                })
                .done();
        });

        it('should not warn if the resolution version and the package meta version are the same', function (next) {
            var resolver = create('foo');
            var notified = false;

            resolver._resolution = { type: 'version', tag: 'v0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
                .then(function () {
                    return nfn.call(fs.readFile, path.join(tempDir, '.package.json'));
                }, null)
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());
                    t.equal(json.version, '0.0.1');
                    t.isFalse(notified);

                    next();
                })
                .done();
        });
    });

    describe('#branches', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an empty object if no heads are found', function (next) {
            GitResolver.refs = function () {
                return when.resolve([]);
            };

            GitResolver.branches('foo')
                .then(function (branches) {
                    t.typeOf(branches, 'object');
                    t.deepEqual(branches, {});
                    next();
                })
                .done();
        });

        it('should resolve to an object where keys are branches and values their commit hashes', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'foo refs/heads/invalid',                                           // invalid
                    'cccccccccccccccccccccccccccccccccccccccc refs/heads/',             // invalid
                    'dddddddddddddddddddddddddddddddddddddddd refs/heads',              // invalid
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/some-tag',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/0.1.1'
                ]);
            };

            GitResolver.branches('foo')
                .then(function (branches) {
                    t.deepEqual(branches, {
                        'master': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should cache the result for each source', function (next) {
            GitResolver.refs = function (source) {
                if (source === 'foo') {
                    return when.resolve([
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                    ]);
                }

                return when.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/heads/master',
                    'dddddddddddddddddddddddddddddddddddddddd refs/heads/other-branch'
                ]);
            };

            GitResolver.branches('foo')
                .then(function (branches) {
                    t.deepEqual(branches, {
                        'master': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });

                    return GitResolver.branches('bar');
                })
                .then(function (branches) {
                    t.deepEqual(branches, {
                        'master': 'cccccccccccccccccccccccccccccccccccccccc',
                        'other-branch': 'dddddddddddddddddddddddddddddddddddddddd'
                    });

                    // Manipulate the cache and check if it resolves for the cached ones
                    delete GitResolver._cache.branches.get('foo').master;
                    delete GitResolver._cache.branches.get('bar').master;

                    return GitResolver.branches('foo');
                })
                .then(function (branches) {
                    t.deepEqual(branches, {
                        'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });

                    return GitResolver.branches('bar');
                })
                .then(function (branches) {
                    t.deepEqual(branches, {
                        'other-branch': 'dddddddddddddddddddddddddddddddddddddddd'
                    });

                    next();
                })
                .done();
        });

        it('should work if requested in parallel for the same source', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                ]);
            };

            when.all([
                GitResolver.branches('foo'),
                GitResolver.branches('foo')
            ])
                .spread(function (branches1, branches2) {
                    t.deepEqual(branches1, {
                        'master': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    t.deepEqual(branches1, branches2);

                    next();
                })
                .done();
        });
    });

    describe('#tags', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an empty hash if no tags are found', function (next) {
            GitResolver.refs = function () {
                return when.resolve([]);
            };

            GitResolver.tags('foo')
                .then(function (tags) {
                    t.typeOf(tags, 'object');
                    t.deepEqual(tags, {});
                    next();
                })
                .done();
        });

        it('should resolve to an hash of tags', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.2.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.0',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/v0.1.1',
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/some-tag',
                    'foo refs/tags/invalid',                                           // invalid
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/',             // invalid
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags'               // invalid
                ]);
            };

            GitResolver.tags('foo')
                .then(function (tags) {
                    t.deepEqual(tags, {
                        '0.2.1': 'cccccccccccccccccccccccccccccccccccccccc',
                        '0.1.0': 'dddddddddddddddddddddddddddddddddddddddd',
                        'v0.1.1': 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                        'some-tag': 'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });
                    next();
                })
                .done();
        });

        it('should cache the result for each source', function (next) {
            GitResolver.refs = function (source) {
                if (source === 'foo') {
                    return when.resolve([
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.2.1',
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/some-tag'
                    ]);
                }

                return when.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.3.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/some-tag'
                ]);
            };

            GitResolver.tags('foo')
                .then(function (versions) {
                    t.deepEqual(versions, {
                        '0.2.1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        'some-tag': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });

                    return GitResolver.tags('bar');
                })
                .then(function (versions) {
                    t.deepEqual(versions, {
                        '0.3.1': 'cccccccccccccccccccccccccccccccccccccccc',
                        'some-tag': 'dddddddddddddddddddddddddddddddddddddddd'
                    });


                    // Manipulate the cache and check if it resolves for the cached ones
                    delete GitResolver._cache.tags.get('foo')['0.2.1'];
                    delete GitResolver._cache.tags.get('bar')['0.3.1'];

                    return GitResolver.tags('foo');
                })
                .then(function (tags) {
                    t.deepEqual(tags, {
                        'some-tag': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                    });

                    return GitResolver.tags('bar');
                })
                .then(function (tags) {
                    t.deepEqual(tags, {
                        'some-tag': 'dddddddddddddddddddddddddddddddddddddddd'
                    });

                    next();
                })
                .done();
        });

        it('should work if requested in parallel for the same source', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.3.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/some-tag'
                ]);
            };

            when.all([
                GitResolver.tags('foo'),
                GitResolver.tags('foo')
            ])
                .spread(function (tags1, tags2) {
                    t.deepEqual(tags1, {
                        '0.3.1': 'cccccccccccccccccccccccccccccccccccccccc',
                        'some-tag': 'dddddddddddddddddddddddddddddddddddddddd'
                    });
                    t.deepEqual(tags2, tags1);

                    next();
                })
                .done();
        });
    });

    describe('#clearRuntimeCache', function () {
        // Use a class that inherit the GitResolver to see if it uses
        // late binding when clearing the cache
        function CustomGitResolver() {
        }

        util.inherits(CustomGitResolver, GitResolver);
        mout.object.mixIn(CustomGitResolver, GitResolver);

        it('should clear refs cache', function () {
            CustomGitResolver._cache.refs.set('foo', {});
            CustomGitResolver.clearRuntimeCache();
            t.isFalse(CustomGitResolver._cache.refs.has('foo'));
        });

        it('should clear branches cache', function () {
            CustomGitResolver._cache.branches.set('foo', {});
            CustomGitResolver.clearRuntimeCache();
            t.isFalse(CustomGitResolver._cache.branches.has('foo'));
        });

        it('should clear tags cache', function () {
            CustomGitResolver._cache.tags.set('foo', {});
            CustomGitResolver.clearRuntimeCache();
            t.isFalse(CustomGitResolver._cache.tags.has('foo'));
        });

        it('should clear versions cache', function () {
            CustomGitResolver._cache.versions.set('foo', {});
            CustomGitResolver.clearRuntimeCache();
            t.isFalse(CustomGitResolver._cache.versions.has('foo'));
        });
    });

    describe('#versions', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an empty array if no tags are found', function (next) {
            GitResolver.refs = function () {
                return when.resolve([]);
            };

            GitResolver.versions('foo')
                .then(function (versions) {
                    t.typeOf(versions, 'array');
                    t.deepEqual(versions, []);
                    next();
                })
                .done();
        });

        it('should resolve to an empty array if no valid semver tags', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/some-tag'
                ]);
            };

            GitResolver.versions('foo')
                .then(function (versions) {
                    t.typeOf(versions, 'array');
                    t.deepEqual(versions, []);
                    next();
                })
                .done();
        });

        it('should resolve to an array of versions, ignoring invalid semver tags', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.2.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.0',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/v0.1.1',
                    'foo refs/tags/invalid',                                           // invalid
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/',             // invalid
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags'               // invalid
                ]);
            };

            GitResolver.versions('foo', true)
                .then(function (versions) {
                    t.deepEqual(versions, [
                        { version: '0.2.1', tag: '0.2.1', commit: 'cccccccccccccccccccccccccccccccccccccccc' },
                        { version: '0.1.1', tag: 'v0.1.1', commit: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
                        { version: '0.1.0', tag: '0.1.0', commit: 'dddddddddddddddddddddddddddddddddddddddd' }
                    ]);
                })
                .then(function () {
                    return GitResolver.versions('foo');
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.2.1', '0.1.1', '0.1.0']);
                    next();
                })
                .done();
        });

        it('should order the versions according to the semver spec', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.1.0',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.1+build.11',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.1.1+build.100',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.1-rc.22',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.1.1-rc.200',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/0.1.1',
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v0.2.1'
                ]);
            };

            GitResolver.versions('foo', true)
                .then(function (versions) {
                    t.deepEqual(versions, [
                        { version: '0.2.1', tag: 'v0.2.1', commit: 'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
                        { version: '0.1.1+build.11', tag: '0.1.1+build.11', commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
                        { version: '0.1.1+build.100', tag: '0.1.1+build.100', commit: 'cccccccccccccccccccccccccccccccccccccccc' },
                        { version: '0.1.1', tag: '0.1.1', commit: 'ffffffffffffffffffffffffffffffffffffffff' },
                        { version: '0.1.1-rc.200', tag: '0.1.1-rc.200', commit: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
                        { version: '0.1.1-rc.22', tag: '0.1.1-rc.22', commit: 'dddddddddddddddddddddddddddddddddddddddd' },
                        { version: '0.1.0', tag: '0.1.0', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
                    ]);
                    next();
                })
                .done();
        });

        it('should cache the result for each source', function (next) {
            GitResolver.refs = function (source) {
                if (source === 'foo') {
                    return when.resolve([
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.2.1',
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0'
                    ]);
                }

                return when.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.3.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.3.0'
                ]);
            };

            GitResolver.versions('foo')
                .then(function (versions) {
                    t.deepEqual(versions, ['0.2.1', '0.1.0']);

                    return GitResolver.versions('bar');
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.3.1', '0.3.0']);


                    // Manipulate the cache and check if it resolves for the cached ones
                    GitResolver._cache.versions.get('foo').splice(1, 1);
                    GitResolver._cache.versions.get('bar').splice(1, 1);

                    return GitResolver.versions('foo');
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.2.1']);

                    return GitResolver.versions('bar');
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.3.1']);
                    next();
                })
                .done();
        });

        it('should work if requested in parallel for the same source', function (next) {
            GitResolver.refs = function () {
                return when.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.2.1',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0'
                ]);
            };

            when.all([
                GitResolver.versions('foo'),
                GitResolver.versions('foo')
            ])
                .spread(function (versions1, versions2) {
                    t.deepEqual(versions1, ['0.2.1', '0.1.0']);
                    t.deepEqual(versions2, versions1);

                    next();
                })
                .done();
        });
    });
});
