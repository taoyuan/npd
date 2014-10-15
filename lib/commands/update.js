"use strict";

var npd = require('../npd');

update.abbr = 'u';
update.options = {
    pkgs: {
        position: 1,
        help: "the packages to update",
        list: true
    }
};
update.help = 'update package';

function update(logger, packages) {
    return npd.actions.update(packages, logger);
}

update.line = function (logger, opts) {
    return update(logger, opts.pkgs);
};

module.exports = update;