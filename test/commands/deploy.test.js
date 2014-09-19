"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var deploy = require('../../lib/commands/deploy');

var apps = process.env.sorb_repo = '/tmp/apps';

describe('deploy', function () {

    it('should work', function (done) {

        deploy('taoyuan/sorb-example' , function (err, location) {
            if (err) return done(err);
            t.equal(location, path.resolve(apps, 'sorb-example'));
            done();
        });
    });
});