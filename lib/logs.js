// this file is adapted from https://github.com/npm/npmlog

"use strict";

var EE = require('events').EventEmitter;
var util = require('util');
var ansi = require('ansi');
var date = require('dateformat');

var logger = new EE();
logger.cursor = ansi(process.stderr);
logger.stream = process.stderr;

// by default, let ansi decide based on tty-ness.
var colorEnabled = false;
logger.enableColor = function () {
    colorEnabled = true;
    this.cursor.enabled = true;
};
logger.disableColor = function () {
    colorEnabled = false;
    this.cursor.enabled = false;
};

// default level
logger.level = 'log';

// temporarily stop emitting, but don't drop
logger.pause = function () {
    this._paused = true;
};

logger.resume = function () {
    if (!this._paused) return;
    this._paused = false;

    var b = this._buffer;
    this._buffer = [];
    b.forEach(function (m) {
        this.emitLog(m);
    }, this);
};

logger._buffer = [];

var id = 0;
logger.record = [];
logger.maxRecordSize = 10000;
logger._log = function (lvl, prefix, message) {
    var l = this.levels[lvl];
    if (l === undefined) {
        return this.emit('error', new Error(util.format(
            'Undefined log level: %j', lvl)));
    }

    var a = new Array(arguments.length - 2);
    var stack = null;
    for (var i = 2; i < arguments.length; i++) {
        var arg = a[i - 2] = arguments[i];

        // resolve stack traces to a plain string.
        if (typeof arg === 'object' && arg &&
            (arg instanceof Error) && arg.stack) {
            arg.stack = stack = arg.stack + '';
        }
    }
    if (stack) a.unshift(stack + '\n');
    message = util.format.apply(util, a);

    var m = {
        id: id++,
        level: lvl,
        prefix: String(prefix || ''),
        message: message,
        messageRaw: a
    };

    this.emit('log', m);
    this.emit('log.' + lvl, m);
    if (m.prefix) this.emit(m.prefix, m);

    this.record.push(m);
    var mrs = this.maxRecordSize;
    var n = this.record.length - mrs;
    if (n > mrs / 10) {
        var newSize = Math.floor(mrs * 0.9);
        this.record = this.record.slice(-1 * newSize);
    }

    this.emitLog(m);
}.bind(logger);

logger.emitLog = function (m) {
    if (this._paused) {
        this._buffer.push(m);
        return;
    }
    var l = this.levels[m.level];
    if (l === undefined) return;
    if (l < this.levels[this.level]) return;
    if (l > 0 && !isFinite(l)) return;

    var style = logger.style[m.level];
    var disp = logger.disp[m.level];
    m.message.split(/\r?\n/).forEach(function (line) {
        this.write('[');
        this.write(date(new Date(), 'HH:MM:ss'), {fg: 'grey'});
        this.write(']');
        if (this.heading) {
            this.write(' ');
            this.write(this.heading, this.headingStyle);
        }
        if (disp) {
            this.write(' ');
            this.write(disp, style);
        }

        var p = m.prefix || '';
        if (p) {
            this.write(' ');
            this.write(p, this.prefixStyle);
        }
        this.write(' ' + line + '\n');
    }, this);
};

logger.write = function (msg, style) {
    if (!this.cursor) return;
    if (this.stream !== this.cursor.stream) {
        this.cursor = ansi(this.stream, {enabled: colorEnabled});
    }

    style = style || {};
    if (style.fg) this.cursor.fg[style.fg]();
    if (style.bg) this.cursor.bg[style.bg]();
    if (style.bold) this.cursor.bold();
    if (style.underline) this.cursor.underline();
    if (style.inverse) this.cursor.inverse();
    if (style.beep) this.cursor.beep();
    this.cursor.write(msg).reset();
};

logger.addLevel = function (lvl, n, style, disp) {
    if (disp === false) disp = null;
    else if (!disp) disp = lvl.toUpperCase();

    this.levels[lvl] = n;
    this.style[lvl] = style;
    if (!this[lvl]) this[lvl] = function () {
        var a = new Array(arguments.length + 1);
        a[0] = lvl;
        for (var i = 0; i < arguments.length; i++) {
            a[i + 1] = arguments[i];
        }
        return this._log.apply(this, a);
    }.bind(this);
    this.disp[lvl] = disp;
};

logger.prefixStyle = {fg: 'magenta'};
logger.headingStyle = {fg: 'white', bg: 'black'};

logger.style = {};
logger.levels = {};
logger.disp = {};
logger.addLevel('silly', -Infinity, {inverse: true}, 'sill');
logger.addLevel('verbose', 1000, {fg: 'blue', bg: 'black'}, 'verb');
logger.addLevel('log', 2000, {}, false);
logger.addLevel('info', 3000, {fg: 'green'});
logger.addLevel('warn', 4000, {fg: 'black', bg: 'yellow'}, 'WARN');
logger.addLevel('error', 5000, {fg: 'red', bg: 'black'}, 'ERR');
logger.addLevel('silent', Infinity);

var _logs = {};
function getLog(prefix) {
    prefix = prefix || '';
    if (_logs[prefix]) return _logs[prefix];

    var log = _logs[prefix] = {};
    var levels = Object.keys(logger.levels);
    levels.forEach(function (level) {
        log[level] = function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(prefix);
            logger[level].apply(logger, args);
        };
    });
    return log;
}

function setLevel(level) {
    if (level) logger.level = level.toLowerCase();
}

module.exports = {
    logger: logger,
    setLevel: setLevel,
    default: getLog(),
    get: getLog
};
