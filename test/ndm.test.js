"use strict";

var path = require('path');
var fs = require('fs-extra');
var h = require('./helpers');
var t = h.t;
var npd = require('../lib/npd');
var ndm = require('../lib/ndm');

function assertCommand(cmd, pkg, expcmd, expopts) {
    ndm.exec = function (line, opts) {
        t.equal(line, expcmd);
        if (expopts) t.deepEqual(opts, expopts);
    };
    ndm[cmd](pkg);
}

describe.only('ndm', function () {

    var pkg, repo;

    beforeEach(function () {
        pkg = h.TempDir({
            "package.json": {
                name: 'ndm-test'
            },
            "service.json": {

            }
        }).prepare();

        repo = h.TempDir().prepare();

        npd.load({dir: repo.path}, true);
    });

    it('should generate appropriate install/remove/start/stop/restart commands', function() {
        var dir = path.resolve(repo.path, 'ndm-test');
        var opts = {cwd: dir};
        fs.copySync(pkg.path, dir);

        assertCommand('install', 'ndm-test', ndm.bin + ' generate', opts);
        assertCommand('remove', 'ndm-test', ndm.bin + ' remove', opts);
        assertCommand('start', 'ndm-test', ndm.bin + ' start', opts);
        assertCommand('stop', 'ndm-test', ndm.bin + ' stop', opts);
        assertCommand('restart', 'ndm-test', ndm.bin + ' restart', opts);
    });
});