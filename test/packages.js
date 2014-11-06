var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var when = require('when');
var nfn = require('when/node');
var semver = require('semver');
var chalk = require('chalk');
var sh = require('../lib/utils/sh');
var packages = require('./packages.json');
var nomnom = require('nomnom');

var options = nomnom.options({
    'force': {
        abbr: 'f',
        flag: true
    }
}).parse();

var env = {
    'GIT_AUTHOR_DATE': 'Fri Sep 26 10:20:00 2014 +0000',
    'GIT_AUTHOR_NAME': 'Yuan Tao',
    'GIT_AUTHOR_EMAIL': 'torworx@gmail.com',
    'GIT_COMMITTER_DATE': 'Fri Sep 26 10:20:00 2014 +0000',
    'GIT_COMMITTER_NAME': 'Yuan Tao',
    'GIT_COMMITTER_EMAIL': 'torworx@gmail.com'
};

// Preserve the original environment
_.assign(env, process.env);

function ensurePackage(dir) {
    var promise;

    // If force is specified, delete folder
    if (options.force) {
        promise = nfn.call(fs.remove, dir)
            .then(function () {
                throw new Error();
            });
        // Otherwise check if .git is already created
    } else {
        promise = nfn.call(fs.stat, path.join(dir, '.git'));
    }

    // Only create if stat failed
    return promise.catch(function () {
        // Create dir
        return nfn.call(fs.mkdirp, dir)
            // Init git repo
            .then(sh.exec.bind(null, 'git', ['init'], { cwd: dir }))
            // Create dummy file
            .then(function () {
                return nfn.call(fs.writeFile, path.join(dir, '.master'), 'based on master');
            })
            // Stage files
            .then(sh.exec.bind(null, 'git', ['add', '-A'], { cwd: dir }))
            // Commit
            // Note that we force a specific date and author so that the same
            // commit-sha's are always equal
            // These commit-sha's are used internally in tests!
            .then(function () {
                return sh.exec('git', ['commit', '-m"Initial commit."'], {
                    cwd: dir,
                    env: env
                });
            })
            .then(function () {
                return dir;
            });
    });
}

function checkRelease(dir, release) {
    if (semver.valid(release)) {
        return sh.exec('git', ['tag', '-l'], { cwd: dir })
            .spread(function (stdout) {
                return stdout.split(/\s*\r*\n\s*/).some(function (tag) {
                    return semver.clean(tag) === release;
                });
            });
    }

    return sh.exec('git', ['branch', '--list'], { cwd: dir })
        .spread(function (stdout) {
            return stdout.split(/\s*\r*\n\s*/).some(function (branch) {
                branch = branch.trim().replace(/^\*?\s*/, '');
                return branch === release;
            });
        });
}

function createRelease(dir, release, files) {
    var branch = semver.valid(release) ? 'branch-' + release : release;

    // Checkout master
    return sh.exec('git', ['checkout', 'master', '-f'], { cwd: dir })
        // Attempt to delete branch, ignoring the error
        .then(function () {
            return sh.exec('git', ['branch', '-D', branch], { cwd: dir })
                .catch(function () {
                });
        })
        // Checkout based on master
        .then(sh.exec.bind(null, 'git', ['checkout', '-b', branch, 'master'], { cwd: dir }))
        // Create files
        .then(function () {
            var promise;
            var promises = [];

            _.forEach(files, function (contents, name) {
                name = path.join(dir, name);

                // Convert contents to JSON if they are not a string
                if (typeof contents !== 'string') {
                    contents = JSON.stringify(contents, null, '  ');
                }

                promise = nfn.call(fs.mkdirp, path.dirname(name))
                    .then(function () {
                        return nfn.call(fs.writeFile, name, contents);
                    });

                promises.push(promise);
            });

            // Delete dummy .master file that is present on the master branch
            promise = nfn.call(fs.unlink, path.join(dir, '.master'));
            promises.push(promise);

            return when.all(promises);
        })
        // Stage files
        .then(sh.exec.bind(null, 'git', ['add', '-A'], { cwd: dir }))
        // Commit
        // Note that we force a specific date and author so that the same
        // commit-sha's are always equal
        // These commit-sha's are used internally in tests!
        .then(function () {
            return sh.exec('git', ['commit', '-m"Commit for ' + branch + '."'], {
                cwd: dir,
                env: env
            });
        })
        // Tag
        .then(function () {
            if (!semver.valid(release)) {
                return;
            }

            return sh.exec('git', ['tag', '-f', release], { cwd: dir })
                // Delete branch (not necessary anymore)
                .then(sh.exec.bind(null, 'git', ['checkout', 'master', '-f'], { cwd: dir }))
                .then(sh.exec.bind(null, 'git', ['branch', '-D', branch], { cwd: dir }));
        });
}

var promises = [];

// Process packages.json
_.forEach(packages, function (pkg, name) {
    var promise;
    var dir = path.join(__dirname, 'fixtures', name);

    // Ensure package is created
    promise = ensurePackage(dir);
    promise = promise.catch(function (err) {
        console.log('Failed to create ' + name);
        console.log(err.message);
    });

    _.forEach(pkg, function (files, release) {
        // Check if the release already exists
        promise = promise.then(checkRelease.bind(null, dir, release))
            .then(function (exists) {
                // Skip it if already created
                if (exists) {
                    return console.log(chalk.cyan('> ') + 'Package ' + name + '#' + release + ' already created');
                }

                // Create it based on the metadata
                return createRelease(dir, release, files)
                    .then(function () {
                        console.log(chalk.green('> ') + 'Package ' + name + '#' + release + ' successfully created');
                    });
            })
            .catch(function (err) {
                console.log(chalk.red('> ') + 'Failed to create ' + name + '#' + release);
                console.log(err.message.trim());
                if (err.details) {
                    console.log(err.details.trim());
                }
                console.log(err.stack);
            });
    });

    promises.push(promise);
});

when.settle(promises, function (results) {
    results.forEach(function (result) {
        if (result.state !== 'fulfilled') {
            process.exit(1);
        }
    });
});
