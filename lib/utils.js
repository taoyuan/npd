// useful helpers for bootstrapping install.
var _ = require('lodash');

var fs = require("fs-extra");
var path = require("path");
var sh = require('shelljs');
var chain = require("slide").chain;

exports.noop = function () {
    // noop
};

exports.link = link;
function link(from, to, cb) {
    to = path.resolve(to);
    var target = from = path.resolve(from);

    chain([
        [fs, "stat", from],
        [fs.remove, to],
        [fs.mkdirp, path.dirname(to)],
        [fs, "symlink", target, to, "junction"]
    ], cb);
}

exports.linkIfExists = linkIfExists;
function linkIfExists(from, to, gently, cb) {
    fs.stat(from, function (err) {
        if (err) return cb();
        link(from, to, gently, cb);
    });
}

exports.supportDirs = function (noap, app) {
    return exports.genDirs(noap, ['etc', 'var', 'log'], app);
};

exports.genDirs = function (noap) {
    var dirs, i, j, arg, arr;
    if (Array.isArray(noap)) {
        dirs = noap;
    } else if (typeof noap === 'string') {
        dirs = [noap];
    } else if (noap) {
        dirs = [noap.config.get('root') || '/'];
    } else {
        throw new Error('Invalid arguments');
    }

    for (i = 1; i < arguments.length; i++) {
        arg = arguments[i];
        if (Array.isArray(arg)) {
            arr = [];
            for (j = 0; j < arg.length; j++) {
                arr = arr.concat(resolve(dirs, arg[j]));
            }
        } else {
            arr = resolve(dirs, arg);
        }
        dirs = arr;
    }

    return dirs;
};

function resolve(root, arg) {
    if (Array.isArray(root)) {
        var result = [];
        for (var i = 0; i < root.length; i++) {
            result.push(path.resolve(root[i], arg));
        }
        return result;
    }
    return path.resolve(root, arg);
}

exports.ensureSync = function () {
    var dirs = exports.dirs.apply(null, arguments);
    for (var i = 0; i < dirs.length; i++) {
        fs.ensureDirSync(dirs[i]);
    }
};

exports.removeSync = function () {
    var dirs = exports.dirs.apply(null, arguments);
    for (var i = 0; i < dirs.length; i++) {
        fs.removeSync(dirs[i]);
    }
};