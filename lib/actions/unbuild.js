"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var sequence = require('when/sequence');
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
function unbuild(endpoints, logger) {
    if (!endpoints) endpoints = [];
    if (!_.isArray(endpoints)) endpoints = [endpoints];

    var lifecycle = new Lifecycle(npd.config, logger);

    var dir = path.resolve(npd.config.dir);

    return lifecycle.preuninstall(endpoints)
        .then(function () {
            _.forEach(endpoints, function (endpoint) {
                var name =  endpoint.name;
                if (endpoint.missing) {
                    logger.warn('not-installed', '\'' + endpoint.name + '\'' + ' cannot be uninstalled as it is not currently installed', {
                        name: endpoint.name
                    });
                } else {
                    var pkgdir = path.resolve(dir, name);
                    logger.action('uninstall', name, { name: name, dir: pkgdir });
                    rmBins(endpoint.pkgMeta, dir, npd.config.global);
                    rmPackage(pkgdir);
                }
            });
        });


    function rmBins(pkg, parent, top) {
        if (!pkg.bin) return when.resolve();

        var c = npd.config;
        var binRoot = top ? c.globalBin : path.resolve(parent, ".bin");

        _.forEach(pkg.bin, function (bin, name) {
            if (process.platform === "win32") {
                fs.removeSync(path.resolve(binRoot, name) + ".cmd");
                fs.removeSync(path.resolve(binRoot, name));
            } else {
                fs.removeSync(path.resolve(binRoot, name));
            }
        });

    }

    function rmPackage(dir) {
        fs.removeSync(dir);
    }

}
