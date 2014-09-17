var async = require('async');
var path = require('path');
var common = require('../common');
var log = require('../logs').get('install');

exports.register = function (cli) {
    var c = cli.command('install')
        .usage('install <pkg> [dir]')
        .description('Install your app. This equals deploy then setup.'
            + '\nRef https://www.npmjs.org/doc/cli/npm-install.html');

    c.action(function (info) {
        var pkg = info.params.pkg;
        try {
            common.setupGlobalOptions(cli);
            var pkgName = null;
            async.series([
                function (next) {
                    log.log('deploy: %s.', pkg);
                    require('./deploy').deploy(pkg, function (err, p) {
                        if (err) {
                            return next(err);
                        }
                        pkgName = p;
                        next(null);
                    });
                },
                function (next) {
                    //return next(null);
                    log.log('setup: %s.', path.resolve(process.cwd(), pkgName));
                    require('./setup').setup(path.resolve(process.cwd(), pkgName), next);
                }
            ], common.throwOutOrExit);
        } catch (err) {
            log.error(err);
            process.exit(1);
        }
    });
};
