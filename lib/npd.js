"use strict";

var path = require('path');
var npdconf = require('./npdconf');
var log = require('./logger');

var npd = module.exports = {};

var unconfigged = {
    loaded: false,
    get: function () {
        throw new Error('npd.load() required');
    },
    set: function () {
        throw new Error('npd.load() required');
    }
};

var loaded = false;
var loadErr = null;

npd.reset = function () {
    npd.config = unconfigged;
    loaded = false;
    loadErr = null;
};

npd.load = function (opts) {
    load(opts);
};

function load(opts) {
    if (loaded || loadErr) return;
    try {
        _load(npd, opts);
        npd.config.loaded = true;
        loaded = true;
    } catch (e) {
        loadErr = e;
        throw e;
    }
}

function _load(npd, opts) {
    npd.config = npdconf(opts);
}

Object.defineProperty(npd, 'commands', { get: function () {
    return require('./commands');
}, enumerable: true });

Object.defineProperty(npd, 'repo', { get: function () {
    return npd.config.get('repo');
}, enumerable: true });

Object.defineProperty(npd, "ptemp", {
    get: function () {
        return path.resolve(npd.config.get('temp'), 'npd-' + process.pid);
    },
    enumerable: true
});

Object.defineProperty(npd, "bin", {
    get: function () {
        return path.resolve(npd.config.get('prefix'), 'bin');
    },
    enumerable: true
});

npd.reset();