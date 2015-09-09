"use strict";

var _ = require('lodash');
var sh = require('./utils/sh');
var when = require('when');
var shellquote = require('shell-quote');

function _run(cmdline, action, cwd, logger, config) {
    var env = {'NPD_PID': process.pid };
    if (config) {
        if (config.uid) env.UID = config.uid;
        if (config.gid) env.GID = config.gid;
    }
    env = _.assign(env, process.env);
    var args = shellquote.parse(cmdline, env);
    var cmd = args[0];
    _.remove(args, function(arg) { return arg === cmd; });

    var options = {
        cwd: cwd,
        env: env
    };

    logger.action(action, cmd + ' ' + shellquote.quote(args));

    return sh.exec(cmd, args, options, function (progress) {
        process.stdout.write(progress);
    });
}

function run(modmeta, action, cwd, logger, config) {
    if (!has(modmeta, action)) {
        /*jshint newcap: false  */
        return when.resolve();
    }

    return _run(modmeta.scripts[action], action, cwd, logger, config);
}

function has(modmeta, action) {
    return modmeta && action && modmeta.scripts && modmeta.scripts[action];
}

module.exports = {
    has: has,
    run: run
};
