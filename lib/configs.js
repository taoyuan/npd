"use strict";

var defaults = require('./defaults');

exports.load = load;

function load(argv) {
    return new Conf(require('rc')('sorb', defaults(), argv));
}

function Conf(base) {
    if (base && base instanceof Conf) {
        this.root = base.root;
    } else if (base) {
        this.root = base;
    } else {
        this.root = defaults();
    }
}

Conf.prototype.get = function (name) {
    return this.root[name];
};

Conf.prototype.set = function (name, value) {
    return new Error('Unsupported');
};