"use strict";

var path = require('path');
var t = require('chai').assert;
var fs = require('fs-extra');

var h = require('../helpers');

describe.only('command/uninstall', function () {
    var repodir, pkg;
    var install, uninstall;

    before(function () {
        repodir = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            },
            'version.txt': '1.0.0'
        }).prepare();

        install = h.command('install', {
            cwd: repodir.path
        });

        uninstall = h.command('uninstall', {
            cwd: repodir.path
        });
    });

    beforeEach(function() {
        repodir.prepare();
    });

    it('should not remove anything from repo if not exists', function () {
        return install([pkg.path]).then(function () {
            t.include(repodir.read('package/version.txt'), '1.0.0');
            return uninstall(['unknown']).then(function () {
                t.isTrue(repodir.exists('package'));
            });
        });
    });

    it('should not remove anything from repo if no packages provided', function () {
        return install([pkg.path]).then(function () {
            t.include(repodir.read('package/version.txt'), '1.0.0');
            return uninstall().then(function () {
                t.isTrue(repodir.exists('package'));
            });
        });
    });

    it('should remove installed package from repo', function () {
        return install([pkg.path]).then(function () {
            t.include(repodir.read('package/version.txt'), '1.0.0');
            return uninstall(['package']).then(function () {
                t.isFalse(repodir.exists('package'));
            });
        });

    });

});

