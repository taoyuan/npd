"use strict";

var _ = require('lodash');
var path = require('path');
var when = require('when');
var shell = require('shelljs');
var which = require('which');
var PThrottler = require('p-throttler');
var spawn = require('child_process').spawn;


// The concurrency limit here is kind of magic. You don't really gain a lot from
// having a large number of commands spawned at once, so it isn't super
// important for this number to be large. Reports have shown that much more than 5
// or 10 cause issues for corporate networks, private repos or situations where
// internet bandwidth is limited. We're running with a concurrency of 5 until
// 1.4.X is released, at which time we'll move to what was discussed in #1262
// https://github.com/bower/bower/pull/1262
var throttler = new PThrottler(5);

var winBatchExtensions;
var winWhichCache;
var isWin = process.platform === 'win32';

if (isWin) {
    winBatchExtensions = ['.bat', '.cmd'];
    winWhichCache = {};
}

function createError(msg, code, props) {
    var err = new Error(msg);
    err.code = code;

    if (props) {
        _.assign(err, props);
    }

    return err;
}

function getWindowsCommand(command) {
    var fullCommand;
    var extension;

    // Do we got the value converted in the cache?
    if (mout.object.hasOwn(winWhichCache, command)) {
        return winWhichCache[command];
    }

    // Use which to retrieve the full command, which puts the extension in the end
    try {
        fullCommand = which.sync(command);
    } catch (err) {
        return winWhichCache[command] = command;
    }

    extension = path.extname(fullCommand).toLowerCase();

    // Does it need to be converted?
    if (winBatchExtensions.indexOf(extension) === -1) {
        return winWhichCache[command] = command;
    }

    return winWhichCache[command] = fullCommand;
}

// Executes a shell command, buffering the stdout and stderr
// If an error occurs, a meaningful error is generated
function execute(command, args, opts) {
    var proc;
    var stderr = '';
    var stdout = '';
    var deferred = when.defer();

    // Windows workaround for .bat and .cmd files, see #626
    if (isWin) {
        command = getWindowsCommand(command);
    }

    opts = _.defaults(opts || {}, {
        env: process.env
    });

    // Buffer output, reporting progress
    proc = spawn(command, args, opts);
    proc.stdout.on('data', function (data) {
        data = data.toString();
        deferred.notify(data);
        stdout += data;
    });
    proc.stderr.on('data', function (data) {
        data = data.toString();
        deferred.notify(data);
        stderr += data;
    });

    // If there is an error spawning the command, reject the promise
    proc.on('error', function (error) {
        return deferred.reject(error);
    });

    // Listen to the close event instead of exit
    // They are similar but close ensures that streams are flushed
    proc.on('close', function (code) {
        var fullCommand;
        var error;

        if (code) {
            // Generate the full command to be presented in the error message
            if (!Array.isArray(args)) {
                args = [];
            }

            fullCommand = command;
            fullCommand += args.length ? ' ' + args.join(' ') : '';

            // Build the error instance
            error = createError('Failed to execute "' + fullCommand + '", exit code of #' + code, 'ECMDERR', {
                details: stderr,
                exitCode: code
            });

            return deferred.reject(error);
        }

        return deferred.resolve([stdout, stderr]);
    });

    return deferred.promise;
}

exports.exec = function (/*cmd, args, opts*/) {
    var cmd, args, opts, i, a;
    for (i = 0; i < arguments.length; i++) {
        a = arguments[i];
        if (!cmd && _.isString(a)) {
            cmd = a;
        } else if (!args && (_.isArray(a) || _.isString(a))) {
            args = a;
        } else if (!opts && _.isObject(a)) {
            opts = a;
        }
    }
    return throttler.enqueue(execute.bind(null, cmd, args, opts));
};

exports.execSync = function (/*cmd, args, opts*/) {
    var cmd, args, opts, i, a;
    for (i = 0; i < arguments.length; i++) {
        a = arguments[i];
        if (!cmd && _.isString(a)) {
            cmd = a;
        } else if (!args && (_.isArray(a) || _.isString(a))) {
            args = a;
        } else if (!opts && _.isObject(a)) {
            opts = a;
        }
    }
    args = args || [];
    if (!Array.isArray(args)) args = [args];
    args.unshift(cmd);
    var command = args.join(' ');
    var result = shell.exec(command, opts);
    if (result.code !== 0) {
        throw new Error(result.output);
    }
    return result.output;
};