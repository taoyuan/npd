"use strict";

var npd = require('../npd');

uninstall.options = {
    pkgs: {
        position: 1,
        help: "the packages to uninstall",
        list: true
    }
};
uninstall.help = 'uninstall package';

function uninstall(logger, packages, opts) {
    npd.load(opts);
    return npd.actions.uninstall(packages, logger);
}

uninstall.line = function (logger, targets) {
    return uninstall(logger, targets);
};

module.exports = uninstall;
