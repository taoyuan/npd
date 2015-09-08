"use strict";

var _ = require('lodash');

var errors = module.exports = {};

errors.create = function create(msg, code, props) {
  var err = new Error(msg);
  err.code = code;

  if (props) {
    _.assign(err, props);
  }

  return err;
};

errors.working = function () {
  return errors.create('Already working', 'EWORKING');
};

errors.unimplemented = function () {
  return errors.create('Not implemented');
};