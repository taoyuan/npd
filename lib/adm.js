"use strict";

var path = require('path');

var admconf = require('./admconf');
var logs = require('./logs');

var adm = exports = module.exports = {};

adm.config = {
    loaded: false,
    get: function() {
        throw new Error('adm.load() required')
    },
    set: function() {
        throw new Error('adm.load() required')
    }
};

var loaded = false
    , loading = false
    , loadErr = null
    , loadListeners = [];

function loadCb (er) {
    loadListeners.forEach(function (cb) {
        process.nextTick(cb.bind(adm, er, adm))
    });
    loadListeners.length = 0
}

adm.load = function (argv, cb) {
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
        if (adm.config.get("force")) {
            log.warn("using --force", "I sure hope you know what you are doing.")
        }
        adm.config.loaded = true;
        loaded = true;
        loadCb(loadErr = err);
        if (onload = onload && adm.config.get("onload-script")) {
            require(onload);
            onload = false;
        }
    }

    logs.logger.pause();

    load(adm, argv, done);
};

function load(adm, argv, done) {
    adm.config = admconf.load(argv);
    logs.logger.resume();
    done();
}

Object.defineProperty(adm, "repo", {
    get: function () {
        return adm.config.get('repo');
    },
    enumerable: true
});

Object.defineProperty(adm, "ptemp", {
    get: function () {
        return path.resolve(adm.config.get('temp'), 'adm-' + process.pid);
    },
    enumerable: true
});

Object.defineProperty(adm, "bin", {
    get: function () {
        return adm.config.get('bin');
    },
    enumerable: true
});