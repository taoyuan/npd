var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var _ = require('lodash');
var npm = require('npm');
var common = require('../common');
var linkIfExists = require('../utils/link').ifExists;
var log = require('../logs').get('deploy');

exports = module.exports = deploy;

deploy.register = function (cli) {
    var c = cli.command('deploy')
        .usage('deploy <pkg> [dir]')
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

function deploy(what, where, next) {
    if (typeof where === 'function') {
        next = where;
        where = null;
    }

    npm.load(function (err, npm) {
        if (err) {
            return next(err);
        }
        where = path.resolve(where || npm.prefix);
        log.log("'%s' to '%s'", what, where);

        var origPrefix = npm.prefix;
        var temp_modules = npm.prefix = path.resolve(where, '.adm-modules');
        fs.removeSync(temp_modules);
        fs.mkdirpSync(temp_modules);
        npm.commands.install([what], function (err, result) {
            if (err) {
                log.error('installation of `%s` failed: %j.', what, err);
                return next(err);
            }
            var info = _.last(result);
            var desc = info[0];
            var temp_location = path.resolve(info[1]);
            var name = path.basename(temp_location);
            var location = path.resolve(where, name);
            fs.move(temp_location, location, function (err) {
                if (err) {
                    log.error(err);
                    return next(err);
                }
                _deploy(location, function (err) {
                    if (err) {
                        log.error(err);
                        return next(err);
                    }
                    fs.removeSync(temp_modules);
                    npm.prefix = origPrefix;
                    log.log('%s %s.', desc, location);
                    next(null, location);
                })
            });
        });
    });
}

function _deploy(location, cb) {
    var name = path.basename(location);
    var where = path.dirname(location);
    fs.readJsonFile(path.resolve(location, "package.json"), function (err, pkg) {
        if (err) return cb(err);
        async.series([
            ensureSupportDirs(where, name),
            linkBins(pkg, location),
            modifyRegistry(name, location)
        ], cb);
    });
}

function ensureSupportDirs(root, name) {
    root = root || process.cwd();
    return function (cb) {
        mkdirs(path.join(root, '%s', name), ['etc', 'var', 'log']);
        cb();
    }
}

function mkdirs(s, dirs) {
    if (!Array.isArray(dirs)) dirs = [dirs];
    dirs.forEach(function (dir) {
        var p = path.resolve(util.format(s, dir));
        log.log('create dir %s.', p);
        fs.ensureDirSync(p);
    });
}

function modifyRegistry(name, location) {
    return function (cb) {
        common.readRegistry(function (err, reg) {
            if (err) {
                return next(err);
            }
            if (!reg.apps) {
                reg.apps = {};
            }
            reg.apps[name] = location;
            common.writeRegistry(reg, cb);
        });
    }
}

function linkBins(pkg, location) {
    return function (cb) {
        if (!pkg.bin) {
            return cb()
        }
        var binRoot = npm.globalBin;
        log.verbose("link bins", pkg.bin, binRoot);

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
                        console.log(out);
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
