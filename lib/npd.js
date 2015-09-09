var _ = require('lodash');
var path = require('path');
var npdconf = require('./npdconf');
var sh = require('./utils/sh');

var npd = module.exports = {};

npd.load = function (opts) {
    if (opts || !npd._config) _load(opts || {});
};

function _load(opts) {
    npd._config = npdconf(opts);

    var umask = npd.config.umask;
    npd.modes = {
        exec: 0777 & (~umask),
        file: 0666 & (~umask),
        umask: umask
    };
}

Object.defineProperty(npd, 'config', {
    get: function () {
        if (npd._config) return npd._config;
        throw new Error('npd.load() required');
    }
});

Object.defineProperty(npd, 'actions', {
    get: function () {
        return require('./actions');
    },
    enumerable: true
});

Object.defineProperty(npd, 'commands', {
    get: function () {
        return require('./commands');
    },
    enumerable: true
});

npd.chown = function (path) {
    var c = npd.config;
    if (process.getuid() !== 0 || !c.uid) return;

    var ug = c.uid + (c.gid ? ':' + c.gid : '');
    var cmd = 'chown -R ' + ug + ' ' + path;
    if (c.sudo) cmd = 'sudo ' + cmd;
    return sh.execSync(cmd);
};
