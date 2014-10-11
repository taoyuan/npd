"use strict";

var _ = require('lodash');
var nconf = require('nconf');
var path = require('path');
var nomnom = require("nomnom");
var defaults = require('./defaults');

var win = process.platform === "win32";
var home = win ? process.env.USERPROFILE : process.env.HOME;
var etc = '/etc';

module.exports = Configure;

function Configure(name, opts) {
    this._load(name, opts);
}

Configure.prototype.get = function (name) {
    return this.__config__.get(name);
};

Configure.prototype.set = function (name, value) {
    return this.__config__.set(name, value);
};

Configure.prototype._load = function (name, opts) {
    var that = this;
    var config = this.__config__ = load(name, defaults(), opts);
    var data = config.load();

    Object.defineProperty(this, "bin", {
        get: function () {
            if (config.get("global")) return that.globalBin;
            return path.resolve(that.root, ".bin")
        },
        enumerable: true
    });

    Object.defineProperty(this, "globalBin", {
        get: function () {
            var b = that.prefix;
            if (!win) b = path.resolve(b, "bin");
            return b
        }
    });

    Object.defineProperty(this, "dir", {
        set: function () {
            var g = that.get("global");
            this[g ? 'globalDir' : 'localDir'] = prefix
        },
        get : function () {
            var g = that.get("global");
            return g ? that.globalDir : that.localDir;
        },
        enumerable: true
    });

    Object.defineProperty(this, "globalDir", {
        set: function (prefix) {
            that.set('dir', prefix)
        },
        get: function () {
            return path.resolve(that.get("dir"))
        },
        enumerable: true
    });

    Object.defineProperty(this, "localDir", {
        set: function (prefix) {
            that.set('cwd', prefix)
        },
        get: function () {
            return path.resolve(that.get("cwd"))
        },
        enumerable: true
    });

    Object.defineProperty(this, "root", {
        get: function () {
            return that.dir
        }
    });

    _.forEach(data, function (v, k) {
        if (that.hasOwnProperty(k)) return;
        Object.defineProperty(that, k, {
            get: function () {
                return config.get(k);
            },
            set: function (v) {
                config.set(k, v);
            },
            enumerable: true
        });
    });
};

function load(name, defaults, opts) {
    if (!name) throw new Error('nameless configuration fail');

    opts = opts || nomnom.parse() || {};
    var cwd = opts.cwd = opts.cwd || opts.dir || process.cwd();
    if (opts.global) opts.dir = cwd;

    var conf = new nconf.Provider();

    conf.add('env', { type: 'literal', store: fromenv(name + '_') });
    conf.add('opts', { type: 'literal', store: opts });
    conf.add('local', fopts(cwd, '.' + name + 'rc'));
    conf.add('user', fopts(home, '.' + name + 'rc'));
    conf.add('global', fopts(etc, name + 'rc'));
    conf.add('builtin', fopts(__dirname, '..', '.' + name + 'rc'));

    if ('string' === typeof defaults) {
        conf.file(fopts(defaults));
    } else if (defaults) {
        conf.defaults(defaults || {});
    }

    return conf;
}

function fopts(file) {
    if (arguments.length > 1) {
        file = path.join.apply(path, arguments);
    }
    return {
        file: file,
        type: 'file',
        format: file && /\.json$/.test(file) ? nconf.formats.json : nconf.formats.ini
    };
}

function fromenv(prefix, env) {
    env = env || process.env;
    var obj = {};
    var l = prefix.length;
    for (var k in env) {
        if ((k.indexOf(prefix)) === 0) {

            var keypath = k.substring(l).split('__');

            // Trim empty strings from keypath array
            var _emptyStringIndex;
            while ((_emptyStringIndex = keypath.indexOf('')) > -1) {
                keypath.splice(_emptyStringIndex, 1);
            }

            var cursor = obj;
            keypath.forEach(function _buildSubObj(_subkey, i) {

                // (check for _subkey first so we ignore empty strings)
                if (!_subkey) return;

                // If this is the last key, just stuff the value in there
                // Assigns actual value from env variable to final key
                // (unless it's just an empty string- in that case use the last valid key)
                if (i === keypath.length - 1) cursor[_subkey] = env[k];


                // Build sub-object if nothing already exists at the keypath
                if (cursor[_subkey] === undefined) cursor[_subkey] = {};

                // Increment cursor used to track the object at the current depth
                cursor = cursor[_subkey];
            });
        }
    }

    return obj;
}