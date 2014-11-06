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

function update(packages, opts) {
    npd.load(opts);
    return npd.actions.update(packages);
}

update.line = function (targets) {
    return update(targets);
};

module.exports = update;
