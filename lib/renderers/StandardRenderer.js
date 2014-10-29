var chalk = require('chalk');
var path = require('path');
var mout = require('mout');
var archy = require('archy');
var when = require('when');
var stringifyObject = require('stringify-object');
var os = require('os');
var fdata = require('./fdate');
var pkg = require(path.join(__dirname, '../..', 'package.json'));

function StandardRenderer(command, config) {
    this._sizes = {
        id: 13,    // Id max chars
        label: 20, // Label max chars
        sumup: 5   // Amount to sum when the label exceeds
    };
    this._colors = {
        warn: chalk.yellow,
        error: chalk.red,
        conflict: chalk.magenta,
        debug: chalk.gray,
        default: chalk.cyan
    };

    this._command = command;
    this._config = config;

    if (this.constructor._wideCommands.indexOf(command) === -1) {
        this._compact = true;
    } else {
        this._compact = process.stdout.columns < 120;
    }

    var exitOnPipeError = function (err) {
        if (err.code === 'EPIPE') {
            process.exit(0);
        }
    };

    // It happens when piping command to "head" util
    process.stdout.on('error', exitOnPipeError);
    process.stderr.on('error', exitOnPipeError);
}

StandardRenderer.prototype.end = function (data) {
    var method = '_' + mout.string.camelCase(this._command);

    if (this[method]) {
        this[method](data);
    }
};

StandardRenderer.prototype.error = function (err) {
    var str;
    var stack;

    this._guessOrigin(err);

    err.id = err.code || 'error';
    err.level = 'error';

    str = this._prefix(err) + ' ' + err.message.replace(/\r?\n/g, ' ').trim() + '\n';
    this._write(process.stderr, 'npd ' + str);

    // Check if additional details were provided
    if (err.details) {
        str = chalk.yellow('\nAdditional error details:\n') + err.details.trim() + '\n';
        this._write(process.stderr, str);
    }

    // Print trace if verbose, the error has no code
    // or if the error is a node error
    if (this._config.verbose || !err.code || err.errno) {
        /*jshint camelcase:false*/
        stack = err.fstream_stack || err.stack || 'N/A';
        str = chalk.yellow('\nStack trace:\n');
        str += (Array.isArray(stack) ? stack.join('\n') : stack) + '\n';
        str += chalk.yellow('\nConsole trace:\n');
        /*jshint camelcase:true*/

        this._write(process.stderr, str);
        console.trace();

        // Print npd version, node version and system info.
        this._write(process.stderr, chalk.yellow('\nSystem Info:\n'));
        this._write(process.stderr, 'npd version: ' + pkg.version + '\n');
        this._write(process.stderr, 'node version: ' + process.versions.node + '\n');
        this._write(process.stderr, 'os: ' + os.type() + ' ' + os.release() + ' ' + os.arch() + '\n');
    }
};

StandardRenderer.prototype.log = function (log) {
    var method = '_' + mout.string.camelCase(log.id) + 'Log';

    this._guessOrigin(log);

    // Call render method for this log entry or the generic one
    if (this[method]) {
        this[method](log);
    } else {
        this._genericLog(log);
    }
};

StandardRenderer.prototype.prompt = function (prompts) {
    var deferred;

    // Strip colors from the prompt if color is disabled
    if (!this._config.color) {
        prompts.forEach(function (prompt) {
            prompt.message = chalk.stripColor(prompt.message);
        });
    }

    // Prompt
    deferred = when.defer();
    var inquirer = require('inquirer');
    inquirer.prompt(prompts, deferred.resolve);

    return deferred.promise;
};

// -------------------------

StandardRenderer.prototype._install = function (packages) {
    var str = '';

    mout.object.forOwn(packages, function (pkg) {
        var cliTree;

        // List only 1 level deep dependencies
        mout.object.forOwn(pkg.dependencies, function (dependency) {
            dependency.dependencies = {};
        });
        // Make canonical dir relative
        pkg.canonicalDir = path.relative(this._config.dir, pkg.canonicalDir);
        // Signal as root
        pkg.root = true;

        cliTree = this._tree2archy(pkg);
        str += '\n' + archy(cliTree);
    }, this);

    if (str) {
        this._write(process.stdout, str);
    }
};

StandardRenderer.prototype._update = function (packages) {
    this._install(packages);
};

StandardRenderer.prototype._list = function (tree) {
    var cliTree;

    if (tree.pkgMeta) {
        tree.root = true;
        cliTree = archy(this._tree2archy(tree));
    } else {
        cliTree = stringifyObject(tree, { indent: '  ' }).replace(/[{}]/g, '') + '\n';
    }

    this._write(process.stdout, cliTree);
};

StandardRenderer.prototype._link = function (data) {
    this._sizes.id = 4;

    this.log({
        id: 'link',
        level: 'info',
        message: data.dst + ' > ' + data.src
    });

    // Print also a tree of the installed packages
    if (data.installed) {
        this._install(data.installed);
    }
};

StandardRenderer.prototype._cacheList = function (entries) {
    entries.forEach(function (entry) {
        var pkgMeta = entry.pkgMeta;
        var version = pkgMeta.version || pkgMeta._target;
        this._write(process.stdout, pkgMeta.name + '=' + pkgMeta._source + '#' + version + '\n');
    }, this);
};

// -------------------------

StandardRenderer.prototype._genericLog = function (log) {
    var stream;
    var str;

    if (log.level === 'warn') {
        stream = process.stderr;
    } else {
        stream = process.stdout;
    }

    str = this._prefix(log) + ' ' + log.message + '\n';
    this._write(stream, '[' + chalk.grey(fdata.asString(new Date())) + '] npd ' + str);
};

StandardRenderer.prototype._checkoutLog = function (log) {
    if (this._compact) {
        log.message = log.origin.split('#')[0] + '#' + log.message;
    }

    this._genericLog(log);
};

StandardRenderer.prototype._progressLog = function (log) {
    if (this._compact) {
        log.message = log.origin + ' ' + log.message;
    }

    this._genericLog(log);
};

StandardRenderer.prototype._extractLog = function (log) {
    if (this._compact) {
        log.message = log.origin + ' ' + log.message;
    }

    this._genericLog(log);
};

StandardRenderer.prototype._jsonLog = function (log) {
    this._write(process.stdout, '\n' + this._highlightJson(log.data.json) + '\n\n');
};

StandardRenderer.prototype._cachedEntryLog = function (log) {
    if (this._compact) {
        log.message = log.origin;
    }

    this._genericLog(log);
};

// -------------------------

StandardRenderer.prototype._guessOrigin = function (log) {
    var data = log.data;

    if (!data) {
        return;
    }

    if (data.endpoint) {
        log.origin = data.endpoint.name || (data.registry && data.endpoint.source);

        // Resort to using the resolver name for unnamed endpoints
        if (!log.origin && data.resolver) {
            log.origin = data.resolver.name;
        }

        if (log.origin && data.endpoint.target) {
            log.origin += '#' + data.endpoint.target;
        }
    } else if (data.name) {
        log.origin = data.name;

        if (data.version) {
            log.origin += '#' + data.version;
        }
    }
};

StandardRenderer.prototype._prefix = function (log) {
    var label;
    var length;
    var nrSpaces;
    var id = this.constructor._idMappings[log.id] || log.id;
    var idColor = this._colors[log.level] || this._colors.default;

    if (this._compact) {
        // If there's not enough space for the id, adjust it
        // for subsequent logs
        if (id.length > this._sizes.id) {
            this._sizes.id = id.length += this._sizes.sumup;
        }

        return idColor(mout.string.rpad(id, this._sizes.id));
    }

    // Construct the label
    label = log.origin || '';
    length = id.length + label.length + 1;
    nrSpaces = this._sizes.id + this._sizes.label - length;

    // Ensure at least one space between the label and the id
    if (nrSpaces < 1) {
        // Also adjust the label size for subsequent logs
        this._sizes.label = label.length + this._sizes.sumup;
        nrSpaces = this._sizes.id + this._sizes.label - length;
    }

    return chalk.green(label) + mout.string.repeat(' ', nrSpaces) + idColor(id);
};

StandardRenderer.prototype._write = function (stream, str) {
    if (!this._config.color) {
        str = chalk.stripColor(str);
    }

    stream.write(str);
};

StandardRenderer.prototype._highlightJson = function (json) {
    var cardinal = require('cardinal');

    return cardinal.highlight(stringifyObject(json, { indent: '  ' }), {
        theme: {
            String: {
                _default: function (str) {
                    return chalk.cyan(str);
                }
            },
            Identifier: {
                _default: function (str) {
                    return chalk.green(str);
                }
            }
        },
        json: true
    });
};

StandardRenderer.prototype._tree2archy = function (node) {
    var dependencies = mout.object.values(node.dependencies);
    var version = !node.missing ? node.pkgMeta._release || node.pkgMeta.version : null;
    var label = node.endpoint.name + (version ? '#' + version : '');
    var update;

    if (node.root) {
        label += ' ' + node.canonicalDir;
    }

    // State labels
    if (node.missing) {
        label += chalk.red(' not installed');
        return label;
    }

    if (node.different) {
        label += chalk.red(' different');
    }

    if (node.linked) {
        label += chalk.magenta(' linked');
    }

    if (node.incompatible) {
        label += chalk.yellow(' incompatible') + ' with ' + node.endpoint.target;
    } else if (node.extraneous) {
        label += chalk.green(' extraneous');
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

    if (!dependencies.length) {
        return label;
    }

    return {
        label: label,
        nodes: mout.object.values(dependencies).map(this._tree2archy, this)
    };
};

StandardRenderer._wideCommands = [
    'install',
    'update'
];
StandardRenderer._idMappings = {
    'mutual': 'conflict',
    'cached-entry': 'cached'
};

module.exports = StandardRenderer;
