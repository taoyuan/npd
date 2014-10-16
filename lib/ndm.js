"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var npd = require('./npd');
var sh = require('./utils/sh');

var ndm = module.exports = {};

function wrap(command) {
    return function (pkg, opts) {
        var dir = path.resolve(npd.config.dir, pkg);

        if (!fs.existsSync(path.resolve(dir, 'service.json'))) {
            return when.resolve();
        }

        var cmd = ndm.cmdify(command, opts);
        return ndm.exec(cmd, {cwd: dir, silent: true});
    };
}

ndm.bin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'ndm');

ndm.cmdify = function cmdify(command, opts) {
    var args = '';
    opts = opts || {};
    _.forEach(opts, function (v, k) {
        if (_.isNull(v) || _.isUndefined(v)) return;
        args += ' --' + k + '=' + v;
    });

    return ndm.bin + ' ' + command + args;
};

ndm.exec = function exec(cmd, opts) {
    try {
        var result = sh.execSync(cmd, opts);
        console.log(result);
    } catch(e) {
        console.error(e.message);
    }
};

ndm.install = wrap('generate');
ndm.remove = wrap('remove');
ndm.start = wrap('start');
ndm.stop = wrap('stop');
ndm.restart = wrap('restart');