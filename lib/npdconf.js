"use strict";

var configure = require('./configure');

module.exports = function (opts) {
    return configure('npd', opts);
};
