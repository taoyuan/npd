#!/usr/bin/env node

var yargs = require('yargs');
var _ = require('lodash');
var pad = require('pad');
var noap = require('../lib/noap');
var log = require('../lib/logger');

noap.load(function () {
    yargs.usage(genusage());

    var argv = yargs.argv;

    if (argv._.length === 0 || argv.help) {
        log.log(yargs.help());
    } else if (!noap.commands[argv._[0]]){
        log.error('command ' + argv._[0] + ' not found');
        log.log(yargs.help());
    } else {
        // make the aliases actually work.
        argv = yargs.normalize().argv;

        console.log(argv);
    }
});

function genusage() {
    var cusages = _.pluck(noap.commands, 'usage');
    var klen = longest(cusages.map(function (u) {
        return u[0] || '';
    }));
    var kmax = klen + 8;

    var usage = 'Install and deploy service daemons directly from packages\n\n' +
        'Usage:\n';

    _.forEach(cusages, function (u) {
        usage += pad('noap ' + u[0], kmax) + u[1] + '\n';
    });

    return usage;

    function longest (xs) {
        return Math.max.apply(
            null,
            xs.map(function (x) { return x.length })
        );
    }
}