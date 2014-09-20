"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var install = require('../../lib/commands/install');

process.env.noap_root = '/tmp';
var apps = process.env.noap_repo = '/tmp/noaps';

describe('install', function () {

    it('should work', function (done) {

        install('taoyuan/noap-example' , function (err) {
            if (err) return done(err);
            done();
        });
    });
});