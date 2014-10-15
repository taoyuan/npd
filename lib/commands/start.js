"use strict";

var _ = require('lodash');
var npd = require('../npd');
var ndm = require('../ndm');
var utils = require('../utils');

start.options = {
    pkgs: {
        position: 1,
        help: "the packages to start",
        list: true
    }
};
start.help = 'start all services of packages.';

function start(logger, packages) {
    utils.checkPackages(npd.config.dir, packages);

    _.forEach(packages, function (pkg) {
        ndm.start(pkg);
    });
}

start.line = function (logger, opts) {
    return start(logger, opts.pkgs);
};

module.exports = start;