"use strict";

var path = require('path');
var t = require('chai').assert;
var fs = require('fs-extra');
var npd = require('../../lib/npd');
var h = require('../helpers');

describe('command/uninstall', function () {
    var repo, pkg;
    var install, uninstall;

    beforeEach(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            },
            'version.txt': '1.0.0'
        }).prepare();

        npd.load({prefix: repo.path});

        install = h.command('install');
        uninstall = h.command('uninstall');
    });

    beforeEach(function() {
        repo.prepare();
    });

    it('should run preuninstall hook', function () {
        pkg.prepare({
            'module.json': {
                scripts: {
                    preuninstall: 'bash -c "echo -n package > ../preuninstall.txt"'
                }
            }
        });
        return install([pkg.path]).then(function () {
            t.isTrue(repo.exists('modules/package'));
            return uninstall(['package']).then(function () {
                t.isFalse(repo.exists('modules/package'));
                t.isTrue(repo.exists('modules/preuninstall.txt'));
            });
        });
    });

    it('should not remove anything from repo if not exists', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('modules/package/version.txt'), '1.0.0');
            return uninstall(['unknown']).then(function () {
                t.isTrue(repo.exists('modules/package'));
            });
        });
    });

    it('should not remove anything from repo if no packages provided', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('modules/package/version.txt'), '1.0.0');
            return uninstall().then(function () {
                t.isTrue(repo.exists('modules/package'));
            });
        });
    });

    it('should remove installed package from repo', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('modules/package/version.txt'), '1.0.0');
            return uninstall(['package']).then(function () {
                t.isFalse(repo.exists('modules/package'));
            });
        });
    });

    it('remove global bin links after uninstall', function () {
        pkg.prepare({
            'package.json': {
                name: 'package',
                bin: {
                    'npd-bin-test': './npd-bin-test.js'
                }
            },
            'npd-bin-test.js': 'console.log("npd bin test");'
        });

        repo.prepare();

        var binpath = path.resolve(npd.config.bin, 'npd-bin-test');
        return install([pkg.path], {prefix: repo.path}).then(function () {
            t.isTrue(fs.existsSync(binpath));
            return uninstall(['package']).then(function () {
                t.isFalse(fs.existsSync(binpath));
            });
        });
    });

});

