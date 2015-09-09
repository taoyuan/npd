//"use strict";

var fs = require('fs-extra');
var path = require('path');
var tmp = require('tmp');
var when = require('when');
var nfn = require('when/node');
var utils = require('../utils');
var errors = require('../errors');

tmp.setGracefulCleanup();

module.exports = Resolver;

function Resolver(endpoint, config, logger) {
  this._source = endpoint.source;
  this._target = endpoint.target || '*';
  this._name = endpoint.name || path.basename(this._source);

  this._config = config;
  this._logger = logger;

  this._guessedName = !endpoint.name;
}

Resolver.prototype.getSource = function () {
  return this._source;
};

Resolver.prototype.getName = function () {
  return this._name;
};

Resolver.prototype.getTarget = function () {
  return this._target;
};

Resolver.prototype.getTempDir = function () {
  return this._tempDir;
};

Resolver.prototype.getPkgMeta = function () {
  return this._pkgMeta;
};


// Abstract functions that can be re-implemented by concrete resolvers
// as necessary
Resolver.prototype._hasNew = function (canonicalDir, pkgmeta) {
  return when.resolve(true);
};

// Abstract functions that must be implemented by concrete resolvers
Resolver.prototype._resolve = function () {
  throw errors.unimplemented();
};


Resolver.isTargetable = function () {
  return true;
};

Resolver.versions = function (source) {
  return when.resolve([]);
};

Resolver.clearRuntimeCache = function () {
};

Resolver.prototype._createTempDir = function () {
  return nfn.call(fs.mkdirp, this._config.tmp)
    .then(function () {
      return nfn.call(tmp.dir, {
        template: path.join(this._config.tmp, this._name + '-' + process.pid + '-XXXXXX'),
        mode: 0777 & ~process.umask(),
        unsafeCleanup: true
      });
    }.bind(this))
    .then(function (dir) {
      // nfcall may return multiple callback arguments as an array
      return this._tempDir = Array.isArray(dir) ? dir[0] : dir;
    }.bind(this));
};

Resolver.prototype._cleanTempDir = function () {
  var tempDir = this._tempDir;

  if (!tempDir) {
    return when.resolve();
  }

  // Delete and create folder
  return nfn.call(fs.remove, tempDir)
    .then(function () {
      return nfn.call(fs.mkdirp, tempDir, 0777 & ~process.umask());
    })
    .then(function () {
      return tempDir;
    });
};

Resolver.prototype._readJson = function (dir) {
  dir = dir || this._tempDir;

  var defaults = {name: this._name};

  return utils.readJson(path.resolve(dir, 'package.json'))
    .then(function (json) {
      return json || defaults;
    })
    .catch(function (err) {
      if (err.code === 'ENOENT') return defaults;
      return err;
    });
};

Resolver.prototype.hasNew = function (canonicalDir, pkgmeta) {
  var promise;
  var metaFile;
  var that = this;

  // If already working, error out
  if (this._working) {
    return when.reject(errors.working());
  }

  this._working = true;

  // Avoid reading the package meta if already given
  if (pkgmeta) {
    promise = this._hasNew(canonicalDir, pkgmeta);
    // Otherwise call _hasNew with both the package meta and the canonical dir
  } else {
    metaFile = path.join(canonicalDir, '.package.json');

    promise = utils.readJson(metaFile)
      .then(function (pkgmeta) {
        return that._hasNew(canonicalDir, pkgmeta);
      })
      .catch(function (err) {
        that._logger.debug('read-json', 'Failed to read ' + metaFile, {
          filename: metaFile,
          error: err
        });

        return true;  // Simply resolve to true if there was an error reading the file
      });
  }

  return promise.finally(function () {
    that._working = false;
  });
};

Resolver.prototype.resolve = function () {
  var that = this;

  // If already working, error out
  if (this._working) {
    return when.reject(errors.working());
  }

  this._working = true;

  // Create temporary dir
  return this._createTempDir()
    // Resolve self
    .then(this._resolve.bind(this))
    // Read json, generating the package meta
    .then(this._readJson.bind(this, null))
    // Apply and save package meta
    .then(function (meta) {
      return that._applyPkgMeta(meta)
        .then(that._savePkgMeta.bind(that, meta));
    })
    .then(function () {
      // Resolve with the folder
      return that._tempDir;
    }, function (err) {
      // If something went wrong, unset the temporary dir
      that._tempDir = null;
      throw err;
    })
    .finally(function () {
      that._working = false;
    });
};


Resolver.prototype._applyPkgMeta = function (meta) {
  // Check if name defined in the json is different
  // If so and if the name was "guessed", assume the json name
  if (meta.name !== this._name && this._guessedName) {
    this._name = meta.name;
  }
  return when.resolve(meta);
};

Resolver.prototype._savePkgMeta = function (meta) {
  var that = this;
  var contents;

  // Store original source & target
  meta._source = this._source;
  meta._target = this._target;

  // Stringify contents
  contents = JSON.stringify(meta, null, 2);

  return nfn.call(fs.writeFile, path.join(this._tempDir, '.package.json'), contents)
    .then(function () {
      return that._pkgMeta = meta;
    });
};

Resolver.prototype.isCacheable = function () {
  // Bypass cache for local dependencies
  if (this._source && /^(?:file:[\/\\]{2}|[A-Z]:)?\.?\.?[\/\\]/.test(this._source)) {
    return false;
  }

  // We don't want to cache moving targets like branches
  return !(this._pkgMeta &&
  this._pkgMeta._resolution &&
  this._pkgMeta._resolution.type === 'branch');

};
