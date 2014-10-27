"use strict";

var _ = require('lodash');
var sh = require('./utils/sh');
var when = require('when');
var shellquote = require('shell-quote');

function _run(cmd, action, cwd, logger, config) {
    logger.action(action, cmd);

    var env = {'NPD_PID': process.pid };
    if (config) {
        if (config.uid) env.UID = config.uid;
        if (config.gid) env.GID = config.gid;
    }
    env = _.assign(env, process.env);
    var args = shellquote.parse(cmd, env);
    var cmdName = args[0];
    _.remove(args, function(arg) { return arg == cmdName; });

    var options = {
        cwd: cwd,
        env: env
    };

    return sh.exec(cmdName, args, options, function (progress) {
        console.log(progress);
    });
}

function run(npdmeta, action, cwd, logger, config) {
    if (!npdmeta.scripts || !npdmeta.scripts[action]) {
        /*jshint newcap: false  */
        return when.resolve();
    }

    return _run(npdmeta.scripts[action], action, cwd, logger, config);
}

module.exports = {
    run: run
};
