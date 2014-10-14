"use strict";

var _ = require('lodash');
var npd = require('../npd');
var errors = require('../errors');
var Dissector = require('../dissector');

var build = require('./build');

module.exports = update;

function update(names, logger) {
    if (!names) names = [];
    if (_.isString(names)) names = [names];
    if (!logger) logger = new Logger();

    var dissector = new Dissector(npd.config, logger);

    return dissector.readInstalled()
        .then(function (installed) {
            var endpoints = [];
            if (_.isEmpty(names)) {
                _.forEach(installed, function (endpoint) {
                    endpoints.push(endpoint);
                });
            } else {
                // Error out if some of the specified names
                // are not installed
                _.forEach(names, function (name) {
                    if (!installed[name]) {
                        throw errors.create('Package ' + name + ' is not installed', 'ENOTINS', { name: name });
                    }
                });
                _.forEach(names, function (name) {
                    endpoints.push(installed[name]);
                });
            }
            return endpoints;
        })
        .then(function (endpoints) {
            return dissector.resolve(endpoints);
        })
        .then(function (dissected) {
            return build(dissected, logger);
        });
}