"use strict";

var path = require('path');

var configs = require('./configs');
var logs = require('./logs');

var sorb = exports = module.exports = {};

sorb.config = {
    loaded: false,
    get: function() {
        throw new Error('sorb.load() required')
    },
    set: function() {
        throw new Error('sorb.load() required')
    }
};

var loaded = false
    , loading = false
    , loadErr = null
    , loadListeners = [];

function loadCb (er) {
    loadListeners.forEach(function (cb) {
        process.nextTick(cb.bind(sorb, er, sorb))
    });
    loadListeners.length = 0
}

sorb.load = function (argv, cb) {
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
        if (sorb.config.get("force")) {
            log.warn("using --force", "I sure hope you know what you are doing.")
        }
        sorb.config.loaded = true;
        loaded = true;
        loadCb(loadErr = err);
        if (onload = onload && sorb.config.get("onload-script")) {
            require(onload);
            onload = false;
        }
    }

    logs.logger.pause();

    load(sorb, argv, done);
};

function load(sorb, argv, done) {
    sorb.config = configs.load(argv);
    logs.logger.resume();
    done();
}

Object.defineProperty(sorb, "repo", {
    get: function () {
        return sorb.config.get('repo');
    },
    enumerable: true
});

Object.defineProperty(sorb, "ptemp", {
    get: function () {
        return path.resolve(sorb.config.get('temp'), 'sorb-' + process.pid);
    },
    enumerable: true
});

Object.defineProperty(sorb, "bin", {
    get: function () {
        return sorb.config.get('bin');
    },
    enumerable: true
});