"use strict";

var t = require('chai').assert;
var path = require('path');
var fs = require('fs-extra');
var nock = require('nock');
var when = require('when');
var nfn = require('when/node');
var Logger = require('../../lib/logger');
var sh = require('../../lib/utils/sh');
var UrlResolver = require('../../lib/resolvers/url-resolver');
var npdconf = require('../../lib/npdconf');

describe('UrlResolver', function () {
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var tempDir = path.resolve(__dirname, '../tmp/tmp');
    var logger;
    var config = npdconf();

    before(function (next) {
        logger = new Logger();

        // Checkout test package version 0.2.1
        sh.exec('git', ['checkout', '0.2.1'], { cwd: testPackage })
            .then(next.bind(next, null), next);
    });

    afterEach(function () {
        logger.removeAllListeners();

        // Clean nocks
        nock.cleanAll();
    });

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new UrlResolver(endpoint, config, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the URL', function () {
            var resolver = create('http://bower.io/foo.txt');

            t.equal(resolver.getName(), 'foo');
        });

        it('should remove ?part from the URL when guessing the name', function () {
            var resolver = create('http://bower.io/foo.txt?bar');

            t.equal(resolver.getName(), 'foo');
        });

        it('should not guess the name or remove ?part from the URL if not guessing', function () {
            var resolver = create({ source: 'http://bower.io/foo.txt?bar', name: 'baz' });

            t.equal(resolver.getName(), 'baz');
        });

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
        before(function () {
            fs.mkdirpSync(tempDir);
        });

        afterEach(function (next) {
            fs.remove(path.join(tempDir, '.package.json'), next);
        });

        after(function (next) {
            fs.remove(tempDir, next);
        });

        it('should resolve to true if the response is not in the 2xx range', function (next) {
            var resolver = create('http://bower.io/foo.js');

            nock('http://bower.io')
                .head('/foo.js')
                .reply(500);

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0'
            }));

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should resolve to true if cache headers changed', function (next) {
            var resolver = create('http://bower.io/foo.js');

            nock('http://bower.io')
                .head('/foo.js')
                .reply(200, '', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': 'fk3454fdmmlw20i9nf',
                    'Last-Modified': 'Tue, 16 Nov 2012 13:35:29 GMT'
                }
            }));

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isTrue(hasNew);
                    next();
                })
                .done();
        });

        it('should resolve to false if cache headers haven\'t changed', function (next) {
            var resolver = create('http://bower.io/foo.js');

            nock('http://bower.io')
                .head('/foo.js')
                .reply(200, '', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isFalse(hasNew);
                    next();
                })
                .done();
        });

        it('should resolve to true if server responds with 304 (ETag mechanism)', function (next) {
            var resolver = create('http://bower.io/foo.js');

            nock('http://bower.io')
                .head('/foo.js')
                .matchHeader('If-None-Match', '686897696a7c876b7e')
                .reply(304, '', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });

            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isFalse(hasNew);
                    next();
                })
                .done();
        });

        it('should work with redirects', function (next) {
            var redirectingUrl = 'http://redirecting-url.com';
            var redirectingToUrl = 'http://bower.io';
            var resolver;

            nock(redirectingUrl)
                .head('/foo.js')
                .reply(302, '', { location: redirectingToUrl + '/foo.js' });

            nock(redirectingToUrl)
                .head('/foo.js')
                .reply(200, 'foo contents', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });


            fs.writeFileSync(path.join(tempDir, '.package.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver = create(redirectingUrl + '/foo.js');

            resolver.hasNew(tempDir)
                .then(function (hasNew) {
                    t.isFalse(hasNew);
                    next();
                })
                .done();
        });
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

        it('should download file, renaming it to index', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/foo.js')
                .reply(200, 'foo contents');

            resolver = create('http://bower.io/foo.js');

            resolver.resolve()
                .then(function (dir) {
                    var contents;

                    t.isTrue(fs.existsSync(path.join(dir, 'index.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'foo.js')));

                    contents = fs.readFileSync(path.join(dir, 'index.js')).toString();
                    t.equal(contents, 'foo contents');

                    assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should extract if source is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'));

            resolver = create('http://bower.io/package-zip.zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip.zip')));
                    next();
                })
                .done();
        });

        it('should extract if source is an archive (case insensitive)', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip.ZIP')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'));

            resolver = create('http://bower.io/package-zip.ZIP');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip.ZIP')));
                    next();
                })
                .done();
        });

        it('should copy extracted folder contents if archive contains only a folder inside', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip-folder.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip-folder.zip'));

            nock('http://bower.io')
                .get('/package-zip.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip-folder.zip'));

            resolver = create('http://bower.io/package-zip-folder.zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-folder')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-folder.zip')));

                    resolver = create({ source: 'http://bower.io/package-zip.zip', name: 'package-zip' });

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip.zip')));

                    next();
                })
                .done();
        });

        it('should extract if source is an archive and rename to index if it\'s only one file inside', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip-single-file.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip-single-file.zip'));

            resolver = create('http://bower.io/package-zip-single-file.zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'index.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-single-file')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-single-file.zip')));

                    return assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should extract if source is an archive and not rename to index if inside it\'s just a just package.json file in it', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip-single-package-json.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip-single-package-json.zip'));

            resolver = create('http://bower.io/package-zip-single-package-json.zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'package.json')));

                    next();
                })
                .done();
        });

        it('should rename single file from a single folder to index when source is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip-folder-single-file.zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip-folder-single-file.zip'));

            resolver = create('http://bower.io/package-zip-folder-single-file.zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'index.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-folder-single-file')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip-folder-single-file.zip')));

                    return assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should extract if response content-type is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                    'Content-Type': 'application/zip'
                })

                .get('/package-zip2')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                    'Content-Type': 'application/zip; charset=UTF-8'
                })

                .get('/package-zip3')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                    'Content-Type': ' application/zip ; charset=UTF-8'
                })

                .get('/package-zip4')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                    'Content-Type': '"application/x-zip"'  // Test with quotes
                })

                .get('/package-tar')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-tar.tar.gz'), {
                    'Content-Type': ' application/x-tgz ; charset=UTF-8'
                })

                .get('/package-tar.tar.gz')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-tar.tar.gz'), {
                    'Content-Type': ' application/x-tgz ; charset=UTF-8'
                })

                .get('/package-tar2.tar.gz')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-tar.tar.gz'), {
                    'Content-Type': ' application/octet-stream ; charset=UTF-8'
                });

            resolver = create('http://bower.io/package-zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip.zip')));

                    resolver = create('http://bower.io/package-zip2');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip3.zip')));

                    resolver = create('http://bower.io/package-zip3');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip4.zip')));

                    resolver = create('http://bower.io/package-zip4');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar')));

                    resolver = create('http://bower.io/package-tar');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar.tar.gz')));

                    resolver = create('http://bower.io/package-tar.tar.gz');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar.tar.gz')));

                    resolver = create('http://bower.io/package-tar2.tar.gz');

                    return resolver.resolve();
                })
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar.tar.gz')));

                    next();
                })
                .done();
        });

        it('should extract if response content-disposition filename is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/package-zip')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                    'Content-Disposition': 'attachment; filename="package-zip.zip"'
                });

            resolver = create('http://bower.io/package-zip');

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-zip.zip')));
                    next();
                })
                .done();
        });

        it('should save the release if there\'s a E-Tag', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/foo.js')
                .reply(200, 'foo contents', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });

            resolver = create('http://bower.io/foo.js');

            resolver.resolve()
                .then(function (dir) {
                    assertMain(dir, 'index.js')
                        .then(function (pkgMeta) {
                            t.equal(pkgMeta._release, 'e-tag:686897696a');
                            next();
                        });
                })
                .done();
        });

        it('should allow for query strings in URL', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/foo.js?bar=baz')
                .reply(200, 'foo contents');

            resolver = create('http://bower.io/foo.js?bar=baz');

            resolver.resolve()
                .then(function (dir) {
                    var contents;

                    t.isTrue(fs.existsSync(path.join(dir, 'index.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'foo.js?bar=baz')));

                    contents = fs.readFileSync(path.join(dir, 'index.js')).toString();
                    t.equal(contents, 'foo contents');

                    assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it('should save cache headers', function (next) {
            var resolver;

            nock('http://bower.io')
                .get('/foo.js')
                .reply(200, 'foo contents', {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                });

            resolver = create('http://bower.io/foo.js');

            resolver.resolve()
                .then(function (dir) {
                    assertMain(dir, 'index.js')
                        .then(function (pkgMeta) {
                            t.deepEqual(pkgMeta._cacheHeaders, {
                                'ETag': '686897696a7c876b7e',
                                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                            });
                            next();
                        });
                })
                .done();
        });

        it('should work with redirects', function (next) {
            var redirectingUrl = 'http://redirecting-url.com';
            var redirectingToUrl = 'http://bower.io';
            var resolver;

            nock(redirectingUrl)
                .get('/foo.js')
                .reply(302, '', {
                    location: redirectingToUrl + '/foo.js'
                });

            nock(redirectingToUrl)
                .get('/foo.js')
                .reply(200, 'foo contents');

            resolver = create(redirectingUrl + '/foo.js');

            resolver.resolve()
                .then(function (dir) {
                    var contents;

                    t.isTrue(fs.existsSync(path.join(dir, 'index.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'foo.js')));

                    contents = fs.readFileSync(path.join(dir, 'index.js')).toString();
                    t.equal(contents, 'foo contents');

                    assertMain(dir, 'index.js')
                        .then(next.bind(next, null));
                })
                .done();
        });

        it.skip('it should error out if the status code is not within 200-299');

        it.skip('should report progress when it takes too long to download');

        describe('content-disposition validation', function () {
            function performTest(header, extraction) {
                var resolver;

                nock('http://bower.io')
                    .get('/package-zip')
                    .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-zip.zip'), {
                        'Content-Disposition': header
                    });

                resolver = create('http://bower.io/package-zip');

                return resolver.resolve()
                    .then(function (dir) {
                        if (extraction) {
                            t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                            t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                            t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                        } else {
                            t.isFalse(fs.existsSync(path.join(dir, 'foo.js')));
                            t.isFalse(fs.existsSync(path.join(dir, 'bar.js')));
                            t.isFalse(fs.existsSync(path.join(dir, 'package-zip')));
                            t.isTrue(fs.existsSync(path.join(dir, 'index')));
                        }
                    });
            }

            it('should work with and without quotes', function (next) {
                performTest('attachment; filename="package-zip.zip"', true)
                    .then(function () {
                        return performTest('attachment; filename=package-zip.zip', true);
                    })
                    .then(next.bind(next, null))
                    .done();
            });

            it('should not work with partial quotes', function (next) {
                performTest('attachment; filename="package-zip.zip', false)
                    .then(function () {
                        // This one works, and the last quote is simply ignored
                        return performTest('attachment; filename=package-zip.zip"', true);
                    })
                    .then(next.bind(next, null))
                    .done();
            });

            it('should not work if the filename contain chars other than alphanumerical, dashes, spaces and dots', function (next) {
                performTest('attachment; filename="1package01 _-zip.zip"', true)
                    .then(function () {
                        return performTest('attachment; filename="package$%"', false);
                    })
                    .then(function () {
                        return performTest('attachment; filename=packagé', false);
                    })
                    .then(function () {
                        // This one works, but since the filename is truncated once a space is found
                        // the extraction will not happen because the file has no .zip extension
                        return performTest('attachment; filename=1package01 _-zip.zip"', false);
                    })
                    .then(function () {
                        return performTest('attachment; filename=1package01.zip _-zip.zip"', true);
                    })
                    .then(next.bind(next, null))
                    .done();
            });

            it('should trim leading and trailing spaces', function (next) {
                performTest('attachment; filename=" package.zip "', true)
                    .then(next.bind(next, null))
                    .done();
            });

            it('should not work if the filename ends with a dot', function (next) {
                performTest('attachment; filename="package.zip."', false)
                    .then(function () {
                        return performTest('attachment; filename="package.zip. "', false);
                    })
                    .then(function () {
                        return performTest('attachment; filename=package.zip.', false);
                    })
                    .then(function () {
                        return performTest('attachment; filename="package.zip ."', false);
                    })
                    .then(function () {
                        return performTest('attachment; filename="package.zip. "', false);
                    })
                    .then(next.bind(next, null))
                    .done();
            });

            it('should be case insensitive', function (next) {
                performTest('attachment; FILENAME="package.zip"', true)
                    .then(function () {
                        return performTest('attachment; filename="package.ZIP"', true);
                    })
                    .then(function () {
                        return performTest('attachment; FILENAME=package.zip', true);
                    })
                    .then(function () {
                        return performTest('attachment; filename=package.ZIP', true);
                    })
                    .then(next.bind(next, null))
                    .done();
            });
        });
    });

    describe('#isTargetable', function () {
        it('should return false', function () {
            t.isFalse(UrlResolver.isTargetable());
        });
    });
});
