"use strict";

var async = require('async');
var path = require('path');
var chain = require("slide").chain;
var npm = require('npm');
var noapconf = require('./noapconf');
var utils = require('./utils');
var log = require('./logger');

var noap = exports = module.exports = {};

var commandCache = {};
noap.commands = {};

noap.config = {
    loaded: false,
    get: function () {
        throw new Error('noap.load() required');
    },
    set: function () {
        throw new Error('noap.load() required');
    }
};

var COMMANDS = [
    'install'
];

function defaultCb(err, data) {
    if (err) console.error(err.stack || err.message);
    else console.log(data);
}

var loaded = false;
var loading = false;
var loadErr = null;
var loadListeners = [];

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
    if (!cb) cb = utils.noop;

    chain([
        [load, cli],
        [npm, 'load']
    ], cb);
};

function load(cli, cb) {
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

    _load(noap, cli, done);
}

function _load(noap, cli, cb) {
    noap.config = noapconf.load(cli);
    cb();
}

Object.defineProperty(noap, 'npm', { get: function () {
    if (!loaded) throw new Error('noap.load() required');
    return npm;
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

COMMANDS.forEach(function addCommand(c) {
    Object.defineProperty(noap.commands, c, { get: function () {
//        if (!loaded) throw new Error(
//                "Call noap.load(config, cb) before using this command.\n" +
//                "See the README.md or cli.js for example usage.");

        if (commandCache[c]) return commandCache[c];

        var cmd = require(path.resolve(__dirname, c));

        var command = function () {
            noap.command = c;
            var args = Array.prototype.slice.call(arguments, 0);
            if (typeof args[args.length - 1] !== "function") {
                args.push(defaultCb);
            }
            if (args.length === 1) args.unshift([]);

            return cmd.apply(noap, args);
        };

        Object.keys(cmd).forEach(function (k) {
            command[k] = cmd[k]
        });

        return commandCache[c] = command;
    }, enumerable: true });
});

// the better to repl you with
Object.getOwnPropertyNames(noap.commands).forEach(function (n) {
    if (noap.hasOwnProperty(n) || n === "config") return;

    Object.defineProperty(noap, n, { get: function () {
        return function () {
            var args = Array.prototype.slice.call(arguments, 0);
            var cb = defaultCb;

            if (args.length === 1 && Array.isArray(args[0])) {
                args = args[0];
            }

            if (typeof args[args.length - 1] === "function") {
                cb = args.pop();
            }

            noap.commands[n](args, cb)
        }
    }, enumerable: false, configurable: true });
});

