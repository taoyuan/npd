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

Config.prototype._load = function (name, opts) {
    var that = this;
    var config = load(name, defaults(), opts);

    Object.defineProperty(this, "bin", {
        set: function (value) {
            config['bin'] = value;
        },
        get: function () {
            return config['bin'] || path.resolve(that.prefix, "bin");
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
    // custom modules dir
    if (opts.dir) {
        opts.bin = path.join(opts.dir, '.bin');
    }

    return rc(name, defaults, opts);
}
