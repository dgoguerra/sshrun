#!/usr/bin/env node

var util = require('util'),
    Transform = require('stream').Transform,
    chalk = require('chalk'),
    minimist = require('minimist'),
    sshrun = require('./index.js');

var argv = minimist(process.argv.slice(2), {
    alias: {
        password: ['p'],
        identity: ['i']
    }
});


function usage() {
    console.log('usage: sshrun [-i identity_file] [-p password] script_path [user@]hostname[:port]');
}

if (argv._.length !== 2 || argv.help) {
    usage();
    process.exit();
}

var scriptPath = argv._[0],
    remoteHost = argv._[1],
    opts = {};

if (argv.identity) {
    opts.identity = argv.identity;
}

if (argv.password) {
    opts.password = argv.password;
}

util.inherits(ColorStream, Transform);

function ColorStream(color) {
    Transform.call(this);
    this.color = color;
}

ColorStream.prototype._transform = function(data, encoding, processed) {
    this.push(this.color(data));
    processed();
};

// optional callback run when the script process starts to run.
// We are using it to output the script's stdout and stderr,
// showing them in green and red, respectively.
opts.progress = function(proc) {
    proc.stdout.pipe(new ColorStream(chalk.green)).pipe(process.stdout);
    proc.stderr.pipe(new ColorStream(chalk.red)).pipe(process.stderr);
};

// tell sshrun to not capture any script output in procInfo, since its already
// being read on the progress() handler.
opts.captureOutput = false;

sshrun(scriptPath, remoteHost, opts, function(err, procInfo) {
    if (err) return console.log(chalk.bold.red(err));
});
