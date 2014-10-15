"use strict";

var _ = require('lodash');
var npd = require('../npd');
var ndm = require('../ndm');
var utils = require('../utils');

restart.options = {
    pkgs: {
        position: 1,
        help: "the packages to restart",
        list: true
    }
};
restart.help = 'restart all services of packages.';

function restart(logger, packages) {
    utils.checkPackages(npd.config.dir, packages);

    _.forEach(packages, function (pkg) {
        ndm.restart(pkg);
    });
}

restart.line = function (logger, opts) {
    return restart(logger, opts.pkgs);
};

module.exports = restart;