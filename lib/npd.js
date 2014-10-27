"use strict";

var _ = require('lodash');
var path = require('path');
var npdconf = require('./npdconf');
var sh = require('./utils/sh');

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

npd.chown = function (path) {
    var c = npd.config;
    var ug = c.uid + (c.gid ? ':' + c.gid : '');
    var cmd = 'chown -R ' + ug + ' ' + path;
    if (c.sudo) cmd = 'sudo ' + cmd;
    return sh.execSync(cmd);
};
