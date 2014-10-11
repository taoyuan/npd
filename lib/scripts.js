"use strict";

var mout = require('mout');
var sh = require('./utils/sh');
var when = require('when');
var shellquote = require('shell-quote');

var run = function (cmd, action, logger, config) {
    logger.action(action, cmd);

    //pass env + BOWER_PID so callees can identify a preinstall+postinstall from the same bower instance
    var env = mout.object.mixIn({ 'BOWER_PID': process.pid }, process.env);
    var args = shellquote.parse(cmd, env);
    var cmdName = args[0];
    mout.array.remove(args, cmdName); //no rest() in mout

    var options = {
        cwd: config.dir,
        env: env
    };

    var promise = sh.exec(cmdName, args, options);

    promise.progress(function (progress) {
        progress.split('\n').forEach(function (line) {
            if (line) {
                logger.action(action, line);
            }
        });
    });

    return promise;
};

var hook = function (action, config, logger, packages, installed) {
    var pkgs = mout.object.keys(packages);
    if (pkgs.length === 0 || !config.scripts || !config.scripts[action]) {
        /*jshint newcap: false  */
        return when();
    }

    var cmd = mout.string.replace(config.scripts[action], '%', pkgs.join(' '));
    return run(cmd, action, logger, config);
};

module.exports = {
    preuninstall: mout.function.partial(hook, 'preuninstall'),
    preinstall: mout.function.partial(hook, 'preinstall'),
    postinstall: mout.function.partial(hook, 'postinstall')
};