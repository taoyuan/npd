"use strict";

var path = require('path');
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var sequence =require('when/sequence');
var fs = require('fs-extra');

exports.link = link;
function link(from, to) {
    to = path.resolve(to);
    var target = from = path.resolve(from);

    return sequence([
        nfn.lift(fs.stat, from),
        nfn.lift(fs.remove, to),
        nfn.lift(fs.mkdirp, path.dirname(to)),
        nfn.lift(fs.symlink, target, to, "junction")
    ]);
}

exports.linkIfExists = linkIfExists;
function linkIfExists(from, to) {
    return nfn.call(fs.stat, from)
        .then(function () {
            return link(from, to);
        })
        .catch(function () {
            return null;
        });
}
