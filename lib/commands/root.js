"use strict";

var Promise = require('bluebird');
var npd = require('../npd');

root.help = 'just prints the root folder';

function root(opts) {
    npd.load(opts);
    console.log(npd.config.dir);
    return Promise.resolve(npd.config.dir);
}

root.line = function () {
    return root();
};

module.exports = root;
