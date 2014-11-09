"use strict";

var _ = require('lodash');
var path = require('path');
var nomnom = require('nomnom');
var logger = require('./logs').logger;
var npd = require('./npd');
var utils = require('./utils');
var pkg = require('../package');

var __slice = Array.prototype.slice;

var local;

/**
 * The basic command line interface of NPD.
 *
 * @api private
 */
module.exports = function cli(args) {
    args = args || ['-h'];

    var scmd = path.basename(process.argv[1]);
    local = (scmd === 'npdl');

    var parser = nomnom
        .script(scmd)
        .option('version', {
            abbr: 'v',
            flag: true,
            help: 'show version.',
            callback: function () {
                return pkg.version;
            }
        })
        .option('uid', {
            abbr: 'U',
            help: 'what user should scripts be executed as?'
        })
        .option('gid', {
            abbr: 'G',
            help: 'what group should scripts be executed as?'
        })
        .option('global', {
            abbr: 'g',
            flag: true,
            default: false,
            help: 'install the package globally rather than locally'
        })
        .option('cwd', {
            abbr: 'd',
            help: 'specify the working directory'
        })
        .option('bin-links', {
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
        })
        .option('force', {
            abbr: 'f',
            flag: true,
            help: 'force ignore some errors'
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
        def.callback(invoker(command.line));
    });

    parser.command(undefined)
        .callback(function () {
            parser.print(parser.getUsage());
        });

    parser.parse(args);

};

function invoker(fn) {
    return function (argv) {
        if (argv.cwd) argv.cwd = path.resolve(argv.cwd);

        npd.load(argv);

        logger.level =  guessLoglevel(npd.config);

        // omit first command
        fn(__slice.call(argv._, 1));

        // Warn if HOME is not SET
        if (!require('osenv').home()) {
            logger.warn('no-home', 'HOME not set, user configuration will not be loaded');
        }
    };
}

function guessLoglevel(config) {
    config = config || npd.config;
    // Set loglevel
    if (config.silent) {
        return 'error';
    } else if (config.verbose) {
        return 'silly';
    } else if (config.quiet) {
        return 'warn';
    } else {
        return config.loglevel || 'info';
    }
}

function notifyUpdate() {
    var updateNotifier = require('update-notifier');

    // Check for newer version of Module
    var notifier = updateNotifier({
        packageName: pkg.name,
        packageVersion: pkg.version
    });

    if (notifier.update) notifier.notify();
}
