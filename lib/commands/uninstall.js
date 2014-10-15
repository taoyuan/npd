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

function uninstall(logger, packages) {
    return npd.actions.uninstall(packages, logger);
}

uninstall.line = function (logger) {
    return uninstall(logger, opts.pkgs);
};

module.exports = uninstall;