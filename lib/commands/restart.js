var async = require('async');
var path = require('path');
var fs = require('fs');
var common = require('../common');
var log = require('../logs').get('restart');

exports.register = function (cli) {
    var c = cli.command('restart')
        .usage('restart <pkgname>')
        .description('restart your app. This equals stop then start your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        var p = path.resolve(process.cwd(), 'node_modules/' + pkgname);
        if (fs.existsSync(p)) {
            async.series([
                function (next) {
                    require('./stop').stop(p, next);
                },
                function (next) {
                    require('./start').start(p, next);
                }
            ], common.throwOutOrExit);
        } else {
            log.error('Pkg %s not found at %s.', pkgname, p);
            process.exit(1);
        }
    });
};
