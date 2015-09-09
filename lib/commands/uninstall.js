"use strict";

var npd = require('../npd');

uninstall.options = {
  pkgs: {
    position: 1,
    help: "the packages to uninstall",
    list: true
  }
};
uninstall.help = 'uninstall package';

function uninstall(packages, opts) {
  npd.load(opts);
  return npd.actions.uninstall(packages);
}

uninstall.line = function (targets) {
  return uninstall(targets);
};

module.exports = uninstall;
