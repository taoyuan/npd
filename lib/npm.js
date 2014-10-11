"use strict";

var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var npm = require('npm');

exports.install = function (cwd) {
    return nfn.call(npm.load.bind(npm)).then(function (npm) {
        npm.prefix = cwd || process.cwd();
        return nfn.call(npm.commands.install);
    });
};