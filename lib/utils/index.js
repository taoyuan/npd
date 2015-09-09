// useful helpers for bootstrapping install.
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var Promise = require('bluebird');
var fs = require("fs-extra");
var path = require("path");
var errors = require('../errors');

exports.noop = function () {
    // noop
};

exports.defer = function defer() {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

exports.checkPackages = function (dir, packages) {
    _.forEach(packages, function (pkg) {
        if (!fs.existsSync(path.resolve(dir, pkg))) {
            throw errors.create('Package `' + pkg + '` is not installed', 'ENOTINS', { name: pkg });
        }
    });
};

exports.readModuleJson = function (dir) {
    var npdFile = path.join(dir, 'module.json');
    if (fs.existsSync(npdFile)) {
        return fs.readJsonSync(npdFile);
    }
    return null;
};

exports.readJson = function readJson(file, options) {
    options = options || {};

    // Read
    return nfn.call(fs.readJson, file, options)
        .catch(function (err) {
            // No json file was found, assume one
            if (err.code === 'ENOENT' && options.assume) {
                when.reject('NOTFOUND');
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


exports.lookup = function (hosts) {

    return lookup;

    function lookup(shorthand) {
        var target;
        if (!shorthand) {
            return lookup(Object.keys(hosts)[0]);
        }
        target = hosts[shorthand];
        if (target && target[0] === '@') return lookup(target.substr(1));
        return target;
    }

};
