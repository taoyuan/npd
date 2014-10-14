"use strict";

var npd = require('../npd');

install.abbr = 'i';
install.options = {
    pkgs: {
        position: 0,
        help: "the packages to install",
        list: true
    }
};
install.help = 'install package';

function install(logger, packages, opts) {
    npd.load(opts, true);
    return npd.actions.install(packages, logger);
}

install.line = function (logger, opts) {
    return install(logger, opts._, opts);
};

module.exports = install;