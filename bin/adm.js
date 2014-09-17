#!/usr/bin/env node

var _ = require('lodash');
var path = require('path');
var needs = require('needs');

require('ttycolor')().defaults();

// use existing meta data (package.json)
var cli = require('cli-command')(path.join(__dirname, '..', 'package.json'));

cli.configure({
    help: {sections: {bugs: 'Report bugs to ' + cli.package().bugs}},
    command: {
        before: require('../lib/cli/cmdval')
    }
});

cli.option('-v --verbose', 'print more information')
    .version()
    .help('-h --help')
    .on('empty', function (help, version) {
        help.call(this, true);
        version.call(this, true);
        console.error(this.name() + ': command required');
    })
    .on('error', function (e) {
        // map of error definitions is `this.errors`
        if (e.code === this.errors.EUNCAUGHT.code) {
            e.error(false); // omit stack trace
            e.exit();       // use error definition exit code
        }
        // pass other errors through to the default handler
        this.error(e);
    });

var commands = needs(__dirname + '/../lib/commands');
_.forEach(commands, function (cmd, name) {
    if (typeof cmd.register !== 'function') throw new Error('Invalid command: `' + name + '`');
    cmd.register(cli);
});

cli.parse();  // defaults to process.argv.slice(2)