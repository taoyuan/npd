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

    it('reads .npdrc from cwd', function () {
        pkg.prepare({ foo: 'bar' });

        repo.prepare({
            '.npdrc': ini.encode({prefix: repo.path})
        });

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('package/foo'), 'bar');
        });
    });


    it('runs preinstall hook', function () {
        pkg.prepare({
            'npd.json': {
                scripts: {
                    preinstall: 'bash -c "echo -n package > preinstall.txt"'
                }
            }
        });

        repo.prepare();

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('package/preinstall.txt'), 'package');
        });
    });

    it('runs postinstall hook', function () {
        pkg.prepare({
            'npd.json': {
                scripts: {
                    postinstall: 'bash -c "echo -n package > postinstall.txt"'
                }
            }
        });

        return install([pkg.path], opts).then(function () {
            t.equal(repo.read('package/postinstall.txt'), 'package');
        });
    });

    it('should parse env in hook scripts', function () {
        pkg.prepare({
            'npd.json': {
                scripts: {
                    preinstall: 'bash -c "echo -n $UID > preinstall.txt"'
                }
            }
        });

        repo.prepare();

        return install([pkg.path], _.assign({UID: 'taoyuan'}, opts)).then(function () {
            t.equal(repo.read('package/preinstall.txt'), 'taoyuan');
        });
    });

//    it.only('display the output of hook scripts', function (next) {
//        pkg.prepare({
//            'npd.json': {
//                scripts: {
//                    postinstall: 'bash -c "echo foobar"'
//                }
//            }
//        });
//
//        repo.prepare();
//
//        var lastAction = null;
//
//        npd.load(opts, true);
//        installLogger([pkg.path]).intercept(function (log) {
//            if (log.level === 'action') {
//                lastAction = log;
//            }
//        }).on('end', function () {
//            t.equal(lastAction.message, 'foobar');
//            next();
//        });
//    });

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
            t.equal(repo.read('package/version.txt'), '1.0.0');
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

        return install([pkg.path], _.assign({noBinLinks: true}, opts)).then(function () {
            t.isFalse(repo.exists('.bin/npd-bin-test'));
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
            t.isTrue(repo.exists('.bin/npd-bin-test'));
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

        return install([pkg.path], {prefix: repo.path}).then(function () {
            t.isTrue(fs.existsSync(path.resolve(npd.config.bin, 'npd-bin-test')));
            fs.removeSync(path.resolve(npd.config.bin, 'npd-bin-test'));
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
            t.isTrue(repo.exists('.bin/npd-bin-test'));
            t.isTrue(repo.exists('package'));
        });
    });
});
