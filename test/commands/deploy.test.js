"use strict";

var path = require('path');
var fs = require('fs-extra');
var t = require('chai').assert;
var deploy = require('../../lib/commands/deploy');

var temp = path.resolve('./tmp');
var apps = path.resolve(temp, 'apps');

describe.only('deploy', function () {

    beforeEach(function () {
        fs.removeSync(temp);
    });

    afterEach(function () {

    });

    it('should work', function (done) {

        deploy('taoyuan/adm-example', apps , function (err, location) {
            t.notOk(err);
            t.equal(location, path.resolve(apps, 'adm-example'));
            done()
        });
    });
});