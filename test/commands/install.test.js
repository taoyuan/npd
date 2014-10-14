"use strict";

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
    var install, installLogger;

    beforeEach(function () {
        repo = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            }
        }).prepare();

        gitpkg = new h.TempDir();

        opts = {cwd: repo.path};

        install = h.command('install');
        installLogger = h.commandForLogger('install');
    });

    it('reads .npdrc from cwd', function () {
        pkg.prepare({ foo: 'bar' });

        repo.prepare({
            '.npdrc': ini.encode({dir: repo.path})
        });

        npd.load(opts, true);
        return install([pkg.path]).then(function () {
            t.equal(repo.read('package/foo'), 'bar');
        });
    });


    it('runs preinstall hook', function () {
        pkg.prepare();

        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    preinstall: 'bash -c "echo -n % > preinstall.txt"'
                }
            })
        });

        npd.load(opts, true);
        return install([pkg.path]).then(function () {
            t.equal(repo.read('preinstall.txt'), 'package');
        });
    });

    it('runs postinstall hook', function () {
        pkg.prepare();

        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > postinstall.txt"'
                }
            })
        });

        npd.load(opts, true);
        return install([pkg.path]).then(function () {
            t.equal(repo.read('postinstall.txt'), 'package');
        });
    });


    // To be discussed, but that's the implementation now
    it('does not run hooks if nothing is installed', function () {
        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo -n % > hooks.txt"',
                    preinstall: 'bash -c "echo -n % > hooks.txt"'
                }
            })
        });

        npd.load(opts, true);
        return install().then(function () {
            t.isFalse(repo.exists('hooks.txt'));
        });
    });

    it('display the output of hook scripts', function (next) {
        pkg.prepare();

        repo.prepare({
            '.npdrc': ini.encode({
                scripts: {
                    postinstall: 'bash -c "echo foobar"'
                }
            })
        });

        var lastAction = null;

        npd.load(opts, true);
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

        repo.prepare();

        npd.load(opts, true);
        return install([gitpkg.path + '#1.0.0']).then(function () {
            t.equal(repo.read('package/version.txt'), '1.0.0');
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

        npd.load(opts, true);
        return install([pkg.path]).then(function () {
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

        npd.load({global: true, dir: repo.path});
        return install([pkg.path]).then(function () {
            t.isTrue(fs.existsSync(path.resolve(npd.config.bin, 'npd-bin-test')));
            fs.removeSync(path.resolve(npd.config.bin, 'npd-bin-test'));
        });
    });
});