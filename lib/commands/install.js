"use strict";

var npd = require('../npd');

install.options = {
    pkgs: {
        position: 1,
        help: "the packages to install",
        list: true
    }
};
install.help = 'install package';

function install(logger, packages, opts) {
    npd.load(opts);
    return npd.actions.install(packages, logger);
}

install.line = function (logger, targets) {
    return install(logger, targets);
};

module.exports = install;
