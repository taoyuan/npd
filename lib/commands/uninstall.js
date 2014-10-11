"use strict";

var npdconf = require('../npdconf');
var ep = require('../ep');
var Project = require('../project');

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

    var config = npdconf(opts);
    var project = new Project(config, logger);

    packages = packages || [];
    return project.uninstall(packages, config);
}

uninstall.line = function (logger, opts) {
    return uninstall(logger, opts._, opts);
};

module.exports = uninstall;