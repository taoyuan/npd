var t = require('chai').assert;
var fs = require('fs-extra');
var path = require('path');
var Logger = require('../../lib/logger');
var sh = require('../../lib/utils/sh');
var copy = require('../../lib/utils/copy');
var GitFsResolver = require('../../lib/resolvers/git-fs-resolver');
var noapconf = require('../../lib/noapconf');

describe('GitFsResolver', function () {
    var tempSource;
    var testPackage = path.resolve(__dirname, '../fixtures/package-a');
    var logger;
    var config = noapconf().load();

    before(function () {
        logger = new Logger();
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

    function clearResolverRuntimeCache() {
        GitFsResolver.clearRuntimeCache();
    }

    function create(decEndpoint) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new GitFsResolver(decEndpoint, config, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver = create(testPackage);

            t.equal(resolver.getName(), 'package-a');
        });

        it('should not guess the name from the path if the name was specified', function () {
            var resolver = create({ source: testPackage, name: 'foo' });

            t.equal(resolver.getName(), 'foo');
        });

        it('should make paths absolute and normalized', function () {
            var resolver;

            resolver = create(path.relative(process.cwd(), testPackage));
            t.equal(resolver.getSource(), testPackage);

            resolver = create(testPackage + '/something/..');
            t.equal(resolver.getSource(), testPackage);
        });

        it.skip('should use config.cwd for resolving relative paths');
    });

    describe('.resolve', function () {
        it('should checkout correctly if resolution is a branch', function (next) {
            var resolver = create({ source: testPackage, target: 'some-branch' });

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
            var resolver = create({ source: testPackage, target: '~0.0.1' });

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
            var resolver = create({ source: testPackage, target: 'bdae0b646cb6b58698da3961572fcf65a1863530' });

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

        it('should remove any un-tracked files and directories', function (next) {
            var resolver = create({ source: testPackage, target: 'bdae0b646cb6b58698da3961572fcf65a1863530' });
            var file = path.join(testPackage, 'new-file');
            var dir = path.join(testPackage, 'new-dir');

            fs.writeFileSync(file, 'foo');
            fs.mkdir(dir);

            function cleanup(err) {
                fs.unlinkSync(file);
                fs.rmdirSync(dir);

                if (err) {
                    throw err;
                }
            }

            resolver.resolve()
                .then(function (dir) {
                    t.typeOf(dir, 'string');

                    var files = fs.readdirSync(dir);

                    t.notInclude(files, 'new-file');
                    t.notInclude(files, 'new-dir');

                    cleanup();
                    next();
                })
                .catch(cleanup)
                .done();
        });

        it('should leave the original repository untouched', function (next) {
            // Switch to master
            sh.exec('git', ['checkout', 'master'], { cwd: testPackage })
                // Resolve to some-branch
                .then(function () {
                    var resolver = create({ source: testPackage, target: 'some-branch' });
                    return resolver.resolve();
                })
                // Check if the original branch is still the master one
                .then(function () {
                    return sh.exec('git', ['branch', '--color=never'], { cwd: testPackage })
                        .spread(function (stdout) {
                            t.include(stdout, '* master');
                        });
                })
                // Check if git status is empty
                .then(function () {
                    return sh.exec('git', ['status', '--porcelain'], { cwd: testPackage })
                        .spread(function (stdout) {
                            stdout = stdout.trim();
                            t.equal(stdout, '');
                            next();
                        });
                })
                .done();
        });

        it('should copy source folder permissions', function (next) {
            var mode0777;
            var resolver;

            tempSource = path.resolve(__dirname, '../fixtures/package-a-copy');
            resolver = create({ source: tempSource, target: 'some-branch' });

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
    });

    describe('#refs', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to the references of the local repository', function (next) {
            GitFsResolver.refs(testPackage)
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
            GitFsResolver.refs(testPackage)
                .then(function () {
                    // Manipulate the cache and check if it resolves for the cached ones
                    GitFsResolver._cache.refs.get(testPackage).splice(0, 1);

                    // Check if it resolver to the same array
                    return GitFsResolver.refs(testPackage);
                })
                .then(function (refs) {
                    // Test only for the first 6 refs
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
