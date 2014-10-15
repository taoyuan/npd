"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var npd = require('./npd');
var sh = require('./utils/sh');

function ndm(command) {
    return function (pkg, opts) {
        var dir = path.resolve(npd.config.dir, pkg);

        if (fs.existsSync(path.resolve(dir, 'service.json')))
            return ndm.exec(ndm.cmdify(command, opts), {cwd: dir});
    }
}

ndm.bin = path.resolve(__dirname, 'node_modules', '.bin', 'ndm');

ndm.cmdify = function cmdify(command, opts) {
    var args = '';
    opts && _.forEach(opts, function (v, k) {
        if (_.isNull(v) || _.isUndefined(v)) return;
        args += ' --' + k + '=' + v;
    });

    return ndm.bin + ' ' + command + args;
};

ndm.exec = function exec(cmd, opts) {
    return sh.execSync(cmd, opts);
};

module.exports = ndm;
ndm.install = ndm('generate');
ndm.remove = ndm('remove');
ndm.start = ndm('start');
ndm.stop = ndm('stop');
ndm.restart = ndm('restart');