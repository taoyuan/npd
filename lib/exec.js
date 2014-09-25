"use strict";

var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var child = require('child_process');

module.exports = execAsync;

// Wrapper around exec() to enable echoing output to console in real time
function execAsync(cmd, opts, callback) {

    var execOpts = {
        cwd: './',
        env: process.env,
        maxBuffer: 20*1024*1024
    };

    if (typeof opts === 'function') {
        callback = opts;
        opts = null;
    }

    execOpts = _.assign(execOpts, opts || {});

    var output = '';

    var c = child.exec(cmd, execOpts, function(err) {
        if (callback) callback(err ? err : null, output);
    });

    c.stdout.on('data', function(data) {
        output += data;
    });

    c.stderr.on('data', function(data) {
        output += data;
    });

    return c;
}