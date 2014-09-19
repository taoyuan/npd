var async = require('async');
var path = require('path');
var common = require('../common');
var log = require('../logs').get('install');

var deploy = require('./deploy');
var setup = require('./setup');

exports = module.exports = install;

exports.register = function (cli) {
    var c = cli.command('install')
        .usage('install <pkg>')
        .description('Install your app. This equals deploy then setup.'
            + '\nRef https://www.npmjs.org/doc/cli/npm-install.html');

    c.action(function (info) {
        var pkg = info.params.pkg;
        common.setupGlobalOptions(cli);
        install(pkg, common.throwOutOrExit);
    });
};

function install(pkg, next) {
    try {
        var pkgName = null;
        async.series([
            function (next) {
                log.log('deploy %s', pkg);
                deploy(pkg, function (err, p) {
                    if (err) {
                        return next(err);
                    }
                    pkgName = p;
                    next(null);
                });
            },
            function (next) {
                //return next(null);
                log.log('setup %s', pkgName);
                setup(pkgName, next);
            }
        ], next);
    } catch (err) {
        log.error(err);
        process.exit(1);
    }
}
