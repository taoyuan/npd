"use strict";

var _ = require('lodash');
var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));
var logger = require('../logs').logger;
var npd = require('../npd');
var mdu = require('../mdu');

var unbuild = require('./unbuild');

module.exports = uninstall;

function uninstall(args) {
    if (!args) return;

    // this is super easy
    // get the list of args that correspond to package names in either
    // the global npm.dir,
    // then call unbuild on all those folders to pull out their bins
    // and mans and whatnot, and then delete the folder.

    var where = npd.config.prefix;

    return mdu.readMetas(where).spread(function (modmeta, pkgmeta) {
        var modsdir = mdu.modsdir(npd.config, modmeta, pkgmeta);
        modsdir = path.resolve(where, modsdir);

        if (args.length === 1 && args[0] === ".") args = [];
        if (args.length) return _uninstall(args, modsdir);

        // remove this package from the global space, if it's installed there
        if (npd.config.global) return;

        if (!pkgmeta) throw new Error(path.resolve(where, 'package.json') + ' dose not exist');

        _uninstall([pkgmeta.name], modsdir);
    });
}

function _uninstall(args, modsdir) {

    var folders = [];
    return Promise.each(args, function (arg) {
        // uninstall .. should not delete /usr/local/lib/[modsdir]/..
        var p = path.join(path.resolve(modsdir), path.join("/", arg));
        if (path.resolve(p) === modsdir) {
            logger.warn("uninstall", "invalid argument: %j", arg);
            return;
        }

        return fs.lstatAsync(p).then(function () {
            folders.push(p);
        }, function () {
            logger.warn("uninstall", "not installed in %s: %j", modsdir, arg);
        });
    }).then(function () {
        return Promise.map(folders, unbuild);
    });
}
