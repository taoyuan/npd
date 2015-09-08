"use strict";

var _ = require('lodash');
var path = require('path');
var Promise = require('bluebird');
var logger = require('../logs').logger;
var npd = require('../npd');
var errors = require('../errors');
var dissector = require('../dissector');
var mdu = require('../mdu');

var install = require('./install');

module.exports = update;

function update(args) {
  var where;
  if (arguments.length === 2) {
    where = args;
    args = arguments[1];
  }

  where = where || path.resolve(npd.config.dir, '..');
  args = args || [];

  var c = npd.config;
  return mdu.readJson(where, 'module.json')
    .then(function (modmeta) {
      return [modmeta, c.global ? c.dir : mdu.modsdir(modmeta)];
    })
    .spread(function (modmeta, modsdir) {
      if (_.isEmpty(args) && modmeta && modmeta.extensions) {
        args = Object.keys(modmeta.extensions);
      }

      var dir = path.resolve(where, modsdir);
      if (_.isEmpty(args)) {
        return dissector.readInstalled(dir);
      } else {
        return Promise.map(args, function (arg) {
          return dissector.readEndpoint(path.resolve(dir, arg))
            .then(function (endpoint) {
              if (!endpoint.pkgmeta) throw errors.create('Package `' + arg + '` is not installed', 'ENOTINS', {name: arg});
              return endpoint;
            });
        });
      }
    })
    .then(function (endpoints) {
      if (!_.isEmpty(endpoints)) return install(endpoints);
    });
}
