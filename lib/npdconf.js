"use strict";

var Config = require('./config');

module.exports = function (opts) {
    if (opts instanceof Config) return opts;
    return new Config('npd', opts);
};

module.exports.Config = Config;
