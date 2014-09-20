"use strict";

var path = require('path');
var osenv = require("osenv");

var home = osenv.home();
var tempRoot = osenv.tmpdir();

var uidOrPid = process.getuid ? process.getuid() : process.pid;

if (home) {
    process.env.HOME = home;
} else {
    home = path.resolve(tempRoot, "noap-" + uidOrPid);
}

var tempExtra = process.platform === "win32" ? "noap-temp" : ".noap";
var temp = path.resolve(tempRoot, tempExtra);

module.exports = function () {
    var prefix;
    if (process.env.PREFIX) {
        prefix = process.env.PREFIX
    } else if (process.platform === "win32") {
        // c:\node\node.exe --> bin=c:\node\
        prefix = path.dirname(process.execPath)
    } else {
        // /usr/local/bin/node --> bin=/usr/local
        prefix = path.dirname(path.dirname(process.execPath));

        // destdir only is respected on Unix
        if (process.env.DESTDIR) {
            prefix = path.join(process.env.DESTDIR, prefix)
        }
    }

    return {
        root: '/',
        repo: '/noaps',
        home: home,
        temproot: tempRoot,
        temp: temp,
        prefix: prefix
    }
};