var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var _ = require('lodash');
var npm = require('npm');
var noap = require('../noap');
var common = require('../common');
var support = require('../utils/support');
var linkIfExists = require('../utils/link').ifExists;
var log = require('../logs').get('deploy');

exports = module.exports = deploy;

exports.register = function (cli) {
    var c = cli.command('deploy')
        .usage('deploy <pkg>')
        .description('Install your app. ' +
            '\nRef https://www.npmjs.org/doc/cli/npm-install.html');

    c.action(function (info) {
        var params = info.params;
        common.setupGlobalOptions(cli);
        try {
            deploy(params.pkg, params.dir, common.throwOutOrExit);
        } catch (err) {
            log.error(err);
            process.exit(1);
        }
    });
};

function deploy(what, next) {
    async.series([noap.load, npm.load], function (err) {
        if (err) {
            return next(err);
        }
        var where = path.resolve(noap.repo);
        log.log("%s to %s", what, where);

        var origPrefix = npm.prefix;
        var temp = npm.prefix = noap.ptemp;
        fs.removeSync(temp);
        fs.mkdirpSync(temp);
        npm.commands.install([what], function (err, result) {
            npm.prefix = origPrefix;
            if (err) {
                fs.removeSync(temp);
                log.error('`%s` failed: %j.', what, err);
                return next(err);
            }
            var info = _.last(result);
            var desc = info[0];
            var temp_location = path.resolve(info[1]);
            var name = path.basename(temp_location);
            var location = path.resolve(where, name);
            fs.removeSync(location);
            fs.move(temp_location, location, function (err) {
                fs.removeSync(temp);
                if (err) {
                    log.error(err);
                    return next(err);
                }
                deploySupports(location, function (err) {
                    if (err) {
                        log.error(err);
                        return next(err);
                    }
                    log.log('%s %s', desc, location);
                    next(null, location);
                })
            });
        });
    });
}

function deploySupports(location, cb) {
    var name = path.basename(location);
    fs.readJsonFile(path.resolve(location, "package.json"), function (err, pkg) {
        if (err) return cb(err);

        async.series([
            ensureSupportDirs(name),
            linkBins(pkg, location)
        ], cb);
    });
}

function ensureSupportDirs(name) {
    return function (cb) {
        var dirs = support.dirSupports(noap, name);
        log.log('create support dirs for `%s`', name);
        dirs.forEach(function (dir) {
            log.log('create: %s', dir);
            fs.ensureDirSync(dir);
        });
        cb();
    }
}

function linkBins(pkg, location) {
    return function (cb) {
        if (!pkg.bin) {
            return cb()
        }
        var binRoot = noap.bin;
        log.verbose("link bins", [pkg.bin, binRoot]);

        async.mapSeries(Object.keys(pkg.bin), function (b, cb) {
            linkBin(path.resolve(location, pkg.bin[b]), path.resolve(binRoot, b), function (err) {
                if (err) return cb(err);
                // bins should always be executable.
                // XXX skip chmod on windows?
                var src = path.resolve(location, pkg.bin[b]);
                fs.chmod(src, npm.modes.exec, function (err) {
                    if (err && err.code === "ENOENT" && npm.config.get("ignore-scripts")) {
                        return cb();
                    }
                    if (err) return cb(err);
                    var dest = path.resolve(binRoot, b);
                    var out = npm.config.get("parseable")
                        ? dest + "::" + src + ":BINFILE"
                        : dest + " -> " + src;
                    log.log(out);
                    cb()
                })
            })
        }, cb)
    }
}

function linkBin(from, to, cb) {
    if (process.platform !== "win32") {
        return linkIfExists(from, to, cb);
    }
    throw new Error('Unsupported');
}
