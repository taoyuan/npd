#! /usr/bin/env node

require("../lib/cli")(process.argv.slice(2), function(err) {
    if (err) {
        console.err(err);
        process.exit(1);
    }
});