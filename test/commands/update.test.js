var _ = require('lodash');
var t = require('chai').assert;
var object = require('mout').object;
var npd = require('../../lib/npd');
var h = require('../helpers');

describe('command/update', function () {

    var repo, pkg, gitpkg, opts;
    var install, update, updateLogger;

    beforeEach(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir();

        gitpkg = new h.TempDir();

        opts = {cwd: repo.path};
        npd.load(opts, true);
        install = h.command('install');
        update = h.command('update');
        updateLogger = h.commandForLogger('update');
    });

    var files = {
        'package.json': {
            name: 'package',
            bin: {
                "npd-a": './say-hello.js'
            }
        },
        'npd.json': {
            scripts: {
                preinstall: 'bash -c "echo -n package > preinstall.txt"',
                postinstall: 'bash -c "echo -n package > postinstall.txt"',
                preuninstall: 'bash -c "echo -n package > ../preuninstall.txt"'
            }
        },
        'say-hello.js': 'console.log("hello");',
        'version.txt': '1.0.0'
    };

    var gitInitialCommit = function () {
        gitpkg.gitPrepare({
            '1.0.0': {
                'package.json': {
                    name: 'package',
                    bin: {
                        "npd-a": './say-hello.js'
                    }
                },
                'npd.json': {
                    scripts: {
                        preinstall: 'bash -c "echo -n 1.0.0 > preinstall.txt"',
                        postinstall: 'bash -c "echo -n 1.0.0 > postinstall.txt"',
                        preuninstall: 'bash -c "echo -n 1.0.0 > ../preuninstall.txt"'
                    }
                },
                'say-hello.js': 'console.log("hello");',
                'version.txt': '1.0.0'
            }
        });
    };

    var gitUpdateCommit = function () {
        gitpkg.gitCommit({
            '1.0.1': {
                'package.json': {
                    name: 'package',
                    bin: {
                        "npd-b": './say-hello.js'
                    }
                },
                'npd.json': {
                    scripts: {
                        preinstall: 'bash -c "echo -n 1.0.1 > preinstall.txt"',
                        postinstall: 'bash -c "echo -n 1.0.1 > postinstall.txt"'
                    }
                },
                'say-hello.js': 'console.log("hello");',
                'version.txt': '1.0.1'
            }
        });
    };

    it('should not run postinstall when no package is update', function () {
        pkg.prepare({
            'package.json': {
                name: 'package'
            },
            'npd.json': {
                scripts: {
                    postinstall: 'bash -c "echo -n package > postinstall.txt"'
                }
            }
        });

        repo.prepare();

        npd.load(opts, true);
        return install([pkg.path]).then(function () {
            repo.prepare();

            return update().then(function () {
                t.isFalse(repo.exists('package/postinstall.txt'));
            });
        });
    });


    it('should run preinstall hook when updating a package', function () {
        repo.prepare();

        npd.load(opts, true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            t.equal(repo.read('package/preinstall.txt'), '1.0.0');
            repo.remove('package/preinstall.txt');
            t.isFalse(repo.exists('package/preinstall.txt'));
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read('package/preinstall.txt'), '1.0.1');
            });
        });
    });

    it('should run postinstall hook when updating a package', function () {
        repo.prepare();

        npd.load(opts, true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            t.equal(repo.read('package/postinstall.txt'), '1.0.0');
            repo.remove('package/postinstall.txt');
            t.isFalse(repo.exists('package/postinstall.txt'));
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read('package/postinstall.txt'), '1.0.1');
            });
        });
    });

    it('should run preuninstall hook when updating a package', function () {
        repo.prepare();

        npd.load(opts, true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read('preuninstall.txt'), '1.0.0');
            });
        });
    });


    it('should update a package to latest version', function () {
        repo.prepare();
        npd.load(_.assign({ prefix: repo.path }, opts), true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            t.include(repo.read('package/version.txt'), '1.0.0');
            t.isTrue(repo.exists('.bin/npd-a'));
            t.isFalse(repo.exists('.bin/npd-b'));
            gitUpdateCommit();
            return update().then(function () {
                t.include(repo.read('package/version.txt'), '1.0.1');
                t.isFalse(repo.exists('.bin/npd-a'));
                t.isTrue(repo.exists('.bin/npd-b'));
            });
        });
    });

    it('should keep the original one if no update', function () {
        repo.prepare();
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            t.include(repo.read('package/version.txt'), '1.0.0');
            return update().then(function () {
                t.include(repo.read('package/version.txt'), '1.0.0');
            });
        });
    });
});
