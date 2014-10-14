"use strict";

var npd = require('../npd');

uninstall.abbr = 'i';
uninstall.options = {
    pkgs: {
        position: 1,
        help: "the packages to uninstall",
        list: true
    }
};
uninstall.help = 'uninstall package';

function uninstall(logger, packages, opts) {
    return npd.actions.uninstall(packages, logger);
}

uninstall.line = function (logger, opts) {
    return uninstall(logger, opts.pkgs, opts);
};

module.exports = uninstall;