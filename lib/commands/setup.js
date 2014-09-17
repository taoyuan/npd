var fs = require('fs');
var util = require('util');
var path = require('path');
var async = require('async');
var common = require('../common');
var log = require('../logs').get('install');

/* bash action

 The content is a relative shell file path to pkg dir.
 That file will be executed in this action.
 */
function bashAction(content, next) {
    var bashPath = path.resolve(process.cwd(), content);
    var options = {env: common.getNinEnvForChildProcess()};
    common.execCmd('bash \"' + bashPath + '\"', options,
        function (code) {
            if (code !== 0) {
                next(new Error(util.format('execution of %s failed: %d.', bashPath, code)));
            } else {
                log.log('succeeded in execution of %s.', bashPath);
                next(null);
            }
        },
        function _streamToConsole(child) {
            child.stdout.on('data', function (buffer) {
                process.stdout.write(buffer.toString());
            });
            child.stderr.on('data', function (buffer) {
                process.stderr.write(buffer.toString());
            });
        });
}

/* grunt action

 This is complex :) The content is a relative grunt file path to pkg dir.
 That file will be executed with 'grunt <file>' cmds.
 In detail, the processes are:
 1. npm install in pkg dir to ensure all dev dependencies are there.
 2. grunt <file>.
 3. uninstall all dev dependencies.
 */
function gruntAction(content, next) {
    var npm = require('npm');
    var gruntFilePath = path.resolve(process.cwd(), content);
    // read package.json first
    var pkgJsonPath = path.resolve(process.cwd(), 'package.json');
    var pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath));
    var devInstalled = null;
    async.series([
        function (next) {
            // npm install all dev dependencies
            var deps = pkgJson.devDependencies;
            if (deps) {
                var tasks = [];
                Object.keys(deps).forEach(function (depName) {
                    tasks.push(function (next) {
                        npm.load(function (err, npm) {
                            if (err) {
                                return next(err);
                            }
                            // TODO: whatif depName is not name@version
                            npm.commands.install(process.cwd(), util.format('%s@"$s"', depName, deps[depName]), function (err) {
                                if (err) {
                                    return next(new Error(util.format('npm install %s failed: %j.', depName, err)));
                                }
                                next(null, depName);
                            });
                        });
                    });
                });
                async.series(tasks, function (err, results) {
                    if (err) {
                        return next(err);
                    }
                    devInstalled = results;
                    log.log('dev dependencies installed: %j.', devInstalled);
                    next(null);
                });
            } else {
                next(null);
            }
        },
        function (next) {
            // run the grunt file
            // notice that we will never callback an error, since if any grunt file failed,
            // we still need to proceed to cleanup phase
            var g = null, gf = null;
            var gpath = path.resolve(process.cwd(), 'node_modules/grunt/lib/grunt.js');
            try {
                console.log('loading %s.', gpath);
                g = require(gpath);
                console.log('loading %s.', gruntFilePath);
                gf = require(gruntFilePath);
            } catch (err) {
                log.error('can not require file, may be currupted: %j.', err);
                next(null);
            }
            if (g) {
                gf(g);
                g.tasks(['default'], {colors: false}, function (err) {
                    if (err) {
                        log.error('grunt file: %s execution failed: %j.', gruntFilePath, err);
                    }
                    next(null);
                });
            } else {
                log.error('grunt file: %s may be empty.', gruntFilePath);
                next(null);
            }
        },
        function (next) {
            // npm uninstall all dependencies
            if (devInstalled && devInstalled.length >= 1) {
                // have to remove one by one, since npm does not have a `remove --dev` cmd
                log.log('now remove dev dependencies: %j.', devInstalled);
                // again, since npm do not provide an internal api like install(where, what, cb)
                // have to hack like this, first change prefix, then change back later
                var oldprefix = npm.prefix;
                npm.prefix = process.cwd();
                var tasks = devInstalled.map(function (depName) {
                    return function (next) {
                        npm.load(function (err, npm) {
                            if (err) {
                                next(err);
                            }
                            npm.commands.uninstall(depName, function (err, result) {
                                if (err) {
                                    next(new Error(util.format('npm remove %s failed: %j.', depName, err)));
                                } else {
                                    log.log('removed dev dep: %s.', depName);
                                    next(null);
                                }
                            });
                        });
                    };
                });
                async.series(tasks, function (err) {
                    // hack npm, change back later
                    npm.prefix = oldprefix;
                    if (err) {
                        return next(err);
                    }
                    log.log('all dev dependencies removed.');
                    next(null);
                });
            } else {
                next(null);
            }
        }
    ], function (err, results) {
        next(err || null);
    });
}

// and we expose actionMap, this allows future plugins comein
exports.actionMap = {
    'bash': bashAction,
    'grunt': gruntAction
};

exports.setup = function (pkgPath, next) {
    common.readConfig(pkgPath, function (err, conf) {
        if (err) {
            return next(err);
        }
        var oldcwd = process.cwd();
        log.log('entering dir: %s.', pkgPath);
        process.chdir(pkgPath);
        if (conf.setup) {
            log.log('%d targets found.', conf.setup.length);
            var tasks = [];
            conf.setup.forEach(function (action, index) {
                tasks.push(function (next) {
                    if (exports.actionMap[action.type]) {
                        log.log('execute (%d) task: %j.', index, action);
                        exports.actionMap[action.type](action.content, next);
                    } else {
                        log.log('skip (%d) %s task.', index, action.type);
                        next(null);
                    }
                });
            });
            async.series(tasks, function (err) {
                log.log('leaving dir: %s.', pkgPath);
                process.chdir(oldcwd);
                if (err) {
                    return next(err);
                }
                log.log('all tasks done.');
                next();
            });
        }
    });
};

exports.register = function (cli) {
    var c = cli.command('setup')
        .usage('setup <pkgname>')
        .description('Setup your app.');

    c.action(function (info) {
        var pkgname = info.params.pkgname;
        common.setupGlobalOptions(cli);
        var p = path.resolve(process.cwd(), 'node_modules/' + pkgname);
        if (fs.existsSync(p)) {
            try {
                exports.setup(p, common.throwOutOrExit);
            } catch (err) {
                log.error(err);
                process.exit(1);
            }
        } else {
            log.error('pkg %s not found at %s.', pkgname, p);
            process.exit(1);
        }
    });
};
