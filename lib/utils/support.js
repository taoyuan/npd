"use strict";

var path = require('path');
var fs = require('fs-extra');

exports.dirSupports = function (noap, app) {
    return exports.dirs(noap, ['etc', 'var', 'log'], app);
};

exports.dirs = function (noap) {
    var dirs, i, j, arg, arr;
    if (Array.isArray(noap)) {
        dirs = noap;
    } else if (typeof noap === 'string') {
        dirs = [noap];
    } else if (noap) {
        dirs = [noap.config.get('root')];
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