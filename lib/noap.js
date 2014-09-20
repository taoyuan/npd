"use strict";

var path = require('path');

var noapconf = require('./noapconf');
var logs = require('./logs');

var noap = exports = module.exports = {};

noap.config = {
    loaded: false,
    get: function() {
        throw new Error('noap.load() required')
    },
    set: function() {
        throw new Error('noap.load() required')
    }
};

var loaded = false
    , loading = false
    , loadErr = null
    , loadListeners = [];

function loadCb (er) {
    loadListeners.forEach(function (cb) {
        process.nextTick(cb.bind(noap, er, noap))
    });
    loadListeners.length = 0
}

noap.load = function (argv, cb) {
    if (!cb && typeof argv === "function") {
        cb = argv ;
        argv = null;
    }
    if (!cb) cb = function () {};
    loadListeners.push(cb);
    if (loaded || loadErr) return done(loadErr);
    if (loading) return;
    loading = true;
    var onload = true;

    function done (err) {
        if (loadErr) return;
        if (err) return cb(err);
        if (noap.config.get("force")) {
            log.warn("using --force", "I sure hope you know what you are doing.")
        }
        noap.config.loaded = true;
        loaded = true;
        loadCb(loadErr = err);
        if (onload = onload && noap.config.get("onload-script")) {
            require(onload);
            onload = false;
        }
    }

    logs.logger.pause();

    load(noap, argv, done);
};

function load(noap, argv, done) {
    noap.config = noapconf.load(argv);
    logs.logger.resume();
    done();
}

Object.defineProperty(noap, "repo", {
    get: function () {
        return noap.config.get('repo');
    },
    enumerable: true
});

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