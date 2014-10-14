"use strict";

var _ = require('lodash');
var path = require('path');
var npdconf = require('./npdconf');

var npd = module.exports = {};

Object.defineProperty(npd, 'config', {
    get: function () {
        if (npd._config) return npd._config;
        throw new Error('npd.load() required');
    }
});

npd.load = function (opts, reload) {
    if (_.isBoolean(opts)) {
        reload = opts;
        opts = null;
    }
    if (npd._config && !reload) return;

    npd._config = npdconf(opts);
};

Object.defineProperty(npd, 'actions', {
    get: function () {
        return require('./actions');
    },
    enumerable: true
});

Object.defineProperty(npd, 'commands', {
    get: function () {
        return require('./commands');
    },
    enumerable: true
});
