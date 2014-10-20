"use strict";

var mout = require('mout');
var sh = require('./utils/sh');
var when = require('when');
var shellquote = require('shell-quote');

function _run(cmd, action, cwd, logger) {
    logger.action(action, cmd);

    //pass env + NPD_PID so callees can identify a preinstall+postinstall from the same npd instance
    var env = mout.object.mixIn({ 'NPD_PID': process.pid }, process.env);
    var args = shellquote.parse(cmd, env);
    var cmdName = args[0];
    mout.array.remove(args, cmdName); //no rest() in mout

    var options = {
        cwd: cwd,
        env: env
    };

//    if (process.getuid() === 0) cmdName = 'sudo ' + cmdName;

    var promise = sh.exec(cmdName, args, options);

    promise.progress(function (progress) {
        progress.split('\n').forEach(function (line) {
            if (line) {
                logger.action(action, line);
            }
        });
    });

    return promise;
}

function run(npdmeta, action, cwd, logger) {
    if (!npdmeta.scripts || !npdmeta.scripts[action]) {
        /*jshint newcap: false  */
        return when.resolve();
    }

    return _run(npdmeta.scripts[action], action, cwd, logger);
}

function hook(action, npdmeta, logger) {
    return run(npdmeta, action, logger);
}

module.exports = {
    run: run,
    preuninstall: mout.function.partial(hook, 'preuninstall'),
    preinstall: mout.function.partial(hook, 'preinstall'),
    postinstall: mout.function.partial(hook, 'postinstall')
};