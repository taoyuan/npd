"use strict";

var mout = require('mout');
var sh = require('./utils/sh');
var when = require('when');
var shellquote = require('shell-quote');

function _run(cmd, action, cwd, logger, config) {
    logger.action(action, cmd);

    var env = {'NPD_PID': process.pid };
    if (config) {
        env = mout.object.mixIn(env, {
            'UID': config.uid,
            'GID': config.gid
        });
    }
    env = mout.object.mixIn(env, process.env);
    var args = shellquote.parse(cmd, env);
    var cmdName = args[0];
    mout.array.remove(args, cmdName); //no rest() in mout

    var options = {
        cwd: cwd,
        env: env
    };

    return sh.exec(cmdName, args, options, function (progress) {
        process.stdout.write(progress);
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
