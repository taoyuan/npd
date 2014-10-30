"use strict";

var when = require('when');
var npd = require('./npd');
var scripts = require('./scripts');

module.exports = Lifecycle;

function Lifecycle(config, logger) {
    this._config = config;
    this._logger = logger;
}

Lifecycle.prototype.has = function (npdmeta, action) {
    return scripts.has(npdmeta, action);
};

Lifecycle.prototype.preinstall = hook('preinstall');
Lifecycle.prototype.install = hook('install');
Lifecycle.prototype.postinstall = hook('postinstall');
Lifecycle.prototype.preuninstall = hook('preuninstall');

function hook(action) {
    return function (npdmeta, cwd) {
        return scripts.run(npdmeta, action, cwd, this._logger, npd.config);
    };
}

