var async = require('async');
var util = require('util');
var path = require('path');
var fs = require('fs');
var common = require('../common');
var log = require('../logs').get('remove');

function recursiveDelete(p) {
    if (fs.existsSync(p)) {
        if (fs.lstatSync(p).isDirectory()) {
            fs.readdirSync(p).forEach(function (file) {
                recursiveDelete(path.resolve(p, file));
            });
            fs.rmdirSync(p);
        } else {
            fs.unlinkSync(p);
        }
    } else {
        // not exist, may be symlink, just unlink it
        fs.unlinkSync(p);
    }
}

function removeSupportDirAndLinks(pkgName, callback) {
    function _getDeleteFunc(p) {
        return function (next) {
            log.log('delete: %s.', p);
            try {
                recursiveDelete(p);
            } catch (err) {
                // keep running by only warn user
                log.warn('delete: %s, failed: %s.', p, err.message);
            }
            next();
        };
    }

    var pcwd = process.cwd();

    var cwdAppsPkg = path.resolve(pcwd, util.format('apps/%s', pkgName));
    var cwdEtcPkg = path.resolve(pcwd, util.format('etc/%s', pkgName));
    var cwdVarPkg = path.resolve(pcwd, util.format('var/%s', pkgName));
    var cwdLogPkg = path.resolve(pcwd, util.format('log/%s', pkgName));

    async.series([
        _getDeleteFunc(cwdAppsPkg),
        _getDeleteFunc(cwdEtcPkg),
        _getDeleteFunc(cwdVarPkg),
        _getDeleteFunc(cwdLogPkg)
    ], callback);
}

exports.remove = function (pkgName, next) {
    var npm = require('npm');
    npm.load(function (err, npm) {
        if (err) {
            return next(err);
        }
        log.log('uninstall pkg: %s.', pkgName);
        npm.commands.uninstall([pkgName], function (err) {
            if (err) {
                log.error('uninstallation of pkg %s failed: %j.', pkgName, err);
                return next(err);
            }
            log.log('pkg %s uninstalled.', pkgName);
            if (exports.cmdOpts.keep) {
                log.log('remove support dir and links of %s skipped.', pkgName);
                next(null);
            } else {
                log.log('now remove support dir and links of %s.', pkgName);
                removeSupportDirAndLinks(pkgName, function (err) {
                    if (err) {
                        log.error('remove support dir and links for %s failed: %j.', pkgName, err);
                        return next(err);
                    }
                    log.log('support dir and links removed of %s.', pkgName);
                    next(null);
                });
            }
        });
    });
};

exports.cmdOpts = null;

function setupOptions(command) {
    // simple ref the command instance
    exports.cmdOpts = command;
}

exports.register = function (cli) {
    var c = cli.command('remove')
            .usage('remove <pkgname>')
            .option('-k, --keep', 'keep old user data')
            .description('Remove your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        setupOptions(c);
        var p = path.resolve(process.cwd(), 'node_modules/' + pkgname);
        try {
            if (fs.existsSync(p)) {
                log.log('now remove: %s.', pkgname);
                exports.remove(pkgname, common.throwOutOrExit);
            } else {
                log.log('Can not find pkg %s, skip.', pkgname);
                process.exit(1);
            }
        } catch (err) {
            log.error(err);
            process.exit(1);
        }
    });
};
