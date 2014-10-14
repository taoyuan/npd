"use strict";

var _ = require('lodash');
var Logger = require('bower-logger');
var ep = require('../ep');
var npd = require('../npd');
var Dissector = require('../dissector');

var build = require('./build');

module.exports = install;

/**
 *
 * @param {String[]|String} pkgs
 * @param logger
 * @returns {When.Promise<U>|Promise|*}
 */
function install(pkgs, logger) {
    if (!pkgs) pkgs = [];
    if (_.isString(pkgs)) pkgs = [pkgs];
    if (!logger) logger = new Logger();

    var dissector = new Dissector(npd.config, logger);

    var endpoints = pkgs.map(function (pkg) {
        return ep.decompose(pkg);
    });

    return dissector.readInstalled()
        .then(function (installed) {
            _.forEach(endpoints, function (endpoint) {
                var local = installed[endpoint.name];
                if (!local) {
                    endpoint.missing = true;
                } else {
                    var compatible = json.target === local.pkgMeta._target;
                    if (!compatible) {
                        endpoint.pkgMeta = local.pkgMeta;
                        endpoint.canonicalDir = local.canonicalDir;
                        endpoint.incompatible = true;
                    } else {
                        _.defaults(endpoint, local);
                    }

                    if (compatible) {
                        var originalSource = local.pkgMeta && local.pkgMeta._originalSource;
                        if (originalSource && originalSource !== endpoint.source) {
                            endpoint.different = true;
                        }
                    }
                }
            });
            return endpoints;
        })
        .then(function (endpoints) {
            _.forEach(endpoints, function (endpoint) {
                if (endpoint.missing) endpoint.newly = true;
            });
            return dissector.resolve(endpoints);
        })
        .then(function (dissected) {
            return build(dissected, logger);
        });

}
