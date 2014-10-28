"use strict";

var _ = require('lodash');
var rc = require('rc');
var path = require('path');
var nomnom = require("nomnom");
var defaults = require('./defaults');

module.exports = Config;

function Config(name, opts) {
    this._load(name, opts);
}

Config.prototype.get = function (name) {
    return this.__config__.get(name);
};

Config.prototype.set = function (name, value) {
    return this.__config__.set(name, value);
};

Config.prototype._load = function (name, opts) {
    var that = this;
    var config = load(name, defaults(), opts);
    //var data = config.load();

    Object.defineProperty(this, "__config__", {
        get: function () {
            return config;
        },
        enumerable: false
    });

    Object.defineProperty(this, "bin", {
        get: function () {
            return path.resolve(that.prefix, "bin");
        },
        enumerable: true
    });

    Object.defineProperty(this, "dir", {
        set: function (value) {
            config['dir'] = value;
        },
        get : function () {
            return config['dir'] || path.resolve(that.prefix, that.apps);
        },
        enumerable: true
    });

    Object.defineProperty(this, "root", {
        get: function () {
            return that.dir;
        }
    });

    _.forEach(config, function (v, k) {
        if (that.hasOwnProperty(k)) return;
        Object.defineProperty(that, k, {
            get: function () {
                return config[k];
            },
            set: function (v) {
                config[k] = v;
            },
            enumerable: true
        });
    });
};

function load(name, defaults, opts) {
    if (!name) throw new Error('nameless configuration fail');

    opts = opts || nomnom().parse() || {};
    if (opts.cwd && !opts.dir) opts.dir = opts.cwd;

    return rc(name, defaults, opts);
}
