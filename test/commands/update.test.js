var _ = require('lodash');
var t = require('chai').assert;
var object = require('mout').object;
var npd = require('../../lib/npd');
var h = require('../helpers');

describe('command/update', function () {

    var repo, pkg, gitpkg, opts;
    var install, update;

    beforeEach(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir();

        gitpkg = new h.TempDir();

        opts = {prefix: repo.path};
        npd.load(opts);
        install = h.command('install');
        update = h.command('update');
    });

    var gitInitialCommit = function () {
        gitpkg.gitPrepare({
            '1.0.0': {
                'package.json': {
                    name: 'package',
                    bin: {
                        "npd-a": './say-hello.js'
                    }
                },
                'module.json': {
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
        console.log('git init complete');
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
                'module.json': {
                    scripts: {
                        preinstall: 'bash -c "echo -n 1.0.1 > preinstall.txt"',
                        postinstall: 'bash -c "echo -n 1.0.1 > postinstall.txt"'
                    }
                },
                'say-hello.js': 'console.log("hello");',
                'version.txt': '1.0.1'
            }
        });
        console.log('git update complete');
    };

    it('should not run postinstall when no package is update', function () {
        pkg.prepare({
            'package.json': {
                name: 'package'
            },
            'module.json': {
                scripts: {
                    postinstall: 'bash -c "echo -n package > postinstall.txt"'
                }
            }
        });

        repo.prepare();

        return install([pkg.path], opts).then(function () {
            repo.prepare();

            return update().then(function () {
                t.isFalse(repo.exists(npd.config.silo, 'package/postinstall.txt'));
            });
        });
    });


    it('should run preinstall hook when updating a package', function () {
        repo.prepare();

        gitInitialCommit();
        return install([gitpkg.path], opts).then(function () {
            t.equal(repo.read(npd.config.silo, 'package/preinstall.txt'), '1.0.0');
            repo.remove(npd.config.silo, 'package/preinstall.txt');
            t.isFalse(repo.exists(npd.config.silo, 'package/preinstall.txt'));
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read(npd.config.silo, 'package/preinstall.txt'), '1.0.1');
            });
        });
    });

    it('should run postinstall hook when updating a package', function () {
        repo.prepare();

        gitInitialCommit();
        return install([gitpkg.path], opts).then(function () {
            t.equal(repo.read(npd.config.silo, 'package/postinstall.txt'), '1.0.0');
            repo.remove(npd.config.silo, 'package/postinstall.txt');
            t.isFalse(repo.exists(npd.config.silo, 'package/postinstall.txt'));
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read(npd.config.silo, 'package/postinstall.txt'), '1.0.1');
            });
        });
    });

    it('should run preuninstall hook when updating a package', function () {
        repo.prepare();

        gitInitialCommit();
        return install([gitpkg.path], opts).then(function () {
            gitUpdateCommit();
            return update().then(function () {
                t.equal(repo.read(npd.config.silo, 'preuninstall.txt'), '1.0.0');
            });
        });
    });


    it('should update a package to latest version', function () {
        repo.prepare();
        gitInitialCommit();
        return install([gitpkg.path], _.assign({ prefix: repo.path }, opts)).then(function () {
            t.include(repo.read(npd.config.silo, 'package/version.txt'), '1.0.0');
            t.isTrue(repo.exists(npd.config.silo, '.bin/npd-a'));
            t.isFalse(repo.exists(npd.config.silo, '.bin/npd-b'));
            gitUpdateCommit();
            return update().then(function () {
                t.include(repo.read(npd.config.silo, 'package/version.txt'), '1.0.1');
                t.isFalse(repo.exists(npd.config.silo, '.bin/npd-a'));
                t.isTrue(repo.exists(npd.config.silo, '.bin/npd-b'));
            });
        });
    });

    it('should keep the original one if no update', function () {
        repo.prepare();
        gitInitialCommit();
        return install([gitpkg.path]).then(function () {
            t.include(repo.read(npd.config.silo, 'package/version.txt'), '1.0.0');
            return update().then(function () {
                t.include(repo.read(npd.config.silo, 'package/version.txt'), '1.0.0');
            });
        });
    });
});
