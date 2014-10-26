"use strict";

var _ = require('lodash');
var path = require('path');
var when = require('when');
var shell = require('shelljs');
var which = require('which');
var PThrottler = require('p-throttler');
var spawn = require('child_process').spawn;

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
    if (_.has(winWhichCache, command)) {
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
function execute(command, args, opts, notify) {
    var proc;
    var stderr = '';
    var stdout = '';
    var deferred = when.defer();

    notify = notify || function() {};

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
        notify(data);
        stdout += data;
    });
    proc.stderr.on('data', function (data) {
        data = data.toString();
        notify(data);
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

exports.exec = function (/*cmd, args, opts, notify*/) {
    var cmd, args, opts, notify, i, a;
    for (i = 0; i < arguments.length; i++) {
        a = arguments[i];
        if (!cmd && _.isString(a)) {
            cmd = a;
        } else if (!args && (_.isArray(a) || _.isString(a))) {
            args = a;
        } else if (!opts && _.isObject(a)) {
            opts = a;
        } else if (!notify && _.isFunction(a)) {
            notify = a;
        }
    }
    return throttler.enqueue(execute.bind(null, cmd, args, opts, notify));
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
    opts = _.defaults(opts || {}, {
        async: false,
        silent: true
    });

    var result;
    var owd = process.cwd();

    if (opts.cwd) shell.cd(opts.cwd);
    result = shell.exec(command, opts);
    if (opts.cwd) shell.cd(owd);

    if (result.code !== 0) {
        throw new Error(result.output);
    }
    return result.output;
};
