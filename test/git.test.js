"use strict";

var t = require('chai').assert;
var git = require('../lib/git');

describe('git', function () {

    it('#lsRemoteTagVersions', function (done) {
        git.lsRemoteTagVersions('https://github.com/npm/npm', function (err, tags) {
            if (err) done(err);
            t.ok(tags.length);
            done();
        });
    });
});