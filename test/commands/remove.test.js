"use strict";

require('../init');

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var install = require('../../lib/commands/install');
var remove = require('../../lib/commands/remove');

process.env.noap_root = '/tmp';
var apps = process.env.noap_repo = '/tmp/noaps';

describe('remove', function () {

    it.only('should work', function (done) {
        install('taoyuan/noap-example' , function (err) {
            if (err) return done(err);
            remove('noap-example', function (err) {
                if (err) return done(err);
                done();
            });
        });
    });
});