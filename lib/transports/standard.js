var _ = require('lodash');
var path = require('path');
var util = require('util');
var chalk = require('chalk');
var os = require('os');
var archy = require('archy');
var Console = require('wide/transports').Console;

var npd = require('../npd');

var Standard = exports.Standard = function (options) {
    Console.call(this, options);
    options = options || {};
    this.level = options.level || 'info';
    this.appversion = options.appversion || 'N/A';
};

//
// Inherit from `wide.Transport` so you can take advantage
// of the base functionality and `.handleExceptions()`.
//
util.inherits(Standard, Console);

Standard.prototype.name = 'standard';

Standard.prototype.log = function (rec, cb) {
    if (rec.level === 'error') {
        this.error(rec);
    } else if (rec.level === 'phase') {
        var method = 'phase$' + rec.id;
        if (this[method]) {
            this[method](rec.message, rec.data);
        }
    } else {
        this._guessLabel(rec);
        this._log(rec);
    }

    //
    // Emit the `logged` event immediately because the event loop
    // will not exit until `process.stdout` has drained anyway.
    //
    this.emit('logged');
    return cb && cb(null, true);
};

Standard.prototype.error = function (rec) {
    var write = this.writer(process.stderr);
    var err = rec.data;
    var str;
    var stack;

    err.id = err.code || 'error';
    err.level = 'error';

    write(this.renderer.render({
        appname: this.appname,
        colorize: this.colorize,
        json: this.json,
        level: err.level,
        message: err.message.replace(/\r?\n/g, ' ').trim(),
        stringify: this.stringify,
        prettyPrint: this.prettyPrint,
        raw: this.raw,
        id: err.id
    }));

    // Check if additional details were provided
    if (err.details) {
        write(chalk.yellow('\nAdditional error details:\n') + err.details.trim() + '\n');
    }

    // Print trace if verbose, the error has no code
    // or if the error is a node error
    if (!err.code || err.errno) {
        /*jshint camelcase:false*/
        stack = err.fstream_stack || err.stack || 'N/A';
        str = chalk.yellow('\nStack trace:\n');
        str += (Array.isArray(stack) ? stack.join('\n') : stack) + '\n';
        str += chalk.yellow('\nConsole trace:\n');
        /*jshint camelcase:true*/

        write(str);

        console.trace();

        // Print npd version, node version and system info.
        write(chalk.yellow('\nSystem Info:\n'));
        write(this.appname + ' version: ' + this.appversion + '\n');
        write('node version: ' + process.versions.node + '\n');
        write('os: ' + os.type() + ' ' + os.release() + ' ' + os.arch() + '\n');
    }

};

// phases methods
Standard.prototype.phase$end = function (command, data) {
    command = 'end$' + command;
    if (this[command]) {
        return this[command](data);
    }
};

Standard.prototype.end$install = function (packages) {
    var str = '';

    _.forEach(packages, function (pkg) {
        var cliTree;

        // Make canonical dir relative
        pkg.canonicalDir = path.relative(npd.config.dir, pkg.canonicalDir);
        // Signal as root
        pkg.root = true;

        cliTree = this._tree2archy(pkg);
        str += '\n' + archy(cliTree);
    }, this);

    if (str) {
        this.writer(process.stdout)(str);
    }
};

// -----------------------------------------------------------

Standard.prototype._log = function (rec) {
    if (this.silent) return;

    var output = this.renderer.render({
        appname: this.appname,
        colorize: this.colorize,
        json: this.json,
        level: rec.level,
        message: rec.message,
        stringify: this.stringify,
        timestamp: this.timestamp,
        prettyPrint: this.prettyPrint,
        raw: this.raw,
        id: rec.id,
        label: rec.label
    });

    if (rec.level === 'error' || rec.level === 'debug') {
        process.stderr.write(output + '\n');
    } else {
        process.stdout.write(output + '\n');
    }
};

Standard.prototype._guessLabel = function (rec) {
    var data = rec.data;

    if (!data) {
        return;
    }

    if (data.endpoint) {
        rec.label = data.endpoint.name || (data.registry && data.endpoint.source);

        // Resort to using the resolver name for unnamed endpoints
        if (!rec.label && data.resolver) {
            rec.label = data.resolver.name;
        }

        if (rec.label && data.endpoint.target) {
            rec.label += '#' + data.endpoint.target;
        }
    } else if (data.name) {
        rec.label = data.name;

        if (data.version) {
            rec.label += '#' + data.version;
        }
    }
};

Standard.prototype._tree2archy = function (node) {
    var version = !node.missing ? node.pkgMeta._release || node.pkgMeta.version : null;
    var label = node.endpoint.name + (version ? '#' + version : '');
    var update;

    if (node.root) {
        label += ' ' + node.canonicalDir;
    }

    // New versions
    if (node.update) {
        update = '';

        if (node.update.target && node.pkgMeta.version !== node.update.target) {
            update += node.update.target + ' available';
        }

        if (node.update.latest !== node.update.target) {
            update += (update ? ', ' : '');
            update += 'latest is ' + node.update.latest;
        }

        if (update) {
            label += ' (' + chalk.cyan(update) + ')';
        }
    }

    return label;
};

Standard.prototype.writer = function writer(stream) {
    return function (output) {
        stream.write(output);
    };
};
