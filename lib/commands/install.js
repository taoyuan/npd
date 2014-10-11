"use strict";

var npdconf = require('../npdconf');
var ep = require('../ep');
var Project = require('../project');

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

    var config = npdconf(opts);
    var project = new Project(config, logger);

    // Convert packages to endpoints
    packages = packages || [];
    var endpoints = packages.map(function (pkg) {
        return ep.decompose(pkg);
    });

    return project.install(endpoints, config);
}

install.line = function (logger, opts) {
    return install(logger, opts._, opts);
};

module.exports = install;