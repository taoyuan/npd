"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var scripts = require('./scripts');

module.exports = Lifecycle;

function Lifecycle(config, logger) {
    this._config = config;
    this._logger = logger;
}

Lifecycle.prototype.preinstall = function preinstall(targets) {
    var that = this;
    var dir = path.resolve(this._config.dir);

    // If nothing to install, skip the code bellow
    if (_.isEmpty(targets)) {
        return when.resolve({});
    }

    return nfn.call(fs.mkdirp, dir)
        .then(function () {
            return scripts.preinstall(that._config, that._logger, targets);
        });
};

Lifecycle.prototype.postinstall = function postinstall(targets) {
    var that = this;
    var dir = path.resolve(this._config.dir);

    // If nothing to install, skip the code bellow
    if (_.isEmpty(targets)) {
        return when.resolve({});
    }

    return nfn.call(fs.mkdirp, dir)
        .then(function () {
            return scripts.postinstall(that._config, that._logger, targets);
        });
};

Lifecycle.prototype.preuninstall = function preuninstall(targets) {
    var that = this;
    var dir = path.resolve(this._config.dir);

    // If nothing to install, skip the code bellow
    if (_.isEmpty(targets)) {
        return when.resolve({});
    }

    return nfn.call(fs.mkdirp, dir)
        .then(function () {
            return scripts.preuninstall(that._config, that._logger, targets);
        });
};

