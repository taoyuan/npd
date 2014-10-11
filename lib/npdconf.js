"use strict";

var Configure = require('./configure');

module.exports = function (opts) {
    if (opts instanceof Configure) return opts;
    return new Configure('npd', opts);
};

module.exports.Configure = Configure;
