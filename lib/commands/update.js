"use strict";

var noapconf = require('../noapconf');
var Project = require('../project');

update.abbr = 'u';
update.options = {
    pkgs: {
        position: 0,
        help: "the packages to update",
        list: true
    }
};
update.help = 'update package';

function update(logger, packages, opts) {
    var config = noapconf(opts).load();
    var project = new Project(config, logger);

    if (packages && !packages.length) {
        packages = null;
    }

    return project.update(packages, config);
}

update.line = function (logger, opts) {
    return update(logger, opts._, opts);
};

module.exports = update;