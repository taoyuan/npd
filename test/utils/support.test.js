"use strict";

var t = require('chai').assert;
var support = require('../../lib/utils/support');

describe('support', function () {

    it('#dirs', function () {
        var expected = ['/etc/app', '/var/app', '/log/app'];
        var dirs = support.dirs('/', ['etc', 'var', 'log'], 'app');
        t.deepEqual(dirs, expected);

        expected = ['/etc/app1', '/etc/app2'];
        dirs = support.dirs('/', 'etc', ['app1', 'app2']);
        t.deepEqual(dirs, expected);

        expected = ['/etc/app1', '/var/app1', '/log/app1', '/etc/app2', '/var/app2', '/log/app2'];
        dirs = support.dirs('/', ['etc', 'var', 'log'], ['app1', 'app2']);
        t.deepEqual(dirs, expected);
    });
});