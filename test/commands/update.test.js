require('chai').config.includeStack = true;
var t = require('chai').assert;
var object = require('mout').object;
var ini = require('ini');
var helpers = require('../helpers');
var noap = helpers.require('lib/noap');
var commands = noap.commands;

describe('command/update', function () {

    var repodir, pkg, gitpkg;

    before(function () {
        repodir = new helpers.TempDir();

        pkg = new helpers.TempDir().prepare({
            'package.json': {
                name: 'package'
            }
        });

        gitpkg = new helpers.TempDir();
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

    var updateLogger = function(packages, config) {
        config = object.merge(config || {}, {
            cwd: repodir.path
        });

        return commands.update(packages, config);
    };

    var update = function(packages, config) {
        var logger = updateLogger(packages, config);

        return helpers.expectEvent(logger, 'end');
    };

    var install = function(packages, config) {
        config = object.merge(config || {}, {
            cwd: repodir.path
        });

        var logger = commands.install(
            packages, config
        );

        return helpers.expectEvent(logger, 'end');
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
