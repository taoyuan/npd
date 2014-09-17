var fs = require('fs');
var util = require('util');
var path = require('path');
var async = require('async');
var _ = require('lodash');
var common = require('../common');
var log = require('../logs').get('stop');

function bashStop(content, next) {
    var bashPath = path.resolve(process.cwd(), content);
    var options = {
        env: common.getNinEnvForChildProcess(),
        cwd: process.cwd(),
        detached: true
    };
    //console.log(options);
    common.spawnCmd('bash', [bashPath], options,
        function _streamToConsole(child) {
            child.stdout.on('data', function (buffer) {
                process.stdout.write(buffer.toString());
            });
            child.stderr.on('data', function (buffer) {
                process.stderr.write(buffer.toString());
            });
            child.on('exit', function (code) {
                if (code === 0) {
                    next(null);
                } else {
                    next(new Error(util.format('execution of %s failed: %d.', bashPath, code)));
                }
            });
            child.unref();
        });
}

function foreverStop(content, next) {
    var emitter = require('forever')
        .stop(path.resolve(process.cwd(), content), true);
    emitter.on('stop', function () {
        log.log('app stoped: %s.', content);
        next(null);
    })
        .on('error', function (err) {
            next(err);
        });
}

exports.stopMap = {
    'bash': bashStop,
    'forever': foreverStop
};

exports.stop = function (pkgPath, next) {
    common.readConfig(pkgPath, function (err, conf) {
        if (err) {
            return next(err);
        }
        if (conf.stop) {
            if (!_.isArray(conf.stop)) {
                conf.start = [conf.stop];
            }
            var oldcwd = process.cwd();
            log.log('entering dir: %s.', pkgPath);
            process.chdir(pkgPath);
            var tasks = [];
            conf.stop.forEach(function (act, index) {
                tasks.push(function (next) {
                    if (act.type && exports.stopMap[act.type]) {
                        log.log('stop (%d) action: %j.', index, act);
                        exports.stopMap[act.type](act.content, next);
                    }
                });
                async.series(tasks, function (err) {
                    log.log('leaving dir: %s.', pkgPath);
                    process.chdir(oldcwd);
                    if (err) {
                        return next(err);
                    }
                    log.log('all stoped.');
                    next();
                });
            });
        }
    });
};

exports.register = function (cli) {
    var c = cli.command('stop')
        .usage('stop <pkgname>')
        .description('Stop your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        var p = path.resolve(process.cwd(), 'node_modules/' + pkgname);
        if (fs.existsSync(p)) {
            try {
                exports.stop(p, common.throwOutOrExit);
            } catch (err) {
                log.error(err);
                process.exit(1);
            }
        } else {
            log.error('Pkg %s not found at %s.', pkgname, p);
            process.exit(1);
        }
    });
};
