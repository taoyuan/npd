// useful helpers for bootstrapping install.
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var fs = require("fs-extra");
var path = require("path");

exports.noop = function () {
    // noop
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