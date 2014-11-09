"use strict";

var when = require('when');
var npd = require('./npd');
var logger = require('./logs').logger;
var scripts = require('./scripts');

var lifecycle = exports;

lifecycle.has = function (modmeta, action) {
    return scripts.has(modmeta, action);
};

lifecycle.preinstall = hook('preinstall');
lifecycle.install = hook('install');
lifecycle.postinstall = hook('postinstall');
lifecycle.preuninstall = hook('preuninstall');

function hook(action) {
    return function (modmeta, cwd) {
        return scripts.run(modmeta, action, cwd, logger, npd.config);
    };
}

