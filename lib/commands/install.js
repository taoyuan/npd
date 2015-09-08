"use strict";

var npd = require('../npd');
var logger = require('../logs').logger;

install.options = {
  pkgs: {
    position: 1,
    help: "the packages to install",
    list: true
  }
};
install.help = 'install package';

function install(packages, opts) {
  npd.load(opts);
  return npd.actions.install(packages);
}

install.line = function (targets) {
  return install(targets);
};

module.exports = install;
