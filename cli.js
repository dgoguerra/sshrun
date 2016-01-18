#!/usr/bin/env node

var chalk = require('chalk'),
    minimist = require('minimist'),
    sshrun = require('./index.js');

var argv = minimist(process.argv.slice(2), {
    alias: {
        identity: ['i']
    }
});

var scriptPath = argv._[0],
    remoteHost = argv._[1],
    opts = {};

if (argv.identity) {
    opts.identity = argv.identity;
}

sshrun(scriptPath, remoteHost, opts, function(lines) {
    console.log(chalk.green(lines.join('')));
});
