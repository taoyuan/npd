"use strict";

var npd = require('../lib/npd');
var h = require('./helpers');

describe.skip('integration', function () {

    var install = h.command('install');

    beforeEach(function () {
        npd.load(true);
    });

    it('should work with full future package', function () {
        return install(['taoyuan/npd-test']).then(function () {

        });
    });
});