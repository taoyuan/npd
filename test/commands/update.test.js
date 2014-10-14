require('chai').config.includeStack = true;
var t = require('chai').assert;
var object = require('mout').object;
var ini = require('ini');
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

    var gitInitialCommit = function () {
        gitpkg.gitPrepare({
            '1.0.0': {
                'package.json': {
                    name: 'package',
                    bin: {
                        "npd-a": './say-hello.js'
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
                'say-hello.js': 'console.log("hello");',
                'version.txt': '1.0.1'
            }
        });
    };

    it('should not runs postinstall when no package is update', function () {
        pkg.prepare({
            'package.json': {
                name: 'package'
            }
        });

        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        npd.load(opts, true);
        return install([pkg.path]).then(function() {
            repo.prepare();

            return update().then(function() {
                t.isFalse(repo.exists('postinstall.txt'));
            });
        });
    });

    it('should update a package to latest version', function () {
        repo.prepare();
        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.include(repo.read('package/version.txt'), '1.0.0');
            t.isTrue(repo.exists('.bin/npd-a'));
            t.isFalse(repo.exists('.bin/npd-b'));
            gitUpdateCommit();
            return update().then(function() {
                t.include(repo.read('package/version.txt'), '1.0.1');
                t.isFalse(repo.exists('.bin/npd-a'));
                t.isTrue(repo.exists('.bin/npd-b'));
            });
        });
    });

    it('should keep the original one if no update', function () {
        repo.prepare();
        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.include(repo.read('package/version.txt'), '1.0.0');
            return update().then(function() {
                t.include(repo.read('package/version.txt'), '1.0.0');
            });
        });
    });

    it('runs preinstall hook when updating a package', function () {
        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    preinstall: 'bash -c "echo -n % > preinstall.txt"'
                }
            })
        });

        npd.load(opts, true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.isTrue(repo.exists('preinstall.txt'));
            repo.remove('preinstall.txt');
            t.isFalse(repo.exists('preinstall.txt'));
            gitUpdateCommit();
            return update().then(function() {
                t.equal(repo.read('preinstall.txt'), 'package');
            });
        });
    });

    it('runs postinstall hook when updating a package', function () {
        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        npd.load(opts, true);
        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.isTrue(repo.exists('postinstall.txt'));
            repo.remove('postinstall.txt');
            t.isFalse(repo.exists('postinstall.txt'));
            gitUpdateCommit();
            return update().then(function() {
                t.equal(repo.read('postinstall.txt'), 'package');
            });
        });
    });
});
