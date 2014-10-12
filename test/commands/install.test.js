"use strict";

var chai = require('chai');
var t = require('chai').assert;
var ini = require('ini');
var object = require('mout').object;
var path = require('path');
var fs = require('fs-extra');
var h = require('../helpers');
var npdconf = require('../../lib/npdconf');

describe('command/install', function () {

    var repodir, pkg, gitpkg;
    var install, installLogger;

    before(function () {
        repodir = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            }
        }).prepare();

        gitpkg = new h.TempDir();

        install = h.command('install', {
            cwd: repodir.path
        });

        installLogger = h.commandForLogger('install', {
            cwd: repodir.path
        });
    });

    it('reads .npdrc from cwd', function () {
        pkg.prepare({ foo: 'bar' });

        repodir.prepare({
            '.npdrc': ini.encode({dir: repodir.path})
        });

        return install([pkg.path]).then(function () {
            t.equal(repodir.read('package/foo'), 'bar');
        });
    });


    it('runs preinstall hook', function () {
        pkg.prepare();

        repodir.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    preinstall: 'bash -c "echo -n % > preinstall.txt"'
                }
            })
        });

        return install([pkg.path]).then(function () {
            t.equal(repodir.read('preinstall.txt'), 'package');
        });
    });

    it('runs postinstall hook', function () {
        pkg.prepare();

        repodir.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        return install([pkg.path]).then(function () {
            t.equal(repodir.read('postinstall.txt'), 'package');
        });
    });


    // To be discussed, but that's the implementation now
    it('does not run hooks if nothing is installed', function () {
        repodir.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > hooks.txt"',
                    preinstall: 'bash -c "echo -n % > hooks.txt"'
                }
            })
        });

        return install().then(function () {
            t.isFalse(repodir.exists('hooks.txt'));
        });
    });

    it('display the output of hook scripts', function (next) {
        pkg.prepare();

        repodir.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo foobar"'
                }
            })
        });

        var lastAction = null;

        installLogger([pkg.path]).intercept(function (log) {
            if (log.level === 'action') {
                lastAction = log;
            }
        }).on('end', function () {
            t.equal(lastAction.message, 'foobar');
            next();
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

        repodir.prepare();

        return install([gitpkg.path + '#1.0.0']).then(function () {
            t.equal(repodir.read('package/version.txt'), '1.0.0');
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

        repodir.prepare();

        return install([pkg.path]).then(function () {
            t.isTrue(repodir.exists('.bin/npd-bin-test'));
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

        repodir.prepare();

        var conf = npdconf({global: true, dir: repodir.path});
        return install([pkg.path], conf).then(function () {
            t.isTrue(fs.existsSync(path.resolve(conf.bin, 'npd-bin-test')));
            fs.removeSync(path.resolve(conf.bin, 'npd-bin-test'));
        });
    });
});