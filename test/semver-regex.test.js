"use strict";

var t = require('chai').assert;
var reVer = require('semver-regex')();

describe('semver-regex', function () {
    it('#test', function () {
        t.ok(reVer.test('refs/tags/v3.3.1'));
    })
});
