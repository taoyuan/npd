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
 * @param {Array|String} pkgs
 * @param logger
 * @returns {Promise|*}
 */
function install(pkgs, logger) {
    if (!pkgs) pkgs = [];
    if (_.isString(pkgs)) pkgs = [pkgs];
    if (!logger) logger = new Logger();

    var dissector = new Dissector(npd.config, logger);

    var endpoints = pkgs.map(function (pkg) {
        return typeof pkg === 'string' ? ep.decompose(pkg) : pkg;
    });

    return dissector.readInstalled()
        .then(function (installed) {
            _.forEach(endpoints, function (endpoint) {
                endpoint.newly = true;
            });
            return dissector.resolve(endpoints).then(function (resolved) {
                _.forEach(resolved, function (endpoint) {
                    var local = installed[endpoint.name];
                    if (local) {
                        endpoint.pkgMeta = local.pkgMeta;
                        endpoint.npdMeta = local.npdMeta;
                    } else {
                        endpoint.missing = true;
                    }
                });
                return resolved;
            });
        })
        .then(function (resolved) {
            return build(resolved, logger);
        });

}
