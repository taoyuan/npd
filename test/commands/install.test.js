"use strict";

var _ = require('lodash');
var chai = require('chai');
var t = require('chai').assert;
var ini = require('ini');
var object = require('mout').object;
var path = require('path');
var fs = require('fs-extra');
var npd = require('../../lib/npd');
var h = require('../helpers');
var npdconf = require('../../lib/npdconf');
var logger = require('../../lib/logs').logger;

describe('command/install', function () {

    var repo, pkg, gitpkg, opts;
    var install;

    beforeEach(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            }
        }).prepare();

        gitpkg = new h.TempDir();

        opts = {prefix: repo.path};

        install = h.command('install');
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    it('reads .npdrc from cwd', function () {
        pkg.prepare({ foo: 'bar' });

        repo.prepare({
            '.npdrc': ini.encode({prefix: repo.path})
        });

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('modules/package/foo'), 'bar');
        });
    });


    it('runs preinstall hook', function () {
        pkg.prepare({
            'module.json': {
                scripts: {
                    preinstall: 'bash -c "echo -n package > preinstall.txt"'
                }
            }
        });

        repo.prepare();

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('modules/package/preinstall.txt'), 'package');
        });
    });

    it('runs postinstall hook', function () {
        pkg.prepare({
            'module.json': {
                scripts: {
                    postinstall: 'bash -c "echo -n package > postinstall.txt"'
                }
            }
        });

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('modules/package/postinstall.txt'), 'package');
        });
    });

    it('should parse env in hook scripts', function () {
        pkg.prepare({
            'module.json': {
                scripts: {
                    preinstall: 'bash -c "echo -n $NPD_PID > preinstall.txt"'
                }
            }
        });

        repo.prepare();

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('modules/package/preinstall.txt'), process.pid);
        });
    });

    it('works for git repositories', function () {
        gitpkg.gitPrepare({
            '1.0.0': {
                'package.json': {
                    name: 'package'
                },
                'version.txt': '1.0.0'
            },
            '1.0.1': {
                'package.json': {
                    name: 'package'
                },
                'version.txt': '1.0.1'
            }
        });

        repo.prepare();

        return install([gitpkg.path + '#1.0.0'], opts).then(function () {
            t.equal(repo.read('modules/package/version.txt'), '1.0.0');
        });
    });

    it('should not link any bins when no-bin-links specified', function () {
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

        return install([pkg.path], _.assign({"bin-links": false}, opts)).then(function () {
            t.isFalse(repo.exists('modules/.bin/npd-bin-test'));
        });
    });

    it('should link bins to local', function () {
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

        return install([pkg.path], opts).then(function () {
            t.isTrue(repo.exists('modules/.bin/npd-bin-test'));
        });
    });

    it('should link bins to global', function () {
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

        return install([pkg.path], {prefix: repo.path, global: true}).then(function () {
            t.isTrue(fs.existsSync(path.join(npd.config.bin, 'npd-bin-test')));
            t.isTrue(fs.existsSync(path.join(npd.config.dir, 'package')));
        });
    });

    it('should install to custom local prefix', function () {
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

        return install([pkg.path], {prefix: repo.path}).then(function () {
            t.isTrue(repo.exists('modules/.bin/npd-bin-test'));
            t.isTrue(repo.exists('modules/package'));
        });
    });
});
