// useful helpers for bootstrapping install.
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var fs = require("fs-extra");
var path = require("path");
var errors = require('../errors');

exports.noop = function () {
    // noop
};

exports.checkPackages = function (dir, packages) {
    _.forEach(packages, function (pkg) {
        if (!fs.existsSync(path.resolve(dir, pkg))) {
            throw errors.create('Package `' + name + '` is not installed', 'ENOTINS', { name: pkg });
        }
    });
};

exports.readJson = function readJson(file, options) {
    options = options || {};

    // Read
    return nfn.call(fs.readJsonFile, file, options)
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