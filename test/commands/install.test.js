"use strict";

var t = require('chai').assert;
var _ = require('lodash');

var helpers = require('../helpers');
var noap = helpers.require('lib/noap');
var commands = noap.commands;

describe('install', function () {

    var repo = new helpers.TempDir();

    var pkg = new helpers.TempDir({
        'package.json': {
            name: 'package'
        }
    });

    var gitpkg = new helpers.TempDir();

    var installLogger = function (packages, options) {
        process.env.noap_repo =  repo.path;
        return commands.install(packages, options);
    };

    var install = function (packages, options) {
        var logger = installLogger(packages, options);
        return helpers.expectEvent(logger, 'end');
    };

    it('should work', function () {
        pkg.prepare();
        repo.prepare();

        return install([pkg.path], {}).then(function () {
            t.equal(noap.repo, repo.path);
        });
    });
});