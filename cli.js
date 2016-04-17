#!/usr/bin/env node

var util = require('util'),
    Transform = require('stream').Transform,
    chalk = require('chalk'),
    minimist = require('minimist'),
    sshrun = require('./index.js');

util.inherits(WrapperStream, Transform);

function WrapperStream(color) {
    Transform.call(this);
    this.color = color;
}

WrapperStream.prototype._transform = function(data, encoding, processed) {
    this.push(this.color(data));
    processed();
};

var argv = minimist(process.argv.slice(2), {
    '--': true,
    alias: {
        password: ['p'],
        identity: ['i']
    }
});

function usage() {
    console.log('usage: sshrun [-i identity_file] [-p password] [user@]hostname[:port] -- [script_path] [script_opts]');
}

var remoteHost = argv['_'] && argv['_'].length && argv['_'][0],
    scriptPath = argv['--'] && argv['--'].length && argv['--'][0];

if (argv.help || !remoteHost || !scriptPath) {
    usage();
    process.exit();
}

var opts = {
    // arguments to pass to the script
    args: argv['--'].slice(1),
    // host in which to run the script
    host: remoteHost,
    // optional callback run when the script process starts to run.
    // We are using it to output the script's stdout and stderr,
    // showing them in green and red, respectively
    progress: function(proc) {
        proc.stdout.pipe(new WrapperStream(chalk.green)).pipe(process.stdout);
        proc.stderr.pipe(new WrapperStream(chalk.red)).pipe(process.stderr);
    },
    // tell sshrun to not capture any script output in procInfo, since we are
    // already reading it in a custom way through the progress() handler
    // and don't need it at the end of the execution
    captureOutput: false
};

if (argv.identity) {
    opts.identity = argv.identity;
}

if (argv.password) {
    opts.password = argv.password;
}

sshrun(scriptPath, opts, function(err, procInfo) {
    if (err) return console.log(chalk.bold.red(err));
});
