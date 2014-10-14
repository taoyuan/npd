"use strict";

var path = require('path');
var t = require('chai').assert;
var fs = require('fs-extra');
var npdconf = require('../../lib/npdconf');
var h = require('../helpers');

describe('command/uninstall', function () {
    var repo, pkg;
    var install, uninstall;

    before(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            },
            'version.txt': '1.0.0'
        }).prepare();

        install = h.command('install', {
            cwd: repo.path
        });

        uninstall = h.command('uninstall', {
            cwd: repo.path
        });
    });

    beforeEach(function() {
        repo.prepare();
    });

    it('should not remove anything from repo if not exists', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('package/version.txt'), '1.0.0');
            return uninstall(['unknown']).then(function () {
                t.isTrue(repo.exists('package'));
            });
        });
    });

    it('should not remove anything from repo if no packages provided', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('package/version.txt'), '1.0.0');
            return uninstall().then(function () {
                t.isTrue(repo.exists('package'));
            });
        });
    });

    it('should remove installed package from repo', function () {
        return install([pkg.path]).then(function () {
            t.include(repo.read('package/version.txt'), '1.0.0');
            return uninstall(['package']).then(function () {
                t.isFalse(repo.exists('package'));
            });
        });
    });

    it('should remove bin links after uninstall', function () {
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

        return install([pkg.path]).then(function () {
            t.isTrue(repo.exists('.bin/npd-bin-test'));
            return uninstall(['package']).then(function () {
                t.isFalse(repo.exists('.bin/npd-bin-test'));
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

        var conf = npdconf({global: true, dir: repo.path});
        var binpath = path.resolve(conf.bin, 'npd-bin-test');
        return install([pkg.path], conf).then(function () {
            t.isTrue(fs.existsSync(binpath));
            return uninstall(['package'], conf).then(function () {
                t.isFalse(fs.existsSync(binpath));
            });
        });
    });

});

