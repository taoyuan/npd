"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var noap = require('./noap');

function outdated(args, silent, cb) {
    if (typeof silent === 'function') {
        cb = silent;
        silent = false;
    }

    var dir = path.resolve(noap.repo);

    var apps;
    if (args.length > 0) {
        apps = _.filter(args, function (arg) {
            return isPackage(path.resolve(noap.repo, arg));
        });
    } else {
        fs.readdir(path.resolve(dir, "node_modules"), function (er, pkgs) {
            if (er) return cb(err);
            apps = pkgs.filter(function (p) {
                return !p.match(/^[\._-]/)
            });
        });
    }

}

function isPackage(p) {
    return fs.existsSync(path.resolve(p, 'package.json'));
}
