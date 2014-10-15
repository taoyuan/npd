"use strict";

var npd = require('../npd');

install.abbr = 'i';
install.options = {
    pkgs: {
        position: 1,
        help: "the packages to install",
        list: true
    }
};
install.help = 'install package';

function install(logger, packages) {
    return npd.actions.install(packages, logger);
}

install.line = function (logger) {
    return install(logger, opts.pkgs);
};

module.exports = install;