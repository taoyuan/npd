"use strict";

var when = require('when');
var nfn = require('when/node');
var _ = require('lodash');
var object = require('mout').object;
var path = require('path');
var uuid = require('node-uuid');
var fs = require('fs-extra');
var glob = require('glob');
var osenv = require("osenv");
var sh = require('../lib/utils/sh');
var npd = require('../lib/npd');
var npdconf = require('../lib/npdconf');
var Repository = require('../lib/repository');

var __slice = Array.prototype.slice;

require('chai').config.includeStack = true;
exports.t = require('chai').assert;

// Those are needed for Travis or not configured git environment
var env = {
    'GIT_AUTHOR_DATE': 'Sun Apr 7 22:13:13 2013 +0000',
    'GIT_AUTHOR_NAME': 'Yuan Tao',
    'GIT_AUTHOR_EMAIL': 'torworx@gmail.com',
    'GIT_COMMITTER_DATE': 'Sun Apr 7 22:13:13 2013 +0000',
    'GIT_COMMITTER_NAME': 'Yuan Tao',
    'GIT_COMMITTER_EMAIL': 'torworx@gmail.com'
};

// Preserve the original environment
_.assign(env, process.env);

var tmpLocation = path.join(osenv.tmpdir(), 'npd-tests');

exports.require = function (name) {
    return require(path.join(__dirname, '../', name));
};

exports.clearRuntimeCache = function () {
    Repository.clearRuntimeCache();
};

after(function () {
    fs.removeSync(tmpLocation);
});

exports.command = function (cmd) {
    var fn = npd.commands[cmd];
    return function (packages, opts) {
        return nfn.call(fn, packages, opts);
    };
};

exports.TempDir = function (defaults) {
    return new TempDir(defaults);
};

function TempDir (defaults) {
    this.path = path.join(tmpLocation, uuid.v4().slice(0, 8));
    this.defaults = defaults;
}

TempDir.prototype.create = function (files) {
    var that = this;

    files = _.defaults(files || {}, this.defaults);

    if (files) {
        _.forEach(files, function (contents, filepath) {
            if (typeof contents === 'object') {
                contents = JSON.stringify(contents, null, ' ') + '\n';
            }

            var fullPath = path.join(that.path, filepath);
            fs.mkdirpSync(path.dirname(fullPath));
            fs.writeFileSync(fullPath, contents);
        });
    }

    return this;
};

TempDir.prototype.prepare = function (files) {
    fs.removeSync(this.path);
    fs.mkdirpSync(this.path);
    this.create(files);

    return this;
};

TempDir.prototype.gitPrepare = function (revisions) {
    fs.removeSync(this.path);
    fs.mkdirpSync(this.path);

    this.gitCommit(revisions);
    return this;
};

TempDir.prototype.gitCommit = function (revisions) {
    var that = this;
    revisions = _.defaults(revisions || {}, this.defaults);
    _.forEach(revisions, function (files, tag) {
        that.git('init');
        that.git('config user.email "torworx@gmail.com"');
        that.git('config user.name "Tao Yuan"');

        that.glob('./!(.git)').map(function (removePath) {
            var fullPath = path.join(that.path, removePath);

            fs.removeSync(fullPath);
        });

        that.create(files);
        that.git('add', '-A');
        that.git('commit', '-m"commit"');
        that.git('tag', tag);
    });

    // clear git refs cache in resolvers
    exports.clearRuntimeCache();
};

TempDir.prototype.glob = function (pattern) {
    return glob.sync(pattern, {
        cwd: this.path,
        dot: true
    });
};


TempDir.prototype.git = function () {
    var args = Array.prototype.slice.call(arguments);

    return sh.execSync('git', args, { cwd: this.path, env: env, silent: true });
};

TempDir.prototype.read = function () {
    var args = [this.path].concat(__slice.call(arguments));
    return fs.readFileSync(path.join.apply(undefined, args), 'utf8');
};

TempDir.prototype.exists = function () {
    var args = [this.path].concat(__slice.call(arguments));
    return fs.existsSync(path.join.apply(undefined, args));
};

TempDir.prototype.remove = function () {var args = [this.path].concat(__slice.call(arguments));
    return fs.removeSync(path.join.apply(undefined, args));
};
