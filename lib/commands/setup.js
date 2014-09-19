var fs = require('fs-extra');
var util = require('util');
var path = require('path');
var async = require('async');
var common = require('../common');
var adm = require('../adm');
var log = require('../logs').get('setup');

exports = module.exports = setup;

exports.register = function (cli) {
    var c = cli.command('setup')
        .usage('setup <pkgname>')
        .description('Setup your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        setup(pkgname, common.throwOutOrExit);
    });
};

function setup(pkgName, next) {
    adm.load(function (err) {
        if (err) {
            return next(err);
        }
        var p = path.resolve(adm.repo, pkgName);
        if (!fs.existsSync(p)) {
            log.error('`%s` not found at %s', pkgName, p);
            process.exit(1);
        }
        common.readConfig(p, function (err, conf) {
            if (err) {
                return next(err);
            }
            var oldcwd = process.cwd();
            log.log('entering %s', p);
            process.chdir(p);

            if (!conf.setup) return next();

            var cmds = conf.setup;
            if (!Array.isArray(cmds)) cmds = [cmds];

            log.log('found %d targets', cmds.length);
            var tasks = [];
            cmds.forEach(function (cmd, index) {
                tasks.push(function (next) {
                    log.log('execute (%d) task - %j', index + 1, cmd);
                    runCmd(cmd, next);
                });
            });
            async.series(tasks, function (err) {
                log.log('leaving %s', p);
                process.chdir(oldcwd);
                if (err) {
                    return next(err);
                }
                log.log('all tasks done');
                next();
            });
        });
    });
}

function runCmd(cmd, next) {
    var options = {env: common.getAdmEnvForChildProcess()};
    common.execCmd(cmd, options,
        function (code) {
            if (code !== 0) {
                next(new Error(util.format('execution of %s failed: %d.', cmd, code)));
            } else {
                log.log('succeeded in execution of %s.', cmd);
                next(null);
            }
        },
        function _streamToConsole(child) {
            child.stdout.on('data', function (buffer) {
                process.stdout.write(buffer.toString());
            });
            child.stderr.on('data', function (buffer) {
                process.stderr.write(buffer.toString());
            });
        });
}
