var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var _ = require('lodash');
var common = require('../common');
var log = require('../logs').get('deploy');

exports.utils = {};

function ensureDir(dir, mode, callback) {
    mode = mode || 0777 & (~process.umask());
    callback = callback || function () {
    };
    fs.exists(dir, function (exists) {
        if (exists) {
            return callback(null);
        }
        var current = path.resolve(dir), parent = path.dirname(current);
        ensureDir(parent, mode, function (err) {
            if (err) {
                return callback(err);
            }
            fs.mkdir(current, mode, function (err) {
                if (err && err.code !== 'EEXIST') {
                    return callback(err);
                } // avoid the error under concurrency
                callback(null);
            });
        });
    });
}

exports.utils.ensureDir = ensureDir;

function ensureSupportDirs(pkgPath, callback) {
    function _getEnsureDirFunc(pkgPath) {
        return function (next) {
            log.log('ensure dir: %s.', pkgPath);
            ensureDir(pkgPath, null, next);
        };
    }

    function _getEnsureLinkFunc(from, to) {
        return function (next) {
            log.log('ensure link: %s -> %s.', from, to);
            try {
                var stat = fs.lstatSync(to);
                if (stat) {
                    log.warn('dst %s already exist, you may want to further inspect what it is.', to);
                }
            } catch (e) {
            }
            fs.symlink(from, to, function (err) {
                // tolerant link error, just warning about that
                if (err) {
                    log.warn('%j', err);
                }
                next();
            });
        };
    }

    var pcwd = process.cwd();
    var pkgName = path.basename(pkgPath);

    var cwdEtc = path.resolve(pcwd, 'etc');
    var cwdApps = path.resolve(pcwd, 'apps');
    var cwdAppsPkg = path.resolve(pcwd, util.format('apps/%s', pkgName));
    var cwdEtcPkg = path.resolve(pcwd, util.format('etc/%s', pkgName));
    var cwdVarPkg = path.resolve(pcwd, util.format('var/%s', pkgName));
    var cwdLogPkg = path.resolve(pcwd, util.format('log/%s', pkgName));

    var pkg = path.resolve(pcwd, pkgPath);
    var pkgEtc = path.resolve(pcwd, util.format('%s/etc', pkgPath));
    var pkgVar = path.resolve(pcwd, util.format('%s/var', pkgPath));
    var pkgLog = path.resolve(pcwd, util.format('%s/log', pkgPath));

    async.series([
        _getEnsureDirFunc(cwdEtc),
        _getEnsureDirFunc(cwdApps),
        _getEnsureDirFunc(cwdVarPkg),
        _getEnsureDirFunc(cwdLogPkg),
        _getEnsureDirFunc(pkgEtc),

        _getEnsureLinkFunc(pkg, cwdAppsPkg),
        _getEnsureLinkFunc(pkgEtc, cwdEtcPkg),
        _getEnsureLinkFunc(cwdLogPkg, pkgLog),
        _getEnsureLinkFunc(cwdVarPkg, pkgVar)
    ], callback);
}

function modifyRegistry(pkg, pkgName, next) {
    common.readRegistry(function (err, reg) {
        if (err) {
            return next(err);
        }
        if (!reg.apps) {
            reg.apps = {};
        }
        reg.apps[pkgName] = pkg;
        common.writeRegistry(reg, next);
    });
}

exports.deploy = function (pkg, next) {
    var npm = require('npm');
    npm.load(function (err, npm) {
        if (err) {
            return next(err);
        }
        log.log('npm install pkg: %s.', pkg);
        var origPrefix = npm.prefix;
        var temp_modules = npm.prefix = path.resolve(npm.prefix, '.adm-modules');
        fs.removeSync(temp_modules);
        fs.mkdirpSync(temp_modules);
        npm.commands.install([pkg], function (err, result) {
            if (err) {
                log.error('installation of pkg %s failed: %j.', pkg, err);
                return next(err);
            }
            var pkginfo = _.last(result);
            var pkgDesc = pkginfo[0];
            var pkgPath = pkginfo[1];
            var pkgName = path.basename(pkgPath);
            fs.move(path.resolve(pkgPath), path.resolve(pkgName), function (err) {
                fs.removeSync(temp_modules);
                npm.prefix = origPrefix;
                if (err) return log.error(err);
                log.log('%s was installed to %s.', pkgDesc, pkgName);
                ensureSupportDirs(pkgName, function (err) {
                    if (err) {
                        log.error('ensuring support dirs for %s failed: %j.', pkg, err);
                        return next(err);
                    }
                    var pkgInstalledPath = pkgName;
                    var pkgInstalledName = path.basename(pkgInstalledPath);
                    modifyRegistry(pkg, pkgInstalledName, function (err) {
                        if (err) {
                            return next(err);
                        }
                        next(null, pkgInstalledPath);
                    });
                });
            });
        });
    });
};

exports.register = function (cli) {
    var c = cli.command('deploy')
        .usage('deploy <pkg> [dir]')
        .description('Install your app. ' +
            '\nRef https://www.npmjs.org/doc/cli/npm-install.html');

    c.action(function (info) {
        var params = info.params;
        common.setupGlobalOptions(cli);
        try {
            exports.deploy(params.pkg, common.throwOutOrExit);
        } catch (err) {
            log.error(err);
            process.exit(1);
        }
    });
};
