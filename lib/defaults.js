"use strict";

var path = require('path');
var osenv = require("osenv");
var crypto = require('crypto');

var home = osenv.home();

var uidOrPid = process.getuid ? process.getuid() : process.pid;

if (home) {
    process.env.HOME = home;
} else {
    home = path.resolve(temproot, "noap-" + uidOrPid);
}

var user = (osenv.user() || generateFakeUser()).replace(/\\/g, '-');
var temproot = path.join(osenv.tmpdir(), user);
var temp = path.resolve(temproot, 'noap');

function generateFakeUser() {
    var uid = process.pid + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    return crypto.createHash('md5').update(uid).digest('hex');
}

module.exports = function () {
    var prefix;
    if (process.env.PREFIX) {
        prefix = process.env.PREFIX
    } else {
        // /usr/local/bin/node --> bin=/usr/local
        prefix = path.dirname(path.dirname(process.execPath));

        // dest dir only is respected on Unix
        if (process.env.DESTDIR) {
            prefix = path.join(process.env.DESTDIR, prefix);
        }
    }

    return {
        root: '/',
        repo: '/opt',
        home: home,
        temproot: temproot,
        temp: temp,
        tmp: temp,
        prefix: prefix
    }
};