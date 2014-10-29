"use strict";

var _ = require('lodash');
var path = require('path');
var sh = require('./utils/sh');
var when = require('when');

var npmbin = path.resolve(__dirname, '../node_modules/.bin/npm');

exports.install = function (cwd) {
    return sh.execSync(npmbin + ' install', {cwd: cwd});
};
