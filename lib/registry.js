"use strict";

module.exports = Registry;

function Registry(config, logger) {
    this._logger = logger;
    this._config = config;
}

Registry.prototype.lookup = function (source, cb) {
    if (typeof source === 'function') {
        cb = source;
        source = null;
    }

    if (cb) cb();
};

Registry.prototype.clearCache = function (name, cb) {
    if (typeof name === 'function') {
        cb = name;
        name = null;
    }

    if (cb) cb();
};

Registry.prototype.resetCache = function () {

};

Registry.clearRuntimeCache = function () {

};