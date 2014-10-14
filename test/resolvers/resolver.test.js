"use strict";

var fs = require('fs-extra');
var path = require('path');
var util = require('util');
var when = require('when');
var tmp = require('tmp');
var t = require('chai').assert;
var Logger = require('bower-logger');
var h = require('../helpers');
var sh = h.require('lib/utils/sh');
var copy = h.require(('lib/utils/copy'));
var npdconf = h.require('lib/npdconf');
var Resolver = h.require('lib/resolvers/resolver');


describe('Resolver', function () {
    var tempDir = path.resolve(__dirname, '../tmp/tmp');
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var logger;
    var dirMode0777;
    var config = npdconf();

    before(function () {
        var stat;

        fs.mkdirpSync(tempDir);
        stat = fs.statSync(tempDir);
        dirMode0777 = stat.mode;
        fs.removeSync(tempDir);

        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new Resolver(endpoint, config, logger);
    }

    describe('#getSource', function () {
        it('should return the resolver source', function () {
            var resolver = create('foo');

            t.equal(resolver.getSource(), 'foo');
        });
    });

    describe('#getName', function () {
        it('should return the resolver name', function () {
            var resolver = create({ source: 'foo', name: 'bar' });

            t.equal(resolver.getName(), 'bar');
        });

        it('should return the resolver source if none is specified (default guess mechanism)', function () {
            var resolver = create('foo');

            t.equal(resolver.getName(), 'foo');
        });
    });

    describe('#getTarget', function () {
        it('should return the resolver target', function () {
            var resolver = create({ source: 'foo', target: '~2.1.0' });

            t.equal(resolver.getTarget(), '~2.1.0');
        });

        it('should return * if none was configured', function () {
            var resolver = create('foo');

            t.equal(resolver.getTarget(), '*');
        });

        it('should return * if latest was configured (for backwards compatibility)', function () {
            var resolver = create('foo');

            t.equal(resolver.getTarget(), '*');
        });
    });

    describe('#hasNew', function () {
        before(function () {
            fs.mkdirpSync(tempDir);
        });

        beforeEach(function () {
            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'test'
            }));
        });

        after(function () {
            fs.removeSync(tempDir);
        });

        it('should throw an error if already working (resolving)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {
            };

            resolver.resolve()
                .then(function () {
                    // Test if resolve can be called again when done
                    resolver.resolve()
                        .then(function () {
                            next(succeeded ? new Error('Should have failed') : null);
                        });
                })
                .done();

            resolver.hasNew(tempDir)
                .then(function () {
                    succeeded = true;
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'EWORKING');
                    t.match(err.message, /already working/i);
                });
        });

        it('should throw an error if already working (checking for newer version)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver.hasNew(tempDir)
                .then(function () {
                    // Test if hasNew can be called again when done
                    resolver.hasNew(tempDir)
                        .then(function () {
                            next(succeeded ? new Error('Should have failed') : null);
                        });
                })
                .done();

            resolver.hasNew(tempDir)
                .then(function () {
                    succeeded = true;
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'EWORKING');
                    t.match(err.message, /already working/i);
                });
        });

        it('should resolve to true by default', function (next) {
            var resolver = create('foo');

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.equal(hasNew, true);
                    next();
                })
                .done();
        });

        it('should resolve to true if the there\'s an error reading the package meta', function (next) {
            var resolver = create('foo');

            fs.removeSync(path.join(tempDir, '.package.json'));
            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.equal(hasNew, true);
                    next();
                })
                .done();
        });

        it('should call _hasNew with the canonical dir and the package meta', function (next) {
            var resolver = create('foo');
            var canonical;
            var meta;

            resolver._hasNew = function (canonicalDir, pkgMeta) {
                canonical = canonicalDir;
                meta = pkgMeta;
                return when.resolve(true);
            };

            resolver.hasNew(tempDir)
                .then(function () {
                    t.equal(canonical, tempDir);
                    t.typeOf(meta, 'object');
                    t.equal(meta.name, 'test');
                    next();
                })
                .done();
        });

        it('should not read the package meta if already passed', function (next) {
            var resolver = create('foo');
            var meta;

            resolver._hasNew = function (canonicalDir, pkgMeta) {
                meta = pkgMeta;
                return when.resolve(true);
            };

            resolver.hasNew(tempDir, {
                name: 'foo'
            })
                .then(function () {
                    t.typeOf(meta, 'object');
                    t.equal(meta.name, 'foo');
                    next();
                })
                .done();
        });
    });


    describe('#resolve', function () {
        it('should reject the promise if _resolve is not implemented', function (next) {
            var resolver = create('foo');

            resolver.resolve()
                .then(function () {
                    next(new Error('Should have rejected the promise'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.include(err.message, 'Not implemented');
                    next();
                })
                .done();
        });

        it('should throw an error if already working (resolving)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {};

            resolver.resolve()
                .then(function () {
                    // Test if resolve can be called again when done
                    resolver.resolve()
                        .then(function () {
                            next(succeeded ? new Error('Should have failed') : null);
                        });
                })
                .done();

            resolver.resolve()
                .then(function () {
                    succeeded = true;
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'EWORKING');
                    t.match(err.message, /already working/i);
                });
        });

        it('should throw an error if already working (checking newer version)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {};

            resolver.hasNew(tempDir)
                .then(function () {
                    // Test if hasNew can be called again when done
                    resolver.hasNew(tempDir)
                        .then(function () {
                            next(succeeded ? new Error('Should have failed') : null);
                        });
                })
                .done();

            resolver.resolve()
                .then(function () {
                    succeeded = true;
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'EWORKING');
                    t.match(err.message, /already working/i);
                });
        });

        it('should call all the functions necessary to resolve by the correct order', function (next) {
            var resolver;

            function DummyResolver() {
                Resolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, Resolver);

            DummyResolver.prototype.getStack = function () {
                return this._stack;
            };

            DummyResolver.prototype.resolve = function () {
                this._stack = [];
                return Resolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._createTempDir = function () {
                this._stack.push('before _createTempDir');
                return Resolver.prototype._createTempDir.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _createTempDir');
                        return val;
                    }.bind(this));
            };
            DummyResolver.prototype._resolve = function () {};
            DummyResolver.prototype._readJson = function () {
                this._stack.push('before _readJson');
                return Resolver.prototype._readJson.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _readJson');
                        return val;
                    }.bind(this));
            };
            DummyResolver.prototype._applyPkgMeta = function () {
                this._stack.push('before _applyPkgMeta');
                return Resolver.prototype._applyPkgMeta.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _applyPkgMeta');
                        return val;
                    }.bind(this));
            };
            DummyResolver.prototype._savePkgMeta = function () {
                this._stack.push('before _savePkgMeta');
                return Resolver.prototype._savePkgMeta.apply(this, arguments)
                    .then(function (val) {
                        this._stack.push('after _savePkgMeta');
                        return val;
                    }.bind(this));
            };

            resolver = new DummyResolver({ source: 'foo'}, config, logger);

            resolver.resolve()
                .then(function () {
                    t.deepEqual(resolver.getStack(), [
                        'before _createTempDir',
                        'after _createTempDir',
                        'before _readJson',
                        'after _readJson',
                        // Both below are called in parallel
                        'before _applyPkgMeta',
                        'after _applyPkgMeta',
                        'before _savePkgMeta',
                        'after _savePkgMeta'
                    ]);
                    next();
                })
                .done();
        });

        it('should resolve with the canonical dir (folder)', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
                .then(function (folder) {
                    t.typeOf(folder, 'string');
                    t.equal(fs.existsSync(folder), true);
                    next();
                })
                .done();
        });
    });

    describe('#getTempDir', function () {
        it('should return null if resolver is not yet resolved', function () {
            var resolver = create('foo');

            t.equal(resolver.getTempDir() == null, true);
        });

        it('should still return null if resolve failed', function () {
            it('should still return null', function (next) {
                var resolver = create('foo');

                resolver._resolve = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                    .fail(function () {
                        t.equal(resolver.getTempDir() == null, true);
                        next();
                    });
            });
        });

        it('should return the canonical dir (folder) if resolve succeeded', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
                .then(function () {
                    var dir = resolver.getTempDir();

                    t.typeOf(dir, 'string');
                    t.equal(fs.existsSync(dir), true);
                    next();
                })
                .done();
        });
    });

    describe('#getPkgMeta', function () {
        it('should return null if resolver is not yet resolved', function () {
            var resolver = create('foo');

            t.equal(resolver.getPkgMeta() == null, true);
        });

        it('should still return null if resolve failed', function () {
            it('should still return null', function (next) {
                var resolver = create('foo');

                resolver._resolve = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                    .fail(function () {
                        t.equal(resolver.getPkgMeta() == null, true);
                        next();
                    });
            });
        });

        it('should return the package meta if resolve succeeded', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
                .then(function () {
                    t.typeOf(resolver.getPkgMeta(), 'object');
                    next();
                })
                .done();
        });
    });

    describe('#_createTempDir', function () {
        it('should create a directory inside a "username/npd" folder, located within the OS temp folder', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
                .then(function (dir) {
                    var dirname;
                    var osTempDir;

                    t.typeOf(dir, 'string');
                    t.equal(fs.existsSync(dir), true);

                    dirname = path.dirname(dir);
                    osTempDir = path.resolve(tmp.tmpdir);

                    t.equal(dir.indexOf(osTempDir), 0);
                    t.equal(dir.indexOf(config.tmp), 0);

                    t.equal(path.basename(dirname), 'npd');
                    t.equal(path.dirname(path.dirname(dirname)), osTempDir);
                    next();
                })
                .done();
        });

        it('should set the dir mode the same as the process', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
                .then(function (dir) {
                    var stat = fs.statSync(dir);
                    var expectedMode = dirMode0777 & ~process.umask();

                    t.equal(stat.mode, expectedMode);
                    next();
                })
                .done();
        });

        it('should remove the folder after execution', function (next) {
            this.timeout(15000);  // Give some time to execute

            fs.remove(config.tmp, function (err) {
                if (err) return next(err);

                sh.exec('node', ['test/fixtures/test-temp-dir/test.js'], { cwd: path.resolve(__dirname, '../..') })
                    .then(function () {
                        t.equal(fs.existsSync(config.tmp), true);
                        t.deepEqual(fs.readdirSync(config.tmp), []);
                        next();
                    }, function (err) {
                        next(new Error(err.details));
                    })
                    .done();
            });
        });

        it('should remove the folder on an uncaught exception', function (next) {
            fs.remove(config.tmp, function (err) {
                if (err) return next(err);

                sh.exec('node', ['test/fixtures/test-temp-dir/test-exception.js'], { cwd: path.resolve(__dirname, '../..') })
                    .then(function () {
                        next(new Error('The command should have failed'));
                    }, function () {
                        t.equal(fs.existsSync(config.tmp), true);
                        t.deepEqual(fs.readdirSync(config.tmp), []);
                        next();
                    })
                    .done();
            });
        });

        it('should set _tempDir with the created directory', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
                .then(function (dir) {
                    t.ok(resolver._tempDir);
                    t.equal(resolver._tempDir, dir);
                    next();
                })
                .done();
        });
    });

    describe('#_cleanTempDir', function () {
        it('should not error out if temporary dir is not yet created', function (next) {
            var resolver = create('foo');

            resolver._cleanTempDir()
                .then(next.bind(null))
                .done();
        });

        it('should delete the temporary folder contents', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
                .then(resolver._cleanTempDir.bind(resolver))
                .then(function (dir) {
                    t.equal(dir, resolver.getTempDir());
                    t.equal(fs.readdirSync(dir).length, 0);
                    next();
                })
                .done();
        });

        it('should keep the mode', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
                .then(resolver._cleanTempDir.bind(resolver))
                .then(function (dir) {
                    var stat = fs.statSync(dir);
                    var expectedMode = dirMode0777 & ~process.umask();

                    t.equal(stat.mode, expectedMode);
                    next();
                })
                .done();
        });

        it('should keep the dir path', function (next) {
            var resolver = create('foo');
            var tempDir;

            resolver._createTempDir()
                .then(function (dir) {
                    tempDir = dir;
                    return resolver._cleanTempDir();
                })
                .then(function (dir) {
                    t.equal(dir, tempDir);
                    next();
                })
                .done();
        });
    });

    describe('#_readJson', function () {
        afterEach(function (next) {
            fs.remove(tempDir, next);
        });

        it('should read the package.json file', function (next) {
            var resolver = create('foo');

            fs.mkdirpSync(tempDir);
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'foo', version: '0.0.0' }));

            resolver._readJson(tempDir)
                .then(function (meta) {
                    t.typeOf(meta, 'object');
                    t.equal(meta.name, 'foo');
                    t.equal(meta.version, '0.0.0');
                    next();
                })
                .done();
        });

        it('should resolve to an inferred json if no json file was found', function (next) {
            var resolver = create('foo');

            resolver._readJson(tempDir)
                .then(function (meta) {
                    t.typeOf(meta, 'object');
                    t.equal(meta.name, 'foo');
                    next();
                })
                .done();
        });

        it.skip('should apply normalisation, defaults and validation to the json object');
    });

    describe('#_applyPkgMeta', function () {
        afterEach(function (next) {
            fs.remove(tempDir, next);
        });

        it('should resolve with the same package meta', function (next) {
            var resolver = create('foo');
            var meta = { name: 'foo' };

            fs.mkdirpSync(tempDir);
            resolver._tempDir = tempDir;

            resolver._applyPkgMeta(meta)
                .then(function (retMeta) {
                    t.equal(retMeta, meta);

                    // Test also with the ignore property because the code is different
                    meta = { name: 'foo', ignore: ['somefile'] };

                    return resolver._applyPkgMeta(meta)
                        .then(function (retMeta) {
                            t.equal(retMeta, meta);
                            next();
                        });
                })
                .done();
        });

        it('should remove files that match the ignore patterns excluding main files', function (next) {
            var resolver = create({ source: 'foo', name: 'foo' });

            fs.mkdirpSync(tempDir);

            // Checkout test package version 0.2.1 which has a npd.json
            // with ignores
            sh.exec('git', ['checkout', '0.2.2'], { cwd: testPackage })
                // Copy its contents to the temporary dir
                .then(function () {
                    return copy.copyDir(testPackage, tempDir);
                })
                .then(function () {
                    var json;

                    // This is a very rudimentary check
                    // Complete checks are made in the 'describe' below
                    resolver._tempDir = tempDir;
                    json = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json')).toString());

                    return resolver._applyPkgMeta(json)
                        .then(function () {
                            t.ok(fs.existsSync(path.join(tempDir, 'foo')));
                            t.ok(fs.existsSync(path.join(tempDir, 'baz')));
                            t.notOk(fs.existsSync(path.join(tempDir, 'test')));
                            t.ok(fs.existsSync(path.join(tempDir, 'package.json')));
                            t.ok(fs.existsSync(path.join(tempDir, 'main.js')));
                            t.ok(fs.existsSync(path.join(tempDir, 'more/docs')));
                            t.ok(fs.existsSync(path.join(tempDir, 'more/fixtures')));
                            next();
                        });
                })
                .done();
        });

        describe('handling of ignore property according to the .gitignore spec', function () {
            it.skip('A blank line matches no files, so it can serve as a separator for readability.');
            it.skip('A line starting with # serves as a comment.');
            it.skip('An optional prefix ! which negates the pattern; any matching file excluded by a previous pattern will become included again...', function () {
                // If a negated pattern matches, this will override lower precedence patterns sources. Put a backslash ("\") in front of the first "!" for patterns that begin with a literal "!", for example, "\!important!.txt".
            });
            it.skip('If the pattern ends with a slash, it is removed for the purpose of the following description, but it would only find a match with a directory...', function () {
                // In other words, foo/ will match a directory foo and paths underneath it, but will not match a regular file or a symbolic link foo (this is consistent with the way how pathspec works in general in git).
            });
            it.skip('If the pattern does not contain a slash /, git treats it as a shell glob pattern and checks for a match against the pathname without leading directories.');
            it.skip('Otherwise, git treats the pattern as a shell glob suitable for consumption by fnmatch(3) with the FNM_PATHNAME flag..', function () {
                // wildcards in the pattern will not match a / in the pathname. For example, "Documentation/*.html" matches "Documentation/git.html" but not "Documentation/ppc/ppc.html" or "tools/perf/Documentation/perf.html".
            });
        });
    });

    describe('#_savePkgMeta', function () {
        before(function () {
            fs.mkdirpSync(tempDir);
        });

        afterEach(function (next) {
            fs.remove(path.join(tempDir, '.package.json'), next);
        });

        after(function (next) {
            fs.remove(tempDir, next);
        });

        it('should resolve with the same package meta', function (next) {
            var resolver = create('foo');
            var meta = { name: 'foo' };

            resolver._tempDir = tempDir;

            resolver._savePkgMeta(meta)
                .then(function (retMeta) {
                    t.equal(retMeta, meta);
                    next();
                })
                .done();
        });

        it('should set the original source and target in package meta file', function (next) {
            var resolver = create({ source: 'bar', target: '~2.0.0' });
            var meta = { name: 'foo' };

            resolver._tempDir = tempDir;

            resolver._savePkgMeta(meta)
                .then(function (retMeta) {
                    t.equal(retMeta._source, 'bar');
                    t.equal(retMeta._target, '~2.0.0');
                    next();
                })
                .done();
        });

        it('should save the package meta to the package meta file (.package.json)', function (next) {
            var resolver = create('foo');

            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'bar' })
                .then(function (retMeta) {
                    fs.readFile(path.join(tempDir, '.package.json'), function (err, contents) {
                        if (err) return next(err);

                        contents = contents.toString();
                        t.deepEqual(JSON.parse(contents), retMeta);
                        next();
                    });
                })
                .done();
        });

    });

    describe('#isTargetable', function () {
        it('should return true by default', function () {
            t.equal(Resolver.isTargetable(), true);
        });
    });

    describe('#versions', function () {
        it('should resolve to an array by default', function (next) {
            Resolver.versions()
                .then(function (versions) {
                    t.typeOf(versions, 'array');
                    t.equal(versions.length, 0);

                    next();
                })
                .done();
        });

    });

    describe('#isCacheable', function () {
        it('caches for normal name', function () {
            var resolver = new Resolver({ source: 'foo' });
            t.equal(resolver.isCacheable(), true);
        });

        it('does not cache for absolute paths', function () {
            var resolver = new Resolver({ source: '/foo' });
            t.equal(resolver.isCacheable(), false);
        });

        it('does not cache for relative paths', function () {
            var resolver = new Resolver({ source: './foo' });
            t.equal(resolver.isCacheable(), false);
        });

        it('does not cache for parent paths', function () {
            var resolver = new Resolver({ source: '../foo' });
            t.equal(resolver.isCacheable(), false);
        });

        it('does not cache for file:/// prefix', function () {
            var resolver = new Resolver({ source: 'file:///foo' });
            t.equal(resolver.isCacheable(), false);
        });

        it('does not cache for windows paths', function () {
            var resolver = new Resolver({ source: '..\\foo' });
            t.equal(resolver.isCacheable(), false);
        });

        it('does not cache for windows absolute paths', function () {
            var resolver = new Resolver({ source: 'C:\\foo' });
            t.equal(resolver.isCacheable(), false);
        });
    });
});