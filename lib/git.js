"use strict";

var util = require('util');
var reVer = require('semver-regex')();
var exec = require('./exec');

exports.lsRemote = function (repo, opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = null;
    }
    if (Array.isArray(opts)) opts = opts.join(' ');
    opts = opts || '';
    return exec(util.format('git ls-remote %s %s', opts, repo), function (err, data) {
        if (err) return cb(err);

        var lines = data.split('\n');
        for(var i = 0; i < lines.length; i++) {
            lines[i] = lines[i].split('\t');
        }
        cb(null, lines);
    });
};

exports.lsRemoteTagVersions = function (repo, cb) {
    return exports.lsRemote(repo, '-t', function (err, lines) {
        if (err) return cb(err);

        var tags = [], tag, result;
        for(var i = 0; i < lines.length; i++) {
            tag = lines[i][1];
            if (result = reVer.exec(tag)) tags.push(result[0]);
        }

        cb(null, tags);
    });
};