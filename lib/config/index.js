"use strict";

var _ = require('lodash');
var rc = require('rc');
var path = require('path');
var nomnom = require("nomnom");
var defaults = require('./defaults');
var prefix = require('./prefix');

module.exports = Config;

function Config(name, opts) {
  this._load(name, opts);
}

Config.prototype._load = function (name, opts) {
  var that = this;
  var config = load(name, defaults(), opts);

  Object.defineProperty(this, "prefix", {
    get: function () {
      if (config.prefix) return config.prefix;
      return config.global ? prefix : process.cwd();
    },
    set: function (prefix) {
      config.prefix = prefix;
    },
    enumerable: true
  });

  Object.defineProperty(this, "bin", {
    get: function () {
      if (config.global) return that.globalBin;
      return path.resolve(that.root, ".bin");
    },
    enumerable: true
  });

  Object.defineProperty(this, "globalBin", {
    get: function () {
      var b = that.prefix;
      if (process.platform !== "win32") b = path.resolve(b, "bin");
      return b;
    }
  });

  Object.defineProperty(this, "dir", {
    get: function () {
      if (config.global) return that.globalDir;
      return path.resolve(that.prefix, 'modules');
    },
    enumerable: true
  });

  Object.defineProperty(this, "globalDir", {
    get: function () {
      return path.resolve(that.prefix, that.directory);
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

  var argv = _.clone(opts);

  argv.dir = argv.dir || argv.cwd;
  delete argv.cwd;
  return rc(name, defaults, argv);
}
