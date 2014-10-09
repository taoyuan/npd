"use strict";

var util = require('util');
var when = require('when');
var which = require('which');
var LRU = require('lru-cache');
var mout = require('mout');
var Resolver = require('./Resolver');
var semver = require('../utils/semver');
var errors = require('../errors');
var sh = require('../utils/sh');

var hasSvn;

// Check if svn is installed
try {
    which.sync('svn');
    hasSvn = true;
} catch (ex) {
    hasSvn = false;
}

function SvnResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);

    if (!hasSvn) {
        throw errors.create('svn is not installed or not in the PATH', 'ENOSVN');
    }
}

util.inherits(SvnResolver, Resolver);
mout.object.mixIn(SvnResolver, Resolver);




module.exports = SvnResolver;