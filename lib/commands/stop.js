"use strict";

var _ = require('lodash');
var npd = require('../npd');
var ndm = require('../ndm');
var utils = require('../utils');

stop.options = {
    pkgs: {
        position: 1,
        help: "the packages to stop",
        list: true
    }
};
stop.help = 'stop all services of packages.';

function stop(logger, packages) {
    utils.checkPackages(npd.config.dir, packages);

    _.forEach(packages, function (pkg) {
        ndm.stop(pkg);
    });
}

stop.line = function (logger, opts) {
    return stop(logger, opts.pkgs);
};

module.exports = stop;