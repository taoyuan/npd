"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var deploy = require('../../lib/commands/deploy');

var apps = process.env.noap_repo = '/tmp/noaps';

describe('deploy', function () {

    it('should work', function (done) {

        deploy('taoyuan/noap-example' , function (err, location) {
            if (err) return done(err);
            t.equal(location, path.resolve(apps, 'noap-example'));
            done();
        });
    });
});