var async = require('async');
var path = require('path');
var fs = require('fs-extra');
var sorb = require('../sorb');
var common = require('../common');
var support = require('../utils/support');
var log = require('../logs').get('remove');

exports = module.exports = remove;

var options = {};

function remove(pkgName, next) {
    sorb.load(function (err) {
        if (err) return next(err);

        var p = path.resolve(sorb.repo, pkgName);
        if (!fs.existsSync(p)) return next();
        log.log(pkgName, 'uninstall');
        async.series([removeBins(p), removePkg(pkgName, p)], next);
    });
}

exports.register = function (cli) {
    var c = cli.command('remove')
        .usage('remove <pkgname>')
        .option('-k, --keep', 'keep old user data')
        .description('Remove your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        options = cli;
        log.log(pkgname);
        remove(pkgname, common.throwOutOrExit);
    });
};

function removeBins(location) {
    return function (cb) {
        fs.readJSONFile(path.resolve(location, 'package.json'), function (err, pkg) {
            if (err) return cb(err);
            log.log('unlink bins');
            rmBins(pkg, cb);
        });
    }
}

function removePkg(pkgName, location) {
    return function (cb) {
        fs.remove(location, function (err) {
            if (err) {
                log.error('%s uninstall failed: %j.', pkgName, err);
                return cb(err);
            }
            log.log('%s has been removed', pkgName);
            if (options.keep) {
                log.log('support dir and links of %s kept.', pkgName);
                cb(null);
            } else {
                log.log('delete support dirs and links of %s', pkgName);
                clear(pkgName, function (err) {
                    if (err) {
                        log.error('support dir and links for %s failed: %j.', pkgName, err);
                        return cb(err);
                    }
                    log.log('support dir and links %s has been removed', pkgName);
                    cb(null);
                });
            }
        });
    }
}

function clear(pkgName, callback) {

    // clear support dirs
    rmDirs(support.dirSupports(sorb, pkgName));
    callback();
}

function rmDirs(dirs) {
    dirs.forEach(function (dir) {
        log.log('delete: %s', dir);
        try {
            rmDir(dir);
        } catch (err) {
            // keep running by only warn user
            log.warn('delete: %s, failed: %s.', p, err.message);
        }
    });
}

function rmDir(p) {
    if (fs.existsSync(p)) {
        if (fs.lstatSync(p).isDirectory()) {
            fs.readdirSync(p).forEach(function (file) {
                rmDir(path.resolve(p, file));
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

function rmBins(pkg, cb) {
    if (!pkg.bin) return cb();
    var binRoot = sorb.bin;

    async.mapSeries(Object.keys(pkg.bin), function (b, callback) {
        var bin = path.resolve(binRoot, b);
        log.log('unlink', bin);
        fs.remove(bin, callback)
    }, cb)
}
