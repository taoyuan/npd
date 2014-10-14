"use strict";

var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var npm = require('npm');

Object.defineProperty(exports, "modes", {
    get: function () {
        return npm.modes;
    }
});

Object.defineProperty(exports, "config", {
    get: function () {
        return npm.config;
    }
});

exports.install = function (cwd) {
    return nfn.call(npm.load.bind(npm)).then(function (npm) {
        var _prefix = npm.prefix;
        npm.prefix = cwd || process.cwd();
        return nfn.call(npm.commands.install).finally(function () {
            npm.prefix = _prefix;
        });
    });
};