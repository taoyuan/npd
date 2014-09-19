"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var install = require('../../lib/commands/install');
var remove = require('../../lib/commands/remove');

process.env.sorb_root = '/tmp';
var apps = process.env.sorb_repo = '/tmp/apps';

describe('remove', function () {

    it.only('should work', function (done) {
        install('taoyuan/sorb-example' , function (err) {
            if (err) return done(err);
            remove('sorb-example', function (err) {
                if (err) return done(err);
                done();
            });
        });
    });
});