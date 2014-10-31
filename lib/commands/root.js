"use strict";

var when = require('when');
var npd = require('../npd');

root.help = 'just prints the root folder';

function root(logger, opts) {
    npd.load(opts);
    console.log(npd.config.dir);
    return when.resolve(npd.config.dir);
}

root.line = function (logger) {
    return root(logger);
};

module.exports = root;
