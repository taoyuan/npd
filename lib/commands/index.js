"use strict";

var _ = require('lodash');
var path = require('path');
var when = require('when');
var logger = require('../logs').logger;

var __slice = Array.prototype.slice;

function wrap(name) {
    var cmd = require(path.resolve(__dirname, name));

    function command() {
        var args = [].slice.call(arguments);
        var len = args.length;
        var cb;
        if (typeof args[len - 1] === 'function') {
            cb = args.pop();
        }

        return exec(function () {
            return cmd.apply(undefined, args);
        }, cb);
    }

    function runFromArgv(argv) {
        return exec(function (logger) {
            return cmd.line.call(undefined, logger, argv);
        });
    }

    function exec(func, done) {
        when.try(func)
            .done(function () {
                var args = __slice.call(arguments);
                var argv = args.length <=1 ? args[0] : args;
                if (argv && typeof argv !== 'object') {
                    argv = { result: argv };
                }
                logger.phase('end', name, argv);
                return done && done();
            }, function (error) {
                return done ? done(error) : logger.error(error);
            });
    }


    Object.keys(cmd).forEach(function (k) {
        command[k] = cmd[k];
    });
    command.line = runFromArgv;
    return command;
}

module.exports = {
    install: wrap('install'),
    update: wrap('update'),
    uninstall: wrap('uninstall'),
    root: wrap('root')
};
