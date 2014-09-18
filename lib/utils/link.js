"use strict";

module.exports = link;
link.ifExists = linkIfExists;

var fs = require("fs-extra")
    , chain = require("slide").chain
    , path = require("path");

function linkIfExists(from, to, gently, cb) {
    fs.stat(from, function (er) {
        if (er) return cb();
        link(from, to, gently, cb);
    })
}

function link(from, to, cb) {
    to = path.resolve(to);
    var target = from = path.resolve(from);
    if (process.platform !== "win32") {
        // junctions on windows must be absolute
        target = path.relative(path.dirname(to), from);
        // if there is no folder in common, then it will be much
        // longer, and using a relative link is dumb.
        if (target.length >= from.length) target = from;
    }

    chain([
        [fs, "stat", from],
        [fs.remove, to],
        [fs.mkdirp, path.dirname(to)],
        [fs, "symlink", target, to, "junction"]
    ], cb)
}
