"use strict";

var async = require('async');
var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var noap = require('./noap');
var log = require('./logger');
var utils = require('./utils');

module.exports = install;

install.usage = ['install <app>', 'install the application'];

function install(args, done) {
    var pkg = String(args[0]);
    var name = path.basename(pkg);
    var p = path.resolve(noap.repo, name);

    noap.config.get('force') || !installed(p) ? _install(pkg, done) : _upgrade(pkg, done);
}

function installed(p) {
    return fs.existsSync(path.resolve(p, 'package.json'));
}

function _install(what, done) {
    var npm = noap.npm;

    var where = path.resolve(noap.repo);
    log.log("install %s to %s", what, where);

    var origPrefix = npm.prefix;
    var temp = npm.prefix = noap.ptemp;
    fs.removeSync(temp);
    fs.mkdirpSync(temp);
    npm.commands.install([what], function (err, result) {
        npm.prefix = origPrefix;
        if (err) {
            fs.removeSync(temp);
            log.error('install `%s` failed: %j.', what, err);
            return done(err);
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
                return done(err);
            }
            deploySupports(location, function (err) {
                if (err) {
                    log.error(err);
                    return done(err);
                }
                log.log('%s %s', desc, location);
                done(null, location);
            })
        });
    });
}

function _upgrade(what, done) {
    var name = path.basename(what);
    log.success("%s is already installed, upgrading.", name);
    done();
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
        var dirs = utils.supportDirs(noap, name);
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
        var npm = noap.npm;
        var binRoot = noap.bin;
        log.log("link bins", [pkg.bin, binRoot]);

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
    return utils.linkIfExists(from, to, cb);
}
