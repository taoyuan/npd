var t = require('chai').assert;
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var Logger = require('../../lib/logger');
var sh = require('../../lib/utils/sh');
var copy = require('../../lib/utils/copy');
var npdconf = require('../../lib/npdconf');
var FsResolver = require('../../lib/resolvers/fs-resolver');

describe('FsResolver', function () {
    var tempSource;
    var logger;
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var config = npdconf();

    before(function (next) {
        logger = new Logger();
        // Checkout test package version 0.2.1 which has a package.json
        // with ignores
        sh.exec('git', ['checkout', '0.2.1'], { cwd: testPackage })
            .then(next.bind(next, null), next);
    });

    afterEach(function (next) {
        logger.removeAllListeners();

        if (tempSource) {
            fs.remove(tempSource, next);
            tempSource = null;
        } else {
            next();
        }
    });

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new FsResolver(endpoint, config, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver = create(path.resolve('../fixtures/package-zip.zip'));

            t.equal(resolver.getName(), 'package-zip');
        });

        it('should make paths absolute and normalized', function () {
            var resolver;

            resolver = create(path.relative(process.cwd(), testPackage));
            t.equal(resolver.getSource(), testPackage);

            resolver = create(testPackage + '/something/..');
            t.equal(resolver.getSource(), testPackage);
        });

        it.skip('should use config.dir for resolving relative paths');

        it('should error out if a target was specified', function (next) {
            var resolver;

            try {
                resolver = create({ source: testPackage, target: '0.0.1' });
            } catch (err) {
                t.instanceOf(err, Error);
                t.match(err.message, /can\'t resolve targets/i);
                t.equal(err.code, 'ENORESTARGET');
                return next();
            }

            next(new Error('Should have thrown'));
        });
    });

    describe('.hasNew', function () {
        it('should resolve always to true (for now..)', function (next) {
            var resolver = create(testPackage);

            tempSource = path.resolve(__dirname, '../tmp/tmp');
            fs.mkdirpSync(tempSource);
            fs.writeFileSync(path.join(tempSource, '.package.json'), JSON.stringify({
                name: 'test'
            }));

            resolver.hasNew(tempSource)
                .then(function (hasNew) {
                    t.ok(hasNew);
                    next();
                })
                .done();
        });

        //it.skip('should be false if the file mtime hasn\'t changed');
        //it.skip('should be false if the directory mtime hasn\'t changed');
        //it.skip('should be true if the file mtime has changed');
        //it.skip('should be true if the directory mtime has changed');
        //it.skip('should ignore files specified to be ignored');
    });

    describe('.resolve', function () {
        // Function to assert that the main property of the
        // package meta of a canonical dir is set to the
        // expected value
        function assertMain(dir, singleFile) {
            return nfn.call(fs.readFile, path.join(dir, '.package.json'))
                .then(function (contents) {
                    var pkgMeta = JSON.parse(contents.toString());

                    t.equal(pkgMeta.main, singleFile);

                    return pkgMeta;
                });
        }

        it('should copy the source directory contents', function (next) {
            var resolver = create(testPackage);

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'foo')));
                    t.ok(fs.existsSync(path.join(dir, 'bar')));
                    t.ok(fs.existsSync(path.join(dir, 'baz')));
                    t.ok(fs.existsSync(path.join(dir, 'README.md')));
                    t.ok(fs.existsSync(path.join(dir, 'more')));
                    t.ok(fs.existsSync(path.join(dir, 'more', 'more-foo')));
                    next();
                })
                .done();
        });

        it('should copy the source file, renaming it to index', function (next) {
            var resolver = create(path.join(testPackage, 'foo'));

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'index')));
                    t.notOk(fs.existsSync(path.join(dir, 'foo')));
                    t.notOk(fs.existsSync(path.join(dir, 'bar')));
                })
                .then(function () {
                    // Test with extension
                    var resolver = create(path.join(testPackage, 'README.md'));
                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'index.md')));
                    t.notOk(fs.existsSync(path.join(dir, 'README.md')));

                    return assertMain(dir, 'index.md')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should rename to index if source is a folder with just one file in it', function (next) {
            var resolver;

            tempSource = path.resolve(__dirname, '../tmp/tmp');

            fs.mkdirpSync(tempSource);
            resolver = create(tempSource);

            copy.copyFile(path.join(testPackage, 'foo'), path.join(tempSource, 'foo'))
                .then(resolver.resolve.bind(resolver))
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'index')));
                    t.notOk(fs.existsSync(path.join(dir, 'foo')));

                    return assertMain(dir, 'index')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should not rename to index if source is a folder with just package.json file in it', function (next) {
            var resolver;

            tempSource = path.resolve(__dirname, '../tmp/tmp');

            fs.mkdirpSync(tempSource);
            resolver = create(tempSource);

            copy.copyFile(path.join(testPackage, 'package.json'), path.join(tempSource, 'package.json'))
                .then(resolver.resolve.bind(resolver))
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'package.json')));

                    fs.removeSync(tempSource);
                    fs.mkdirpSync(tempSource);

                    resolver = create(tempSource);
                })
                .then(function () {
                    return resolver.resolve();
                })
                .then(function () {
                    next();
                });
        });

        it('should copy the source directory permissions', function (next) {
            var mode0777;
            var resolver;

            tempSource = path.resolve(__dirname, '../fixtures/package-a-copy');
            resolver = create(tempSource);

            copy.copyDir(testPackage, tempSource)
                .then(function () {
                    // Change tempSource dir to 0777
                    fs.chmodSync(tempSource, 0777);
                    // Get the mode to a variable
                    mode0777 = fs.statSync(tempSource).mode;
                })
                .then(resolver.resolve.bind(resolver))
                .then(function (dir) {
                    // Check if temporary dir is 0777 instead of default 0777 & ~process.umask()
                    var stat = fs.statSync(dir);
                    t.equal(stat.mode, mode0777);
                    next();
                })
                .done();
        });

        it('should copy the source file permissions', function (next) {
            var mode0777;
            var resolver;

            tempSource = path.resolve(__dirname, '../tmp/temp-source');
            resolver = create(tempSource);

            copy.copyFile(path.join(testPackage, 'foo'), tempSource)
                .then(function () {
                    // Change tempSource dir to 0777
                    fs.chmodSync(tempSource, 0777);
                    // Get the mode to a variable
                    mode0777 = fs.statSync(tempSource).mode;
                })
                .then(resolver.resolve.bind(resolver))
                .then(function (dir) {
                    // Check if file is 0777
                    var stat = fs.statSync(path.join(dir, 'index'));
                    t.equal(stat.mode, mode0777);
                    next();
                })
                .done();
        });

        it('should not copy ignored paths (to speed up copying)', function (next) {
            var resolver = create(testPackage);

            // Override the _applyPkgMeta function to prevent it from deleting ignored files
            resolver._applyPkgMeta = function () {
                return when.resolve();
            };

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'foo')));
                    t.notOk(fs.existsSync(path.join(dir, 'test')));
                    next();
                })
                .done();
        });

        it('should extract if source is an archive', function (next) {
            var resolver = create(path.resolve(__dirname, '../fixtures/package-zip.zip'));

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'foo.js')));
                    t.ok(fs.existsSync(path.join(dir, 'bar.js')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip.zip')));
                    next();
                })
                .done();
        });

        it('should copy extracted folder contents if archive contains only a folder inside', function (next) {
            var resolver = create(path.resolve(__dirname, '../fixtures/package-zip-folder.zip'));

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'foo.js')));
                    t.ok(fs.existsSync(path.join(dir, 'bar.js')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-folder')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-folder.zip')));
                    next();
                })
                .done();
        });


        it('should extract if source is an archive and rename to index if it\'s only one file inside', function (next) {
            var resolver = create(path.resolve(__dirname, '../fixtures/package-zip-single-file.zip'));

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'index.js')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-single-file')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-single-file.zip')));

                    return assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should rename single file from a single folder to index when source is an archive', function (next) {
            var resolver = create(path.resolve(__dirname, '../fixtures/package-zip-folder-single-file.zip'));

            resolver.resolve()
                .then(function (dir) {
                    t.ok(fs.existsSync(path.join(dir, 'index.js')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-folder-single-file')));
                    t.notOk(fs.existsSync(path.join(dir, 'package-zip-folder-single-file.zip')));

                    return assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });
    });

    describe('#isTargetable', function () {
        it('should return false', function () {
            t.notOk(FsResolver.isTargetable());
        });
    });
});
