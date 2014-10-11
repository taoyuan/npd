require('chai').config.includeStack = true;
var t = require('chai').assert;
var object = require('mout').object;
var ini = require('ini');
var h = require('../helpers');

describe('command/update', function () {

    var repodir, pkg, gitpkg;
    var install, update, updateLogger;

    before(function () {
        repodir = new h.TempDir();

        pkg = new h.TempDir().prepare({
            'package.json': {
                name: 'package'
            }
        });

        gitpkg = new h.TempDir();

        var opts = { cwd: repodir.path };
        install = h.command('install', opts);
        update = h.command('update', opts);
        updateLogger = h.commandForLogger('update', opts);
    });

    var gitInitialCommit = function () {
        gitpkg.gitPrepare({
            '1.0.0': {
                'package.json': {
                    name: 'package'
                },
                'version.txt': '1.0.0'
            }
        });
    };
    var gitUpdateCommit = function () {
        gitpkg.gitCommit({
            '1.0.1': {
                'package.json': {
                    name: 'package'
                },
                'version.txt': '1.0.1'
            }
        });
    };

    it('should not runs postinstall when no package is update', function () {
        pkg.prepare();

        repodir.prepare({
            '.noaprc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        return install([pkg.path]).then(function() {
            repodir.prepare();

            return update().then(function() {
                t.isFalse(repodir.exists('postinstall.txt'));
            });
        });
    });

    it('updates a package', function () {
        repodir.prepare();
        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.include(repodir.read('package/version.txt'), '1.0.0');
            gitUpdateCommit();
            return update().then(function() {
                t.include(repodir.read('package/version.txt'), '1.0.1');
            });
        });
    });

    it('runs preinstall hook when updating a package', function () {
        repodir.prepare({
            '.noaprc': ini.encode({
                scripts: {
                    preinstall: 'bash -c "echo -n % > preinstall.txt"'
                }
            })
        });

        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.isTrue(repodir.exists('preinstall.txt'));
            repodir.remove('preinstall.txt');
            t.isFalse(repodir.exists('preinstall.txt'));
            gitUpdateCommit();
            return update().then(function() {
                t.equal(repodir.read('preinstall.txt'), 'package');
            });
        });
    });

    it('runs postinstall hook when updating a package', function () {
        repodir.prepare({
            '.noaprc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        gitInitialCommit();
        return install([gitpkg.path]).then(function() {
            t.isTrue(repodir.exists('postinstall.txt'));
            repodir.remove('postinstall.txt');
            t.isFalse(repodir.exists('postinstall.txt'));
            gitUpdateCommit();
            return update().then(function() {
                t.equal(repodir.read('postinstall.txt'), 'package');
            });
        });
    });
});
