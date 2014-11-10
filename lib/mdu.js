/**
 * MetaData Utilities
 */

var _ = require('lodash');
var path = require('path');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

var __slice = Array.prototype.slice;

var DEFAULT_METADATA = {
    dir: {
        mods: 'modules'
    },
    extensions: {}
};

exports.readJson = readJson;
function readJson(where, name, options) {
    if (typeof name === 'object') {
        options = name;
        name = null;
    }
    var file = path.resolve(where, name ? name : '');
    options = options || {};
    return fs.readJsonAsync(file, options).catch(function (err) {
        if (!options.throws) return null;
        throw err;
    });
}

exports.readModuleJson = readModuleJson;
function readModuleJson(where, options) {
    options = options || {};
    var file = path.resolve(where, 'module.json');
    return readJson(file, options)
        .catch(function (err) {
            if (!options.throws) return null;

            if (err.cause) err = err.cause;

            if (err.code === 'ENOENT') {
                err.code = 'ENOMODULEJSON';
            }

            if (err instanceof SyntaxError) {
                err.file = path.resolve(file);
                err.code = 'EMALFORMED';
            }

            err.details = err.message;

            throw err;
        })
        .then(function (data) {
            if (!data) return null;
            return _.defaults(data, DEFAULT_METADATA);
        });
}

exports.requireModuleJson = requireModuleJson;
function requireModuleJson(data, where) {
    return data ? Promise.resolve(data) : readModuleJson(where);
}

exports.readDotPkgJson = readDotPkgJson;
function readDotPkgJson(where, options) {
    return readJson(where, '.package.json', options);
}

exports.readJsons = readJsons;
function readJsons(where) {
    var args = __slice.call(arguments, 1);
    return Promise.map(args, function (arg) {
        if (!Array.isArray(arg)) arg = [arg];
        for (var i = 0; i < arg.length; i++) {
            try {
                var data = fs.readJsonSync(path.resolve(where, arg[i]));
                if (data) return data;
            } catch (e) {

            }
        }
    });
}

exports.readMetas = readMetas;
function readMetas(where) {
    return readJsons(where, 'module.json', 'package.json');
}

exports.modsdir = modsdir;
function modsdir(config) {
    if (config && config.global) {
        return config.dir;
    }
    var dir;
    var args = __slice.call(arguments, 1), arg;
    for (var i = 0; i < args.length; i++) {
        if (!args[i]) continue;
        arg = args[i];
        dir = arg.directories && arg.directories.mods;
        if (dir) return dir;
    }

    return 'modules';
}
