var t = require('chai').assert;
var path = require('path');
var mout = require('mout');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var Cache = require('../lib/cache');
var npdconf = require('../lib/npdconf');
var sh = require('../lib/utils/sh');
var copy = require('../lib/utils/copy');
var md5 = require('../lib/utils/md5');

describe('Cache', function () {
    var cache;
    var testPackage = path.resolve(__dirname, './fixtures/package-a');
    var tempPackage = path.resolve(__dirname, './tmp/temp-package');
    var tempPackage2 = path.resolve(__dirname, './tmp/temp2-package');
    var cacheDir = path.join(__dirname, './tmp/temp-cache');

    before(function (next) {
        // Delete cache folder
        fs.removeSync(cacheDir);

        // Instantiate resolver cache
        cache = new Cache(npdconf({
            storage: {
                packages: cacheDir
            }
        }));

        // Checkout test package version 0.2.0
        sh.exec('git', ['checkout', '0.2.0'], {cwd: testPackage})
            .then(next.bind(next, null), next);
    });

    beforeEach(function () {
        // Reset in memory cache for each test
        cache.reset();
    });

    after(function () {
        // Remove cache folder afterwards
        fs.removeSync(cacheDir);
    });

    describe('.constructor', function () {
        beforeEach(function () {
            // Delete temp folder
            fs.removeSync(tempPackage);
        });
        after(function () {
            // Delete temp folder
            fs.removeSync(tempPackage);
        });

        function initialize(cacheDir) {
            return new Cache(npdconf({
                storage: {
                    packages: cacheDir
                }
            }));
        }

        it('should create the cache folder if it doesn\'t exists', function () {
            initialize(tempPackage);
            t.isTrue(fs.existsSync(tempPackage));
        });

        it('should not error out if the cache folder already exists', function () {
            fs.mkdirpSync(tempPackage);
            initialize(tempPackage);
        });
    });

    describe('.store', function () {
        var oldFsRename = fs.rename;

        beforeEach(function (next) {
            // Restore oldFsRename
            fs.rename = oldFsRename;

            // Create a fresh copy of the test package into temp
            fs.removeSync(tempPackage);
            copy.copyDir(testPackage, tempPackage, {ignore: ['.git']})
                .then(next.bind(next, null), next);
        });

        it('should move the canonical dir to source-md5/version/ folder if package meta has a version', function (next) {
            cache.store(tempPackage, {
                name: 'foo',
                version: '1.0.0',
                _source: 'foo',
                _target: '*'
            })
                .then(function (dir) {
                    t.equal(dir, path.join(cacheDir, md5('foo'), '1.0.0'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should move the canonical dir to source-md5/target/ folder if package meta has no version', function (next) {
            cache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: 'some-branch'
            })
                .then(function (dir) {
                    t.equal(dir, path.join(cacheDir, md5('foo'), 'some-branch'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should move the canonical dir to source-md5/_wildcard/ folder if package meta has no version and target is *', function (next) {
            cache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: '*'
            })
                .then(function (dir) {
                    t.equal(dir, path.join(cacheDir, md5('foo'), '_wildcard'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should read the package meta if not present', function (next) {
            var pkgmeta = path.join(tempPackage, '.package.json');

            // Copy package.json to .package.json and add some props
            copy.copyFile(path.join(tempPackage, 'package.json'), pkgmeta)
                .then(function () {
                    return nfn.call(fs.readFile, pkgmeta)
                        .then(function (contents) {
                            var json = JSON.parse(contents.toString());

                            json._target = '~0.2.0';
                            json._source = 'git://github.com/bower/test-package.git';

                            return nfn.call(fs.writeFile, pkgmeta, JSON.stringify(json, null, '  '));
                        });
                })
                // Store as usual
                .then(function () {
                    return cache.store(tempPackage);
                })
                .then(function (dir) {
                    t.equal(dir, path.join(cacheDir, md5('git://github.com/bower/test-package.git'), '0.2.0'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should error out when reading the package meta if the file does not exist', function (next) {
            cache.store(tempPackage)
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    t.instanceOf(err, Error);
                    t.equal(err.code, 'ENOENT');
                    t.include(err.message, path.join(tempPackage, '.package.json'));

                    next();
                })
                .done();
        });

        it('should error out when reading an invalid package meta', function (next) {
            var pkgmeta = path.join(tempPackage, '.package.json');

            return nfn.call(fs.writeFile, pkgmeta, 'w00t')
                .then(function () {
                    return cache.store(tempPackage)
                        .then(function () {
                            next(new Error('Should have failed'));
                        }, function (err) {
                            t.instanceOf(err, Error);
                            t.equal(err.code, 'EMALFORMED');
                            t.include(err.message, path.join(tempPackage, '.package.json'));

                            next();
                        });
                })
                .done();
        });

        it('should move the canonical dir, even if it is in a different drive', function (next) {
            var hittedMock = false;

            fs.rename = function (src, dest, cb) {
                hittedMock = true;

                setTimeout(function () {
                    var err = new Error();
                    err.code = 'EXDEV';
                    cb(err);
                }, 10);
            };

            cache.store(tempPackage, {
                name: 'foo',
                _source: 'foobar',
                _target: 'some-branch'
            })
                .then(function (dir) {
                    // Ensure mock was called
                    t.isTrue(hittedMock);

                    t.equal(dir, path.join(cacheDir, md5('foobar'), 'some-branch'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should update the in-memory cache', function (next) {
            // Feed the cache
            cache.versions('test-in-memory')
                // Copy temp package to temp package  2
                .then(function () {
                    return copy.copyDir(tempPackage, tempPackage2, {ignore: ['.git']});
                })
                // Store the two packages
                .then(function () {
                    return cache.store(tempPackage, {
                        name: 'foo',
                        version: '1.0.0',
                        _source: 'test-in-memory',
                        _target: '*'
                    });
                })
                .then(function () {
                    return cache.store(tempPackage2, {
                        name: 'foo',
                        version: '1.0.1',
                        _source: 'test-in-memory',
                        _target: '*'
                    });
                })
                // Cache should have been updated
                .then(function () {
                    return cache.versions('test-in-memory')
                        .then(function (versions) {
                            t.deepEqual(versions, ['1.0.1', '1.0.0']);

                            next();
                        });
                })
                .done();
        });

        it('should url encode target when storing to the fs', function (next) {
            cache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: 'foo/bar'
            })
                .then(function (dir) {
                    t.equal(dir, path.join(cacheDir, md5('foo'), 'foo%2Fbar'));
                    t.isTrue(fs.existsSync(dir));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isFalse(fs.existsSync(tempPackage));

                    next();
                })
                .done();
        });

        it('should be possible to store two package at same time', function (next) {
            var store = cache.store.bind(cache, tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: 'foo/bar'
            });
            var store2 = cache.store.bind(cache, tempPackage2, {
                name: 'foo',
                _source: 'foo',
                _target: 'foo/bar'
            });

            when.all([store(), store2()]).then(function (dirs) {
                var dir = dirs[0];
                t.equal(dir, path.join(cacheDir, md5('foo'), 'foo%2Fbar'));
                t.isTrue(fs.existsSync(dir));
                t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                t.isFalse(fs.existsSync(tempPackage));
                t.isFalse(fs.existsSync(tempPackage2));

                next();
            }).done();
        });
    });

    describe('.versions', function () {
        it('should resolve to an array', function (next) {
            cache.versions(String(Math.random()))
                .then(function (versions) {
                    t.typeOf(versions, 'array');
                    next();
                })
                .done();
        });

        it('should ignore non-semver folders of the source', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, 'foo'));

            cache.versions(source)
                .then(function (versions) {
                    t.notInclude(versions, 'foo');
                    t.include(versions, '0.0.1');
                    t.include(versions, '0.1.0');
                    next();
                })
                .done();
        });

        it('should order the versions', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0-rc.1'));

            cache.versions(source)
                .then(function (versions) {
                    t.deepEqual(versions, ['0.1.0', '0.1.0-rc.1', '0.0.1']);
                    next();
                })
                .done();
        });

        it('should cache versions to speed-up subsequent calls', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            cache.versions(source)
                .then(function () {
                    // Remove folder
                    fs.removeSync(sourceDir);

                    return cache.versions(source);
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.0.1']);
                    next();
                })
                .done();
        });
    });

    describe('.retrieve', function () {
        it('should resolve to empty if there are no packages for the requested source', function (next) {
            cache.retrieve(String(Math.random()))
                .spread(function () {
                    t.equal(arguments.length, 0);
                    next();
                })
                .done();
        });

        it('should resolve to empty if there are no suitable packages for the requested target', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, '0.1.9'));
            fs.mkdirSync(path.join(sourceDir, '0.2.0'));

            cache.retrieve(source, '~0.3.0')
                .spread(function () {
                    t.equal(arguments.length, 0);

                    return cache.retrieve(source, 'some-branch');
                })
                .spread(function () {
                    t.equal(arguments.length, 0);

                    next();
                })
                .done();
        });

        it('should remove invalid packages from the cache if their package meta is missing or invalid', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, '0.1.9'));
            fs.mkdirSync(path.join(sourceDir, '0.2.0'));

            // Create an invalid package meta
            fs.writeFileSync(path.join(sourceDir, '0.2.0', '.package.json'), 'w00t');

            cache.retrieve(source, '~0.1.0')
                .spread(function () {
                    var dirs = fs.readdirSync(sourceDir);

                    t.equal(arguments.length, 0);
                    t.include(dirs, '0.0.1');
                    t.include(dirs, '0.2.0');
                    next();
                })
                .done();
        });

        it('should resolve to the highest package that matches a range target, ignoring pre-releases', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {name: 'foo'};

            // Create some versions
            fs.mkdirSync(sourceDir);

            json.version = '0.0.1';
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.writeFileSync(path.join(sourceDir, '0.0.1', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0';
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.writeFileSync(path.join(sourceDir, '0.1.0', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0-rc.1';
            fs.mkdirSync(path.join(sourceDir, '0.1.0-rc.1'));
            fs.writeFileSync(path.join(sourceDir, '0.1.0-rc.1', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.9';
            fs.mkdirSync(path.join(sourceDir, '0.1.9'));
            fs.writeFileSync(path.join(sourceDir, '0.1.9', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.2.0';
            fs.mkdirSync(path.join(sourceDir, '0.2.0'));
            fs.writeFileSync(path.join(sourceDir, '0.2.0', '.package.json'), JSON.stringify(json, null, '  '));

            cache.retrieve(source, '~0.1.0')
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.version, '0.1.9');
                    t.equal(canonicalDir, path.join(sourceDir, '0.1.9'));

                    return cache.retrieve(source, '*');
                })
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.version, '0.2.0');
                    t.equal(canonicalDir, path.join(sourceDir, '0.2.0'));

                    next();
                })
                .done();
        });

        it('should resolve to the highest package that matches a range target, not ignoring pre-releases if they are the only versions', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {name: 'foo'};

            // Create some versions
            fs.mkdirSync(sourceDir);

            json.version = '0.1.0-rc.1';
            fs.mkdirSync(path.join(sourceDir, '0.1.0-rc.1'));
            fs.writeFileSync(path.join(sourceDir, '0.1.0-rc.1', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0-rc.2';
            fs.mkdirSync(path.join(sourceDir, '0.1.0-rc.2'));
            fs.writeFileSync(path.join(sourceDir, '0.1.0-rc.2', '.package.json'), JSON.stringify(json, null, '  '));

            cache.retrieve(source, '~0.1.0-rc')
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.version, '0.1.0-rc.2');
                    t.equal(canonicalDir, path.join(sourceDir, '0.1.0-rc.2'));

                    next();
                })
                .done();
        });

        it('should resolve to exact match (including build metadata) if available', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {name: 'foo'};
            var encoded;

            // Create some versions
            fs.mkdirSync(sourceDir);

            json.version = '0.1.0';
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.writeFileSync(path.join(sourceDir, '0.1.0', '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0+build.4';
            encoded = encodeURIComponent('0.1.0+build.4');
            fs.mkdirSync(path.join(sourceDir, encoded));
            fs.writeFileSync(path.join(sourceDir, encoded, '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0+build.5';
            encoded = encodeURIComponent('0.1.0+build.5');
            fs.mkdirSync(path.join(sourceDir, encoded));
            fs.writeFileSync(path.join(sourceDir, encoded, '.package.json'), JSON.stringify(json, null, '  '));

            json.version = '0.1.0+build.6';
            encoded = encodeURIComponent('0.1.0+build.6');
            fs.mkdirSync(path.join(sourceDir, encoded));
            fs.writeFileSync(path.join(sourceDir, encoded, '.package.json'), JSON.stringify(json, null, '  '));

            cache.retrieve(source, '0.1.0+build.5')
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.equal(pkgmeta.version, '0.1.0+build.5');
                    t.equal(canonicalDir, path.join(sourceDir, encodeURIComponent('0.1.0+build.5')));

                    next();
                })
                .done();
        });

        it('should resolve to the _wildcard package if target is * and there are no semver versions', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {name: 'foo'};

            // Create some versions
            fs.mkdirSync(sourceDir);

            fs.mkdirSync(path.join(sourceDir, '_wildcard'));
            fs.writeFileSync(path.join(sourceDir, '_wildcard', '.package.json'), JSON.stringify(json, null, '  '));

            cache.retrieve(source, '*')
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.equal(canonicalDir, path.join(sourceDir, '_wildcard'));

                    next();
                })
                .done();
        });

        it('should resolve to the exact target it\'s not a semver range', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {name: 'foo'};

            // Create some versions
            fs.mkdirSync(sourceDir);

            fs.mkdirSync(path.join(sourceDir, 'some-branch'));
            fs.writeFileSync(path.join(sourceDir, 'some-branch', '.package.json'), JSON.stringify(json, null, '  '));

            fs.mkdirSync(path.join(sourceDir, 'other-branch'));
            fs.writeFileSync(path.join(sourceDir, 'other-branch', '.package.json'), JSON.stringify(json, null, '  '));

            cache.retrieve(source, 'some-branch')
                .spread(function (canonicalDir, pkgmeta) {
                    t.typeOf(pkgmeta, 'object');
                    t.notProperty(pkgmeta, 'version');

                    next();
                })
                .done();
        });
    });

    describe('.eliminate', function () {
        beforeEach(function () {
            fs.mkdirpSync(cacheDir);
        });

        it('should delete the source-md5/version folder', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));

            cache.eliminate({
                name: 'foo',
                version: '0.0.1',
                _source: source,
                _target: '*'
            })
                .then(function () {
                    t.isFalse(fs.existsSync(path.join(sourceDir, '0.0.1')));
                    t.isTrue(fs.existsSync(path.join(sourceDir, '0.1.0')));

                    next();
                })
                .done();
        });

        it('should delete the source-md5/target folder', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, 'some-branch'));

            cache.eliminate({
                name: 'foo',
                _source: source,
                _target: 'some-branch'
            })
                .then(function () {
                    t.isFalse(fs.existsSync(path.join(sourceDir, 'some-branch')));
                    t.isTrue(fs.existsSync(path.join(sourceDir, '0.0.1')));

                    next();
                })
                .done();
        });

        it('should delete the source-md5/_wildcard folder', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '_wildcard'));

            cache.eliminate({
                name: 'foo',
                _source: source,
                _target: '*'
            })
                .then(function () {
                    t.isFalse(fs.existsSync(path.join(sourceDir, '_wildcard')));
                    t.isTrue(fs.existsSync(path.join(sourceDir, '0.0.1')));

                    next();
                })
                .done();
        });

        it('should delete the source-md5 folder if empty', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            cache.eliminate({
                name: 'foo',
                version: '0.0.1',
                _source: source,
                _target: '*'
            })
                .then(function () {
                    t.isFalse(fs.existsSync(path.join(sourceDir, '0.0.1')));
                    t.isFalse(fs.existsSync(path.join(sourceDir)));

                    next();
                })
                .done();
        });

        it('should remove entry from in memory cache if the source-md5 folder was deleted', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            // Feed up the cache
            cache.versions(source)
                // Eliminate
                .then(function () {
                    return cache.eliminate({
                        name: 'foo',
                        version: '0.0.1',
                        _source: source,
                        _target: '*'
                    });
                })
                .then(function () {
                    // At this point the parent folder should be deleted
                    // To test against the in-memory cache, we create a folder
                    // manually and request the versions
                    fs.mkdirpSync(path.join(sourceDir, '0.0.2'));

                    cache.versions(source)
                        .then(function (versions) {
                            t.deepEqual(versions, ['0.0.2']);

                            next();
                        });
                })
                .done();
        });
    });

    describe('.clear', function () {
        beforeEach(function () {
            fs.mkdirpSync(cacheDir);
        });

        it('should empty the whole cache folder', function () {
            cache.clear();
            var files;

            t.isTrue(fs.existsSync(cacheDir));

            files = fs.readdirSync(cacheDir);
            t.equal(files.length, 0);
        });

        it('should erase the in-memory cache', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            // Feed the in-memory cache
            cache.versions(source)
                // Clear
                .then(function () {
                    return cache.clear();
                })
                .then(function () {
                    // To test against the in-memory cache, we create a folder
                    // manually and request the versions
                    fs.mkdirpSync(path.join(sourceDir, '0.0.2'));

                    cache.versions(source)
                        .then(function (versions) {
                            t.deepEqual(versions, ['0.0.2']);

                            next();
                        });
                })
                .done();
        });
    });

    describe('.reset', function () {
        it('should erase the in-memory cache', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            // Feed the in-memory cache
            cache.versions(source)
                .then(function () {
                    // Delete 0.0.1 and create 0.0.2
                    fs.rmdirSync(path.join(sourceDir, '0.0.1'));
                    fs.mkdirSync(path.join(sourceDir, '0.0.2'));

                    // Reset cache
                    cache.reset();

                    // Get versions
                    return cache.versions(source);
                })
                .then(function (versions) {
                    t.deepEqual(versions, ['0.0.2']);

                    next();
                })
                .done();
        });
    });

    describe('.list', function () {
        beforeEach(function () {
            fs.removeSync(cacheDir);
            fs.mkdirpSync(cacheDir);
        });

        it('should resolve to an empty array if the cache is empty', function (next) {
            cache.list()
                .then(function (entries) {
                    t.typeOf(entries, 'array');
                    t.equal(entries.length, 0);

                    next();
                })
                .done();
        });

        it('should resolve to an ordered array of entries (name ASC, release ASC)', function () {
            var source = 'list-package-1';
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            var source2 = 'list-package-2';
            var sourceId2 = md5(source2);
            var sourceDir2 = path.join(cacheDir, sourceId2);

            var json = {
                name: 'foo'
            };

            // Create some versions for different sources
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            json.version = '0.0.1';
            fs.writeFileSync(path.join(sourceDir, '0.0.1', '.package.json'), JSON.stringify(json, null, '  '));

            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            json.version = '0.1.0';
            fs.writeFileSync(path.join(sourceDir, '0.1.0', '.package.json'), JSON.stringify(json, null, '  '));

            delete json.version;

            fs.mkdirSync(path.join(sourceDir, 'foo'));
            json._target = 'foo';
            fs.writeFileSync(path.join(sourceDir, 'foo', '.package.json'), JSON.stringify(json, null, '  '));

            fs.mkdirSync(path.join(sourceDir, 'bar'));
            json._target = 'bar';
            fs.writeFileSync(path.join(sourceDir, 'bar', '.package.json'), JSON.stringify(json, null, '  '));

            fs.mkdirSync(path.join(sourceDir, 'aa'));
            json._target = 'aa';
            fs.writeFileSync(path.join(sourceDir, 'aa', '.package.json'), JSON.stringify(json, null, '  '));

            delete json._target;

            fs.mkdirSync(sourceDir2);
            fs.mkdirSync(path.join(sourceDir2, '0.2.1'));
            json.version = '0.2.1';
            fs.writeFileSync(path.join(sourceDir2, '0.2.1', '.package.json'), JSON.stringify(json, null, '  '));

            fs.mkdirSync(path.join(sourceDir2, '0.2.0'));
            json.name = 'abc';
            json.version = '0.2.0';
            fs.writeFileSync(path.join(sourceDir2, '0.2.0', '.package.json'), JSON.stringify(json, null, '  '));

            return cache.list()
                .then(function (entries) {
                    var expectedJson;
                    var bowerDir = path.join(__dirname, './..');

                    t.typeOf(entries, 'array');

                    expectedJson = fs.readFileSync(path.join(__dirname, './fixtures/cache/list-json-1.json'));
                    expectedJson = expectedJson.toString().trim();

                    mout.object.forOwn(entries, function (entry) {
                        // Trim absolute bower path from json
                        entry.canonicalDir = entry.canonicalDir.substr(bowerDir.length);
                        // Convert windows \ paths to /
                        entry.canonicalDir = entry.canonicalDir.replace(/\\/g, '/');
                    });

                    json = JSON.stringify(entries, null, '  ');
                    t.equal(json, expectedJson);
                });
        });

        it('should ignore lurking files where dirs are expected', function (next) {
            var source = 'list-package-1';
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {
                name: 'foo'
            };

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            json.version = '0.0.1';
            fs.writeFileSync(path.join(sourceDir, '0.0.1', '.package.json'), JSON.stringify(json, null, '  '));

            // Create lurking files
            fs.writeFileSync(path.join(cacheDir, 'foo'), 'w00t');
            fs.writeFileSync(path.join(cacheDir, '.DS_Store'), '');
            fs.writeFileSync(path.join(sourceDir, 'foo'), 'w00t');
            fs.writeFileSync(path.join(sourceDir, '.DS_Store'), '');

            // It should not error out
            cache.list()
                .then(function (entries) {
                    t.typeOf(entries, 'array');
                    t.equal(entries.length, 1);
                    t.deepEqual(entries[0].pkgmeta, json);

                    // Lurking file should have been removed
                    t.isFalse(fs.existsSync(path.join(cacheDir, 'foo')));
                    t.isFalse(fs.existsSync(path.join(cacheDir, '.DS_Store')));
                    t.isFalse(fs.existsSync(path.join(sourceDir, 'foo')));
                    t.isFalse(fs.existsSync(path.join(sourceDir, '.DS_Store')));

                    next();
                })
                .done();

        });

        it('should delete entries if failed to read package meta', function (next) {
            var source = 'list-package-1';
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);
            var json = {
                name: 'foo'
            };

            // Create invalid versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            fs.mkdirSync(path.join(sourceDir, '0.0.2'));
            fs.writeFileSync(path.join(sourceDir, '0.0.2', '.package.json'), 'w00t');

            // Create valid version
            fs.mkdirSync(path.join(sourceDir, '0.0.3'));
            json.version = '0.0.3';
            fs.writeFileSync(path.join(sourceDir, '0.0.3', '.package.json'), JSON.stringify(json, null, '  '));

            // It should not error out
            cache.list()
                .then(function (entries) {
                    t.typeOf(entries, 'array');
                    t.equal(entries.length, 1);
                    t.deepEqual(entries[0].pkgmeta, json);

                    // Packages with invalid metas should have been removed
                    t.isFalse(fs.existsSync(path.join(sourceDir, '0.0.1')));
                    t.isFalse(fs.existsSync(path.join(sourceDir, '0.0.2')));

                    next();
                })
                .done();
        });
    });

    describe('#clearRuntimeCache', function () {
        it('should clear the in-memory cache for all sources', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            var source2 = String(Math.random());
            var sourceId2 = md5(source2);
            var sourceDir2 = path.join(cacheDir, sourceId2);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(sourceDir2);
            fs.mkdirSync(path.join(sourceDir2, '0.0.2'));

            // Feed the cache
            cache.versions(source)
                .then(function () {
                    return cache.versions(source2);
                })
                .then(function () {
                    // Create some more
                    fs.mkdirSync(path.join(sourceDir, '0.0.3'));
                    fs.mkdirSync(path.join(sourceDir2, '0.0.4'));

                    // Reset cache
                    Cache.clearRuntimeCache();
                })
                .then(function () {
                    return cache.versions(source)
                        .then(function (versions) {
                            t.deepEqual(versions, ['0.0.3', '0.0.1']);

                            return cache.versions(source2);
                        })
                        .then(function (versions) {
                            t.deepEqual(versions, ['0.0.4', '0.0.2']);

                            next();
                        });
                })
                .done();
        });
    });
});
