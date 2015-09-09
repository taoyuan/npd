"use strict";

var path = require('path');
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

exports.link = link;
function link(from, to) {
  to = path.resolve(to);
  var target = from = path.resolve(from);

  return Promise.resolve()
    .then(function () {
      return fs.statSync(from);
    })
    .then(function () {
      return fs.removeSync(to);
    })
    .then(function () {
      return fs.mkdirpSync(path.dirname(to));
    })
    .then(function () {
      return fs.symlinkSync(target, to, "junction");
    });
}

exports.linkIfExists = linkIfExists;
function linkIfExists(from, to) {
  return fs.statAsync(from)
    .then(function () {
      return link(from, to);
    })
    .catch(function (err) {
      return null;
    });
}
