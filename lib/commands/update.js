"use strict";

var npd = require('../npd');

update.options = {
    pkgs: {
        position: 1,
        help: "the packages to update",
        list: true
    }
};
update.help = 'update package';

function update(logger, packages, opts) {
    npd.load(opts);
    return npd.actions.update(packages, logger);
}

update.line = function (logger, targets) {
    return update(logger, targets);
};

module.exports = update;
