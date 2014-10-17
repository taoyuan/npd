"use strict";

var npd = require('../npd');

root.help = 'just prints the root folder';

function root() {
    return console.log(npd.config.dir);
}

root.line = function (logger, opts) {
    return root(logger, opts.pkgs);
};

module.exports = root;