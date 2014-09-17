"use strict";

/*jshint -W030 */

var _ = require('lodash');
var util = require('util');
var fs = require('fs');
var path = require('path');
var logs = require('./logs');
var log = logs.get('common');

exports.admcwd = process.cwd();

exports.throwOutOrExit = function(err) {
    if (err) {
        throw err;
    } else {
        process.exit(0);
    }
};

exports.admenv = (function() {
    var p = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json')).toString());
    return {
        pkginfo: p,
        pkgdir: process.cwd()
    };
})();

exports.getNinEnvForChildProcess = function() {
    return _.extend(process.env, _.reduce(exports.admenv, function(e, value, key) {
        e['NIN_' + key.toUpperCase()] = _.isString(value) ? value : JSON.stringify(value);
        return e;
    }, {}));
};

exports.setupGlobalOptions = function(cli) {
    if (cli.quiet) {
        logs.setLevel('ERROR');
    }
};

exports.formatDescription = function(contents) {
    if (_.isArray(contents)) {
        return contents.join('\n   > ');
    } else {
        return contents.toString();
    }
};

exports.execCmd = function(cmdstr, options, callback, hooks) {
    var child = require('child_process').exec(cmdstr, options || null);
    var out = '';
    var err = '';
    // first default hooks
    if (child.stdout) { child.stdout.on('data', function(buffer) { out += buffer.toString(); }); }
    if (child.stderr) { child.stderr.on('data', function(buffer) { err += buffer.toString(); }); }
    child.on('close', function(code) { callback(code, out, err); });
    // then customized hooks
    hooks && hooks(child);
};

exports.spawnCmd = function(cmd, args, options, hooks) {
    var child = require('child_process').spawn(cmd, args || [], options || null);
    // then customized hooks
    hooks && hooks(child);
};

exports.readConfig = function(pkgPath, callback) {
    var p = path.resolve(pkgPath, 'adm.json');
    if (!fs.existsSync(p)) {
        return callback(new Error(util.format('No adm.json in pkg path %s.', pkgPath)));
    }
    fs.readFile(p, function(err, content) {
        if (err) {
            return callback(new Error(util.format('Read adm.json in pkg path %s failed: %j.', pkgPath, err)));
        } else {
            var j = JSON.parse(content);
            log.log('loaded adm.json of %s.', pkgPath);
            callback(null, j);
        }
    });
};

exports.readRegistry = function(callback) {
    var p = path.resolve(exports.admcwd, 'adm-registry.json');
    if (fs.existsSync(p)) {
        fs.readFile(p, function(err, data) {
            if (err) {
                return callback(err);
            }
            callback(null, JSON.parse(data.toString()));
        });
    } else {
        callback(null, { apps: {} });
    }
};

exports.writeRegistry = function(reg, callback) {
    var p = path.resolve(exports.admcwd, 'adm-registry.json');
    fs.writeFile(p, JSON.stringify(reg, null, "  "), function(err) {
        callback(err);
    });
};
