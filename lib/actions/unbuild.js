"use strict";

var _ = require('lodash');
var path = require('path');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

var logger = require('../logs').logger;
var npd = require('../npd');
var copy = require('../utils/copy');
var lifecycle = require('../lifecycle');
var dissector = require('../dissector');

module.exports = unbuild;

function unbuild(args, silent) {
    if (!args) return Promise.resolve();
    if (!Array.isArray(args)) args = [args];
    return Promise.map(args, toEndpoint).map(_unbuild(silent));


    //if (!endpoints) endpoints = [];
    //if (!_.isArray(endpoints)) endpoints = [endpoints];
    //
    //var lifecycle = new Lifecycle(npd.config, logger);
    //
    //var c = npd.config;
    //var dir = path.resolve(c.dir);
    //
    //var promises = [];
    //_.forEach(endpoints, function (endpoint) {
    //    var promise = when.resolve();
    //    var name = endpoint.name;
    //    if (!endpoint.missing) {
    //        var pkgdir = path.resolve(dir, name);
    //        logger.action('uninstall', name, { name: name, dir: pkgdir });
    //        promise = promise
    //            .then(function () {
    //                return lifecycle.preuninstall(endpoint.installed && endpoint.installed.modmeta, pkgdir);
    //            })
    //            .catch(function (err) {
    //                if (!c.force) return err;
    //                logger.debug('error', err.message, { error: err });
    //                return null;
    //            })
    //            .then(function () {
    //                return rmBins(endpoint.installed && endpoint.installed.pkgmeta);
    //            })
    //            .then(function () {
    //                return rmPackage(pkgdir);
    //            });
    //    }
    //    promises.push(promise);
    //});
    //return when.all(promises);
}

function toEndpoint(dir) {
    if (typeof dir === 'string') {
        return dissector.readEndpoint(path.resolve(dir));
    }
    return dir;
}

function _unbuild(silent) {
    return function (endpoint) {
        if (!endpoint) return;
        var dir = endpoint.canonicalDir;
        logger.verbose("unbuild", dir.substr(npd.config.prefix.length + 1));
        if (!endpoint.pkgmeta) return gentlyRm(dir);

        var pkgmeta = endpoint.pkgmeta;
        var modmeta = endpoint.modmeta;

        return Promise.resolve()
            .then(function () {
                return lifecycle.preuninstall(modmeta, dir);
            })
            .then(function () {
                return lifecycle.uninstall(modmeta, dir);
            })
            .tap(function () {
                if (!silent) console.log("unbuild " + (pkgmeta._id || pkgmeta.name));
            })
            .then(function () {
                return rmStuff(pkgmeta, dir);
            })
            .then(function () {
                return lifecycle.postuninstall(modmeta, dir);
            })
            .then(function () {
                return gentlyRm(dir);
            })
            .then(function () {
                return path.relative(npd.config.root, dir)
            })
            .tap(function (result) {
                console.log(result);
            });
    }
}

function gentlyRm(dir) {
    logger.verbose('unbuild rmDir', dir);
    return fs.removeAsync(dir);
}

function rmStuff(pkgmeta, dir) {
    var parent = path.dirname(dir);
    var gm = npd.config.dir;
    var top = gm === parent;

    logger.verbose("unbuild rmStuff", pkgmeta._id || pkgmeta.name, "from", gm);
    if (!top) logger.verbose("unbuild rmStuff", "in", parent);

    return Promise.map([rmBins], function (fn) {
        return fn(pkgmeta, dir, parent, top);
    });
}

function rmBins(pkgmeta, dir, parent, top) {
    if (!pkgmeta.bin) return;

    var binRoot = top ? npd.config.bin : path.resolve(parent, ".bin");
    logger.verbose('unbuild rmBins', [binRoot, pkgmeta.bin]);
    var bin = typeof pkgmeta.bin === 'string' ? toObject(pkgmeta.name, pkgmeta.bin) : pkgmeta.bin;
    return Promise.map(Object.keys(bin), function (name) {
        return rmBin(path.resolve(binRoot, name));
    })
}

function toObject(key, value) {
    var result = {};
    result[key] = value;
    return result;
}


function rmBin(path) {
    if (process.platform === "win32") {
        fs.removeSync(path + '.cmd');
        fs.removeSync(path);
    } else {
        fs.removeSync(path);
    }
}
