"use strict";

var path = require('path');
var _ = require('lodash');
var when = require('when');
var nfn = require('when/node');
var fs = require('fs-extra');
var fsa = nfn.liftAll(fs);

exports.link = link;
function link(from, to) {
    to = path.resolve(to);
    var target = from = path.resolve(from);

    return when()
        .then(fsa.stat.bind(fsa, from))
        .then(fsa.remove.bind(fsa, to))
        .then(fsa.mkdirp.bind(fsa, path.dirname(to)))
        .then(fsa.symlink.bind(fsa, target, to, "junction"));

}

exports.linkIfExists = linkIfExists;
function linkIfExists(from, to) {
    return fsa.stat(from)
        .then(link.bind(exports, from, to))
        .catch(function () {
            return null;
        });
}
