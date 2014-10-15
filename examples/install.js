"use strict";

require("../lib/cli")(['install', 'taoyuan/npd-test'], function (err) {
    if (err) {
        console.err(err);
        process.exit(1);
    }
});