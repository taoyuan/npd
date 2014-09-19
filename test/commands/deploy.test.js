"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var deploy = require('../../lib/commands/deploy');

var apps = process.env.adm_repo = '/tmp/apps';

describe('deploy', function () {

    it('should work', function (done) {

        deploy('taoyuan/adm-example' , function (err, location) {
            if (err) return done(err);
            t.equal(location, path.resolve(apps, 'adm-example'));
            done();
        });
    });
});