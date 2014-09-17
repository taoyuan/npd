var util = require('util');
var path = require('path');
var fs = require('fs');
var async = require('async');
var common = require('../common');
var log = require('../logs').get('update');

exports.update = function (pkgName, next) {
    var npm = require('npm');
    common.readRegistry(function (err, reg) {
        if (err) {
            log.error('can not open the nin-registry.');
            return next(err);
        }
        if (!reg.apps[pkgName]) {
            log.error('can not find the item in nin-registry for pkg: %s', pkgName);
            return next(err);
        }
        npm.load(function (err, npm) {
            if (err) {
                return next(err);
            }
            log.log('now update pkg: %s.', pkgName);
            // yes, we actually use npm install instead of update
            npm.commands.install([reg.apps[pkgName]], function (err, result) {
                if (err) {
                    log.error('updating pkg %s failed: %j.', pkgName, err);
                    return next(err);
                }
                log.log('updated pkg %s.', pkgName);
                next();
            });
        });
    });
};

exports.register = function (cli) {
    var c = cli.command('update')
        .usage('update [pkgname]')
        .description('Update your app.'
            + '\nor leave it blank to update all pkgs in <cwd>/apps/');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        function updateOnePkg(pkgname, next) {
            log.log('update: %s.', pkgname);
            try {
                var p = path.resolve(process.cwd(), 'node_modules/' + pkgname);
                if (fs.existsSync(p)) {
                    exports.update(pkgname, next);
                } else {
                    log.error('can not found pkg %s, skipped.', pkgname);
                    next();
                }
            } catch (err) {
                log.error(err);
                next(err);
            }
        }

        var pkgs = null;
        if (pkgname) {
            pkgs = [pkgname];
        } else {
            pkgs = fs.readdirSync(path.resolve(process.cwd(), 'apps'));
        }
        log.log('will update: %j.', pkgs);
        async.eachSeries(pkgs, updateOnePkg, function (err) {
            process.exit(1);
        });
    });
};
