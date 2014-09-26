"use strict";

var path = require('path');
var noapconf = require('./noapconf');
var log = require('./logger');

var noap = module.exports = {};

noap.config = {
    loaded: false,
    get: function () {
        throw new Error('noap.load() required');
    },
    set: function () {
        throw new Error('noap.load() required');
    }
};

var loaded = false;
var loadErr = null;

noap.load = function (opts) {
    load(opts);
};

function load(opts) {
    if (loaded || loadErr) return;
    try {
        _load(noap, opts);
        noap.config.loaded = true;
        loaded = true;
    } catch (e) {
        loadErr = e;
        throw e;
    }
}

function _load(noap, opts) {
    noap.config = noapconf(opts);
}

Object.defineProperty(noap, 'commands', { get: function () {
    return require('./commands');
}, enumerable: true });

Object.defineProperty(noap, 'repo', { get: function () {
    return noap.config.get('repo');
}, enumerable: true });

Object.defineProperty(noap, "ptemp", {
    get: function () {
        return path.resolve(noap.config.get('temp'), 'noap-' + process.pid);
    },
    enumerable: true
});

Object.defineProperty(noap, "bin", {
    get: function () {
        return path.resolve(noap.config.get('prefix'), 'bin');
    },
    enumerable: true
});