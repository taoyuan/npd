"use strict";

var path = require('path');
var npdconf = require('./npdconf');
var log = require('./logger');

var npd = module.exports = {};

npd.load = function (opts) {
    return npdconf(opts);
};

Object.defineProperty(npd, 'commands', { get: function () {
    return require('./commands');
}, enumerable: true });
