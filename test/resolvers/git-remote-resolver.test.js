var t = require('chai').assert;
var path = require('path');
var fs = require('fs-extra');
var Logger = require('bower-logger');
var GitRemoteResolver = require('../../lib/resolvers/git-remote-resolver');
var npdconf = require('../../lib/npdconf');

describe('GitRemoteResolver', function () {
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var logger;
    var config = npdconf();

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function clearResolverRuntimeCache() {
        GitRemoteResolver.clearRuntimeCache();
    }

    function create(endpoint) {
        if (typeof endpoint === 'string') {
            endpoint = { source: endpoint };
        }

        return new GitRemoteResolver(endpoint, config, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver;

            resolver = create('file://' + testPackage);
            t.equal(resolver.getName(), 'package-a');

            resolver = create('git://github.com/twitter/bower.git');
            t.equal(resolver.getName(), 'bower');

            resolver = create('git://github.com/twitter/bower');
            t.equal(resolver.getName(), 'bower');

            resolver = create('git://github.com');
            t.equal(resolver.getName(), 'github.com');
        });
    });

    describe('.resolve', function () {
        it('should checkout correctly if resolution is a branch', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: 'some-branch' });

            resolver.resolve()
                .then(function (dir) {
                    t.typeOf(dir, 'string');

                    var files = fs.readdirSync(dir);
                    var fooContents;

                    t.include(files, 'foo');
                    t.include(files, 'baz');
                    t.include(files, 'baz');

                    fooContents = fs.readFileSync(path.join(dir, 'foo')).toString();
                    t.equal(fooContents, 'foo foo');

                    next();
                })
                .done();
        });

        it('should checkout correctly if resolution is a tag', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: '~0.0.1' });

            resolver.resolve()
                .then(function (dir) {
                    t.typeOf(dir, 'string');

                    var files = fs.readdirSync(dir);

                    t.include(files, 'foo');
                    t.include(files, 'bar');
                    t.notInclude(files, 'baz');

                    next();
                })
                .done();
        });

        it('should checkout correctly if resolution is a commit', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: 'bdae0b646cb6b58698da3961572fcf65a1863530' });

            resolver.resolve()
                .then(function (dir) {
                    t.typeOf(dir, 'string');

                    var files = fs.readdirSync(dir);

                    t.notInclude(files, 'foo');
                    t.notInclude(files, 'bar');
                    t.notInclude(files, 'baz');
                    t.include(files, '.master');
                    next();
                })
                .done();
        });

        it.skip('should handle gracefully servers that do not support --depth=1');
        it.skip('should report progress when it takes too long to clone');
    });

    describe('#refs', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to the references of the remote repository', function (next) {
            GitRemoteResolver.refs('file://' + testPackage)
                .then(function (refs) {
                    // Remove master and test only for the first 7 refs
                    refs = refs.slice(1, 8);

                    t.deepEqual(refs, [
                        'ed0ed82d2dfc059a0dc549994de6addb691395d6 refs/heads/some-branch',
                        '2c10f870c10de854c6a3bf35bbd58fcccee9480f refs/tags/0.0.1',
                        '7e3507824cd7c37b3e0a58ba2bc9b3953e21e643 refs/tags/0.0.2',
                        '17530bbd111a617e2d58b885594625812d9c43ec refs/tags/0.1.0',
                        '7dfbfd5a1e65e8000b6393f7f0827d1e989e3981 refs/tags/0.1.1',
                        'dc279fb4d62eac2bf958e7995a6968710c0e6af7 refs/tags/0.2.0',
                        '7f1882ba55377538c49a157e261797942c59c7c7 refs/tags/0.2.1'
                    ]);
                    next();
                })
                .done();
        });

        it('should cache the results', function (next) {
            var source = 'file://' + testPackage;

            GitRemoteResolver.refs(source)
                .then(function () {
                    // Manipulate the cache and check if it resolves for the cached ones
                    GitRemoteResolver._cache.refs.get(source).splice(0, 1);

                    // Check if it resolver to the same array
                    return GitRemoteResolver.refs('file://' + testPackage);
                })
                .then(function (refs) {
                    // Test only for the first 7 refs
                    refs = refs.slice(0, 7);

                    t.deepEqual(refs, [
                        'ed0ed82d2dfc059a0dc549994de6addb691395d6 refs/heads/some-branch',
                        '2c10f870c10de854c6a3bf35bbd58fcccee9480f refs/tags/0.0.1',
                        '7e3507824cd7c37b3e0a58ba2bc9b3953e21e643 refs/tags/0.0.2',
                        '17530bbd111a617e2d58b885594625812d9c43ec refs/tags/0.1.0',
                        '7dfbfd5a1e65e8000b6393f7f0827d1e989e3981 refs/tags/0.1.1',
                        'dc279fb4d62eac2bf958e7995a6968710c0e6af7 refs/tags/0.2.0',
                        '7f1882ba55377538c49a157e261797942c59c7c7 refs/tags/0.2.1'
                    ]);
                    next();
                })
                .done();
        });
    });
});
