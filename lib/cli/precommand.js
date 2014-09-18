"use strict";

var util = require('util');

module.exports = function (info, req, next) {
    var args = info.args;
    var usage = info.cmd.usage();
    var definedArgs = usage.split(/ +/);
    var parsedArgs = parseExpectedArgs(definedArgs);
    info.params = {};
    parsedArgs && parsedArgs.forEach(function(arg, i){
        if (arg.required && null == args[i]) {
            throw new Error(util.format("missing required argument `%s`", arg.name));
        }
        info.params[arg.name] = args[i];
    });
    next();
};

function parseExpectedArgs(args){
    if (!args.length) return;
    var parsed = [];
    args.forEach(function(arg){
        switch (arg[0]) {
            case '<':
                parsed.push({ required: true, name: arg.slice(1, -1) });
                break;
            case '[':
                parsed.push({ required: false, name: arg.slice(1, -1) });
                break;
        }
    });
    return parsed;
}