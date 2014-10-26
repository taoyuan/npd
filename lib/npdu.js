"use strict";

// NPD Utils
var npd = require('./npd');
var sh = require('./utils/sh');

var npdu = module.exports = {};

npdu.chownSync = function (path) {
    var c = npd.config;
    var ug = c.user + (c.group ? ':' + c.group : '');
    var cmd = 'sudo chown -R ' + ug + ' ' + path;
    return sh.execSync(cmd);
};
