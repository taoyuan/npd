"use strict";

var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var pad = require('pad');
var noap = require('./noap');
var log = require('./logger');

var slice = Array.prototype.slice;

/**
 * The basic command line interface of Mosca.
 *
 * @api private
 */
module.exports = function cli(args, callback) {

    args = args || [];
    callback = callback || function () {};

    var pkg = fs.readJsonFileSync(path.resolve(__dirname, '..', 'package.json'));

    var yargs = require('yargs')
        .usage(genUsage())
        // version
        .version(pkg.version, 'v')
        .alias('v', 'version')
        // helo
        .addHelpOpt('h')
        .alias('h', 'help')
        .options('u', {
            alias: 'user',
            default: 'noap',
            description: 'what user should scripts be executed as?'
        })
        .options('g', {
            alias: 'group',
            default: 'noap',
            description: 'what group should scripts be executed as?'
        })
        .options('s', {
            alias: 'sudo',
            default: true,
            description: 'should start|stop|restart command be run as super user?'
        })
        .options('p', {
            alias: 'platform',
            description: 'what OS platform is ndm being run on?'
        });

    var argv = yargs.parse(args);

    if (argv._.length === 0 || argv.help) {
        log.log(yargs.help());
        return callback();
    }

    noap.load(argv, function () {

        if (!noap.commands[argv._[0]]) {
            log.error('command `' + argv._[0] + '` not found');
            log.log(yargs.help());
            return callback();
        }

        start(argv, callback);
    });

};

function genUsage() {
    var cusages = _.pluck(noap.commands, 'usage');
    var klen = longest(cusages.map(function (u) {
        return u[0] || '';
    }));
    var kmax = klen + 8;

    var usage = 'Install and deploy service daemons directly from packages\n\n' +
        'Usage:\n';

    var i, u;
    for (i = 0; i < cusages.length; i++) {
        u = cusages[i];
        usage += pad('noap ' + u[0], kmax) + u[1] + (i === cusages.length - 1 ? '' : '\n');
    }

    return usage;

    function longest(xs) {
        return Math.max.apply(
            null,
            xs.map(function (x) {
                return x.length
            })
        );
    }
}

function start(argv, cb) {
    var cmd = argv._[0];
    var cmdargs = slice.call(argv._, 1);
    cmdargs.push(cb);

    try { // execute the command, passing along args.
        noap[cmd].apply(this, cmdargs);
    } catch (e) {
        log.error(e.message);
    }
}