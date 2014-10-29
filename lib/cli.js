"use strict";

var _ = require('lodash');
var path = require('path');
var nomnom = require('nomnom');
var Logger = require('bower-logger');
var npd = require('./npd');
var utils = require('./utils');
var renderers = require('./renderers');
var pkg = require('../package');

var levels = Logger.LEVELS;

/**
 * The basic command line interface of Mosca.
 *
 * @api private
 */
module.exports = function cli(args) {
    args = args || ['-h'];

    var parser = nomnom
        .script('npd')
        .option('version', {
            abbr: 'v',
            flag: true,
            help: 'show version.',
            callback: function () {
                return pkg.version;
            }
        })
        .option('local', {
            flag: true,
            default: false,
            help: 'using current directory as working directory'
        })
        .option('cwd', {
            help: 'specify the working directory'
        })
        .option('noBinLinks', {
            full: 'no-bin-links',
            flag: true,
            help: 'prevent npd from creating symlinks for any binaries the package might contain'
        })
        .option('uid', {
            abbr: 'u',
            metavar: 'UID',
            help: 'what user should scripts be executed as?'
        })
        .option('gid', {
            abbr: 'g',
            metavar: 'GID',
            help: 'what group should scripts be executed as?'
        });

    _.forEach(npd.commands, function (command, name) {
        var def = parser.command(name);

        if (command.options) {
            def.options(command.options);
        }
        if (command.help) {
            def.help(command.help);
        }
        if (command.usage) {
            def.usage(command.usage);
        }
        def.callback(invoker(name, command.line));
    });

    parser.command(undefined)
        .callback(function () {
            parser.print(parser.getUsage());
        });

    parser.parse(args);

};

function invoker(command, fn) {
    return function (argv) {
        if (!argv.cwd && argv.local) {
            // using local cwd as module dir
            argv.cwd = process.cwd();
        }
        if (argv.cwd) argv.cwd = path.resolve(argv.cwd);

        npd.load(argv);

        var logger = fn(argv);

        // Get the renderer and configure it with the executed command
        var renderer = getRenderer(command, logger.json, npd.config);
        var loglevel = guessLoglevel(npd.config);

        logger
            .on('end', function (data) {
                if (!npd.config.silent && !npd.config.quiet) {
                    renderer.end(data);
                }
            })
            .on('error', function (err)  {
                if (levels.error >= loglevel) {
                    renderer.error(err);
                }

                process.exit(1);
            })
            .on('log', function (log) {
                if (levels[log.level] >= loglevel) {
                    renderer.log(log);
                }
            })
            .on('prompt', function (prompt, callback) {
                renderer.prompt(prompt)
                    .then(function (answer) {
                        callback(answer);
                    });
            });

        // Warn if HOME is not SET
        if (!require('osenv').home()) {
            logger.warn('no-home', 'HOME not set, user configuration will not be loaded');
        }
    };
}

function getRenderer(command, json, config) {
    if (config.json || json) {
        return new renderers.Json(command, config);
    }

    return new renderers.Standard(command, config);
}

function guessLoglevel(config) {
    config = config || npd.config;
    // Set loglevel
    if (config.silent) {
        return levels.error;
    } else if (config.verbose) {
        return -Infinity;
//        Q.longStackSupport = true;
    } else if (config.quiet) {
        return levels.warn;
    } else {
        return levels[config.loglevel] || levels.info;
    }
}
