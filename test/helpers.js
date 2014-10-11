"use strict";

var when = require('when');
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

var tmpLocation = path.join(osenv.tmpdir(), 'npd-tests', uuid.v4().slice(0, 8));

exports.require = function (name) {
    return require(path.join(__dirname, '../', name));
};

exports.clearRuntimeCache = function () {
    Repository.clearRuntimeCache();
};

after(function () {
    fs.removeSync(tmpLocation);
});

exports.expectEvent = function (emitter, eventName) {
    var deferred = when.defer();

    emitter.once(eventName, function () {
        deferred.resolve(arguments);
    });

    return deferred.promise;
};

exports.command = function (cmd, options) {
    return function (packages, config) {
        if (!(config instanceof npdconf.Configure)) {
            config = object.merge(options || {}, config);
        }
        var logger = npd.commands[cmd](packages, config);
        return exports.expectEvent(logger, 'end');
    }
};

exports.commandForLogger = function (cmd, options) {
    return function (packages, config) {
        if (!(config instanceof npdconf.Configure)) {
            config = object.merge(options || {}, config);
        }
        return npd.commands[cmd](packages, config);
    }
};

exports.TempDir = function (defaults) {
    return new TempDir(defaults);
};

function TempDir (defaults) {
    this.path = path.join(tmpLocation, uuid.v4());
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

        that.glob('./!(.git)').map(function (removePath) {
            var fullPath = path.join(that.path, removePath);

            fs.removeSync(fullPath);
        });

        that.create(files);
        that.git('add', '-A');
        that.git('commit', '-m"commit"');
        that.git('tag', tag);
    });
};

TempDir.prototype.glob = function (pattern) {
    return glob.sync(pattern, {
        cwd: this.path,
        dot: true
    });
};

TempDir.prototype.read = function (name) {
    return fs.readFileSync(path.join(this.path, name), 'utf8');
};

TempDir.prototype.git = function () {
    var args = Array.prototype.slice.call(arguments);

    return sh.execSync('git', args, { cwd: this.path, env: env });
};

TempDir.prototype.exists = function (name) {
    return fs.existsSync(path.join(this.path, name));
};

TempDir.prototype.remove = function (name) {
    return fs.removeSync(path.join(this.path, name));
};