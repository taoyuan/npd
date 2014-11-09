"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var logger = require('../logs').logger;
var npd = require('../npd');
var copy = require('../utils/copy');
var Lifecycle = require('../lifecycle');

module.exports = unbuild;

/**
 *
 * @param {Object[]} endpoints
 * @param logger
 * @returns {When.Promise<U>|Promise|*}
 */
function unbuild(endpoints) {
    return when.resolve();
    if (!endpoints) endpoints = [];
    if (!_.isArray(endpoints)) endpoints = [endpoints];

    var lifecycle = new Lifecycle(npd.config, logger);

    var c = npd.config;
    var dir = path.resolve(c.dir);

    var promises = [];
    _.forEach(endpoints, function (endpoint) {
        var promise = when.resolve();
        var name = endpoint.name;
        if (!endpoint.missing) {
            var pkgdir = path.resolve(dir, name);
            logger.action('uninstall', name, { name: name, dir: pkgdir });
            promise = promise
                .then(function () {
                    return lifecycle.preuninstall(endpoint.installed && endpoint.installed.modMeta, pkgdir);
                })
                .catch(function (err) {
                    if (!c.force) return err;
                    logger.debug('error', err.message, { error: err });
                    return null;
                })
                .then(function () {
                    return rmBins(endpoint.installed && endpoint.installed.pkgMeta);
                })
                .then(function () {
                    return rmPackage(pkgdir);
                });
        }
        promises.push(promise);
    });
    return when.all(promises);
}

function rmBins(pkg) {
    if (!pkg.bin) return when.resolve();

    var binRoot = npd.config.bin;
    var bin = typeof pkg.bin === 'string' ? _.object([pkg.name], [pkg.bin]) : pkg.bin;
    var promises = [];
    _.forEach(bin, function (file, name) {
        promises.push(rmBin(path.resolve(binRoot, name)));
    });
    return when.all(promises);
}

function rmBin(path) {
    if (process.platform === "win32") {
        return when.resolve()
            .then(removeFn(path + ".cmd"))
            .then(removeFn(path));
    } else {
        return remove(path);
    }
}

function rmPackage(dir) {
    return remove(dir);
}

function remove(dir) {
    return nfn.call(fs.remove, dir);
}

function removeFn(dir) {
    return function () {
        return remove(dir);
    };
}
