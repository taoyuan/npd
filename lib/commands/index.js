"use strict";

var _ = require('lodash');
var when = require('when');
var Logger = require('bower-logger');

function wrap(cmdname) {
    var cmd = require(cmdname);

    function command() {
        var commandArgs = [].slice.call(arguments);

        return withLogger(function (logger) {
            commandArgs.unshift(logger);
            return cmd.apply(undefined, commandArgs);
        });
    }

    function runFromArgv(argv) {
        return withLogger(function (logger) {
            return cmd.line.call(undefined, logger, argv);
        });
    }

    function withLogger(func) {
        var logger = new Logger();

        when.try(func, logger)
            .done(function () {
                var args = [].slice.call(arguments);
                args.unshift('end');
                logger.emit.apply(logger, args);
            }, function (error) {
                logger.emit('error', error);
            });

        return logger;
    }


    Object.keys(cmd).forEach(function (k) {
        command[k] = cmd[k];
    });
    command.line = runFromArgv;
    return command;
}

module.exports = {
    install: wrap('./install'),
    update: wrap('./update'),
    uninstall: wrap('./uninstall')
};
