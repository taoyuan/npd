"use strict";

var npd = require('../npd');

uninstall.abbr = 'i';
uninstall.options = {
    pkgs: {
        position: 0,
        help: "the packages to uninstall",
        list: true
    }
};
uninstall.help = 'uninstall package';

function uninstall(logger, packages, opts) {
    npd.load(opts, true);
    return npd.actions.uninstall(packages, logger);
}

uninstall.line = function (logger, opts) {
    return uninstall(logger, opts._, opts);
};

module.exports = uninstall;