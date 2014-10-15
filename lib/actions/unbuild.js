"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var npd = require('../npd');
var copy = require('../utils/copy');
var Lifecycle = require('../lifecycle');
var ndm = require('../ndm');

module.exports = unbuild;

/**
 *
 * @param {Object[]} endpoints
 * @param logger
 * @returns {When.Promise<U>|Promise|*}
 */
function unbuild(endpoints, logger) {
    if (!endpoints) endpoints = [];
    if (!_.isArray(endpoints)) endpoints = [endpoints];

    var lifecycle = new Lifecycle(npd.config, logger);

    var dir = path.resolve(npd.config.dir);

    return lifecycle.preuninstall(endpoints)
        .then(function () {
            _.forEach(endpoints, function (endpoint) {
                var name = endpoint.name;
                if (!endpoint.missing) {
                    var pkgdir = path.resolve(dir, name);
                    logger.action('uninstall', name, { name: name, dir: pkgdir });
                    ndm.remove(name);
                    rmBins(endpoint.pkgMeta);
                    rmPackage(pkgdir);
                }
            });
        });


    function rmBins(pkg) {
        if (!pkg.bin) return when.resolve();

        var c = npd.config;
        var binRoot = c.bin;//top ? c.globalBin : path.resolve(parent, ".bin");

        var bin = typeof pkg.bin === 'string' ? _.object([pkg.name], [pkg.bin]) : pkg.bin;
        _.forEach(bin, function (file, name) {
            rmBin(path.resolve(binRoot, name));
        });
    }

    function rmBin(path) {
        if (process.platform === "win32") {
            fs.removeSync(path + ".cmd");
            fs.removeSync(path);
        } else {
            fs.removeSync(path);
        }
    }

    function rmPackage(dir) {
        fs.removeSync(dir);
    }

}
