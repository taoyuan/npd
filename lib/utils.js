// useful helpers for bootstrapping install.
var _ = require('lodash');
var spawn = require('child_process').spawn;

exports.exec = function (command, opts, cb) {
    var spawnOpts = {
        cwd: './',
        env: process.env,
        stdio: [process.stdin, process.stdout, process.stderr]
    };

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }

    spawnOpts = _.extend(spawnOpts, opts);

    var proc = spawn('sh', ['-c', command], spawnOpts);

    proc.on('close', function (output) {
        cb();
    });
};
