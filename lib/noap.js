"use strict";

var path = require('path');
var noapconf = require('./noapconf');

var noap = exports = module.exports = {};

noap.commands = {};

noap.config = {
    loaded: false,
    get: function () {
        throw new Error('npm.load() required')
    },
    set: function () {
        throw new Error('npm.load() required')
    }
};

var COMMANDS = [
    'install'
];

var loaded = false
    , loading = false
    , loadErr = null
    , loadListeners = [];

function loadCb(er) {
    loadListeners.forEach(function (cb) {
        process.nextTick(cb.bind(noap, er, noap))
    });
    loadListeners.length = 0
}

noap.load = function (cli, cb) {
    if (!cb && typeof cli === "function") {
        cb = cli;
        cli = {}
    }
    if (!cb) cb = function () {
    };
    loadListeners.push(cb);
    if (loaded || loadErr) return done(loadErr);
    if (loading) return;
    loading = true;
    var onload = true;

    function done(er) {
        if (loadErr) return;
        if (er) return cb(er);
        if (noap.config.get("force")) {
            log.warn("using --force", "I sure hope you know what you are doing.");
        }
        noap.config.loaded = true;
        loaded = true;
        loadCb(loadErr = er);
        if (onload = onload && noap.config.get("onload-script")) {
            require(onload);
            onload = false;
        }
    }

    load(noap, cli, done);
};

function load(noap, cli, cb) {
    noap.config = noapconf.load(cli);
    cb();
}

var commands = {};
COMMANDS.forEach(function addCommand(c) {
    Object.defineProperty(noap.commands, c, {
        get: function () {
            if (!loaded) throw new Error(
                    "Call noap.load(config, cb) before using this command.\n" +
                    "See the README.md or cli.js for example usage.");

            noap.command = c;

            if (commands[c]) return commands[c];

            return commands[c] = require(path.resolve(__dirname, c))

        },
        enumerable: true })

});
