"use strict";

var noap = require('../noap');
var endpointParser = require('../endpoint-parser');

module.exports = install;

install.abbr = 'i';
install.options = {
    app: {
        position: 0,
        help: "the packages to install",
        list: true
    }
};
install.help = 'install the application';

function install(logger, pkgs, opts) {
    noap.load(opts);

    // Convert pkgs to endpoints
    pkgs = pkgs || [];
    var endpoints = pkgs.map(function (pkg) {
        return endpointParser.decompose(pkg);
    });

}

install.line = function (logger, opts) {
    return install(logger, opts._, opts);
};