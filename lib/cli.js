"use strict";

var _ = require('lodash');
var nomnom = require('nomnom');
var commands = require('./commands');
var utils = require('./utils');

var pkg = require('../package');

var slice = Array.prototype.slice;

/**
 * The basic command line interface of Mosca.
 *
 * @api private
 */
module.exports = function cli(args) {
    args = args || ['-h'];

    var parser = nomnom
        .script('noap')
        .option('version', {
            abbr: 'v',
            flag: true,
            help: 'show version.',
            callback: function () {
                return pkg.version;
            }

        })
        .option('global', {
            abbr: 'g',
            default: false,
            flag: true,
            help: 'should install|update|uninstall command be run as global?'
        })
        .option('sudo', {
            abbr: 's',
            default: true,
            flag: true,
            help: 'should start|stop|restart command be run as super user?'
        })
        .option('user', {
            abbr: 'u',
            metavar: 'UID',
            default: 'noap',
            help: 'what user should scripts be executed as?'
        })
        .option('group', {
            abbr: 'g',
            metavar: 'GID',
            default: 'noap',
            help: 'what group should scripts be executed as?'
        })
        .option('platform', {
            abbr: 'p',
            metavar: 'PLATFORM',
            help: 'what OS platform is ndm being run on?'
        });

    _.forEach(commands, function (command, name) {
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
        def.callback(command.line);
    });

    parser.command()
        .callback(function () {
            parser.print(parser.getUsage());
        });

    parser.parse(args);

};