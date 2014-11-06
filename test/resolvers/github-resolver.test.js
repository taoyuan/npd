var t = require('chai').assert;
var path = require('path');
var nock = require('nock');
var fs = require('fs-extra');
var logs = require('../../lib/logs');
var GitRemoteResolver = require('../../lib/resolvers/git-remote-resolver');
var GitHubResolver = require('../../lib/resolvers/github-resolver');
var npdconf = require('../../lib/npdconf');

describe('GitHub', function () {
    var logger;
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var config = npdconf({ strictSsl: false });

    before(function () {
        logger = logs.createLogger();
    });

    afterEach(function () {
        // Clean nocks
        nock.cleanAll();

        logger.removeAllListeners();
    });

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new GitHubResolver(endpoint, config, logger);
    }

    describe('.constructor', function () {
        it.skip('should throw an error on invalid GitHub URLs');

        it('should ensure .git in the source', function () {
            var resolver;

            resolver = create('git://github.com/twitter/bower');
            t.equal(resolver.getSource(), 'git://github.com/twitter/bower.git');

            resolver = create('git://github.com/twitter/bower.git');
            t.equal(resolver.getSource(), 'git://github.com/twitter/bower.git');

            resolver = create('git://github.com/twitter/bower.git/');
            t.equal(resolver.getSource(), 'git://github.com/twitter/bower.git');
        });
    });

    describe('.resolve', function () {
        it('should download and extract the .tar.gz archive from GitHub.com', function (next) {
            var resolver;

            nock('https://github.com')
                .get('/IndigoUnited/events-emitter/archive/0.1.0.tar.gz')
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/package-tar.tar.gz'));

            resolver = create({ source: 'git://github.com/IndigoUnited/events-emitter.git', target: '0.1.0' });

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo.js')));
                    t.isTrue(fs.existsSync(path.join(dir, '.package.json')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar.js')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar.tar.gz')));
                    t.isFalse(fs.existsSync(path.join(dir, 'package-tar.tar')));
                    next();
                })
                .done();
        });

        it('should retry using the GitRemoteResolver mechanism if download failed', function (next) {
            var resolver;
            var retried;

            nock('https://github.com')
                .get('/IndigoUnited/events-emitter/archive/0.1.0.tar.gz')
                .reply(200, 'this is not a valid tar');

            logger.on('logged', function (entry) {
                if (entry.level === 'warn' && entry.id === 'retry') {
                    retried = true;
                }
            });

            resolver = create({ source: 'git://github.com/IndigoUnited/events-emitter.git', target: '0.1.0' });

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(retried);
                    t.isTrue(fs.existsSync(path.join(dir, 'foo')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar')));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    next();
                })
                .done();
        });

        it('should retry using the GitRemoteResolver mechanism if extraction failed', function (next) {
            var resolver;
            var retried;

            nock('https://github.com')
                .get('/IndigoUnited/events-emitter/archive/0.1.0.tar.gz')
                .reply(500);

            logger.on('logged', function (entry) {
                if (entry.level === 'warn' && entry.id === 'retry') {
                    retried = true;
                }
            });

            resolver = create({ source: 'git://github.com/IndigoUnited/events-emitter.git', target: '0.1.0' });

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(retried);
                    t.isTrue(fs.existsSync(path.join(dir, 'foo')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar')));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    next();
                })
                .done();
        });

        it('should fallback to the GitRemoteResolver mechanism if resolution is not a tag', function (next) {
            var resolver = create({ source: 'git://github.com/foo/bar.git', target: '17530bbd111a617e2d58b885594625812d9c43ec' });
            var originalCheckout = GitRemoteResolver.prototype._checkout;
            var called;

            GitRemoteResolver.prototype._checkout = function () {
                called = true;
                return originalCheckout.apply(this, arguments);
            };

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

            resolver.resolve()
                .then(function (dir) {
                    t.isTrue(fs.existsSync(path.join(dir, 'foo')));
                    t.isTrue(fs.existsSync(path.join(dir, 'bar')));
                    t.isTrue(fs.existsSync(path.join(dir, 'baz')));
                    t.isTrue(called);
                    next();
                })
                .finally(function () {
                    GitRemoteResolver.prototype._checkout = originalCheckout;
                })
                .done();
        });

        it.skip('it should error out if the status code is not within 200-299');

        it.skip('should report progress if it takes too long to download');
    });

    describe('._savePkgMeta', function () {
        it.skip('should guess the homepage if not already set');
    });
});
