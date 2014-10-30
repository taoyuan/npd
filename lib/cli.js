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
 * The basic command line interface of NPD.
 *
 * @api private
 */
module.exports = function cli(args) {
    args = args || ['-h'];

    var parser = nomnom
        .script(pkg.name)
        .option('version', {
            abbr: 'v',
            flag: true,
            help: 'show version.',
            callback: function () {
                return pkg.version;
            }
        })
        .option('uid', {
            abbr: 'u',
            help: 'what user should scripts be executed as?'
        })
        .option('gid', {
            abbr: 'g',
            help: 'what group should scripts be executed as?'
        })
        .option('local', {
            abbr: 'l',
            flag: true,
            default: false,
            help: 'using current directory as working directory'
        })
        .option('cwd', {
            abbr: 'd',
            help: 'specify the working directory'
        })
        .option('noBinLinks', {
            abbr: 'n',
            full: 'no-bin-links',
            flag: true,
            help: 'prevent npd from creating symlinks for any binaries the package might contain'
        })
        .option('quiet', {
            abbr: 'q',
            flag: true,
            help: 'Only output important information'
        })
        .option('silent', {
            abbr: 's',
            flag: true,
            help: 'Do not output anything, besides errors'
        })
        .option('verbose', {
            abbr: 'V',
            flag: true,
            help: 'Makes output more verbose'
        })
        .option('loglevel', {
            full: 'log-level',
            help: 'What level of logs to report'
        });

    parser.printer(function(str, code) {
        console.log(str);
        notifyUpdate();
        process.exit(code || 0);
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
            .on('error', function (err) {
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

function notifyUpdate() {
    var updateNotifier = require('update-notifier');

    // Check for newer version of Npd
    var notifier = updateNotifier({
        packageName: pkg.name,
        packageVersion: pkg.version
    });

    if (notifier.update) notifier.notify();
}
