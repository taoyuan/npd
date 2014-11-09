/**
 * MetaData Utilities
 */

var _ = require('lodash');
var path = require('path');


var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

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
    var file = name ? path.join(where, name) : where;
    options = options || {};
    return fs.readJsonAsync(file, options).catch(function (err) {
        if (!options.throw) return null;
        throw err;
    });
}

exports.readModuleJson = readModuleJson;
function readModuleJson(where, options) {
    options = options || {};
    return readJson(where, 'module.json', options)
        .catch(function (err) {
            if (!options.throw) return null;

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

exports.readMetas = readMetas;
function readMetas(where) {
    return Promise.all([
        readJson(where, 'module.json'),
        readJson(where, 'package.json')
    ]);
}
