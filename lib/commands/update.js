"use strict";

var npd = require('../npd');

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
    npd.load(opts, true);
    return npd.actions.update(packages, logger);
}

update.line = function (logger, opts) {
    return update(logger, opts._, opts);
};

module.exports = update;