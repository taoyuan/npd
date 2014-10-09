// useful helpers for bootstrapping install.
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var fs = require("fs-extra");
var path = require("path");
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

//////////////////////////////////////////

exports.readJson = function readJson(file, options) {
    options = options || {};

    // Read
    return nfn.call(fs.readJsonFile, file, options)
        .catch(function (err) {
            // No json file was found, assume one
            if (err.code === 'ENOENT' && options.assume) {
                when.reject('NOTFOUND');
//                return [bowerJson.parse(options.assume, options), false, true];
            }

            if (err instanceof SyntaxError) {
                err.file = path.resolve(file);
                err.code = 'EMALFORMED';
            }

            err.details = err.message;

            if (err.file) {
                err.message = 'Failed to read ' + err.file;
                err.data = { filename: err.file };
            } else {
                err.message = 'Failed to read json from ' + file;
            }

            throw err;
        });
};