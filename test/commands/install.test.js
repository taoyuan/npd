"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var install = require('../../lib/commands/install');

process.env.adm_root = '/tmp';
var apps = process.env.adm_repo = '/tmp/apps';

describe('install', function () {

    it('should work', function (done) {

        install('taoyuan/adm-example' , function (err) {
            if (err) return done(err);
            done();
        });
    });
});