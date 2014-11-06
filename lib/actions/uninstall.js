"use strict";

var _ = require('lodash');
var logger = require('../logs').logger;
var npd = require('../npd');
var Dissector = require('../dissector');

var unbuild = require('./unbuild');

module.exports = uninstall;

function uninstall(names) {
    if (!names) names = [];
    if (_.isString(names)) names = [names];

    var dissector = new Dissector(npd.config, logger);

    return dissector.readInstalled()
        .then(function (installed) {
            var endpoints = [];
            _.forEach(names, function (name) {
                var endpoint = installed[name];
                if (endpoint) {
                    endpoints.push(endpoint);
                } else {
                    logger.warn('not-installed', '\'' + name + '\'' + ' cannot be uninstalled as it is not currently installed', {
                        name: name
                    });
                }
            });
            return endpoints;
        })
        .then(function (endpoints) {
            return unbuild(endpoints, logger);
        });
}
