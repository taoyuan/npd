"use strict";

var _ = require('lodash');
var path = require('path');
var sh = require('./utils/sh');
var when = require('when');

var npmbin = sh.which('npm');

exports.install = function (cwd, silent) {
  return sh.execSync([npmbin, 'install', '--unsafe-perm', 'true'].join(' '), {cwd: cwd, silent: silent !== false});
};
