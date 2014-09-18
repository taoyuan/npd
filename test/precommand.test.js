"use strict";

var path = require('path');
var t = require('chai').assert;
var precommand = require('../lib/cli/precommand');
var pkg = path.normalize(path.join(__dirname, '..', 'package.json'));

describe('precommand', function () {
    it('should execute command function', function (done) {
        var cli = require('cli-command')(pkg);
        var args = ['ls', '-v', 'file.txt'];
        cli
            .configure({command: {before: precommand}})
            .option('-v --verbose', 'print more information')
            .command('ls')
            .usage('ls <file>')
            .description('list files')
            .action(function (info, req, next) {
                //args.shift();
                t.equal(info.name, 'ls');
                t.equal(info.cmd.name(), 'ls');
                //expect(info.args).to.eql(args);
                t.isFunction(next);
                t.equal(cli.verbose, true);
                //
                done();
            });
        cli.parse(args);
    });

    it('should throw error without required argument', function (done) {
        var cli = require('cli-command')(pkg);
        var args = ['ls'];
        cli
            .configure({command: {before: precommand}})
            .option('-v --verbose', 'print more information')
            .command('ls')
            .usage('ls <file>')
            .description('list files')
            .action(function (info, req, next) {
                t.fail();
            });

        t.throw(function () {
            cli.parse(args);
        });
        done();
    });

});