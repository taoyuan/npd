"use strict";

var path = require('path');
var osenv = require("osenv");

var home = osenv.home();
var tempRoot = osenv.tmpdir();

var uidOrPid = process.getuid ? process.getuid() : process.pid;

if (home) {
    process.env.HOME = home;
} else {
    home = path.resolve(tempRoot, "sorb-" + uidOrPid);
}

var tempExtra = process.platform === "win32" ? "sorb-temp" : ".sorb";
var temp = path.resolve(tempRoot, tempExtra);

module.exports = function () {
    var bin;
    if (process.env.BIN) {
        bin = process.env.BIN
    } else if (process.platform === "win32") {
        // c:\node\node.exe --> bin=c:\node\
        bin = path.dirname(process.execPath)
    } else {
        // /usr/local/bin/node --> bin=/usr/local
        bin = path.dirname(path.dirname(process.execPath))

        // destdir only is respected on Unix
        if (process.env.DESTDIR) {
            bin = path.join(process.env.DESTDIR, bin)
        }
    }

    return {
        root: '/',
        repo: '/apps',
        home: home,
        temproot: tempRoot,
        temp: temp,
        bin: bin
    }
};