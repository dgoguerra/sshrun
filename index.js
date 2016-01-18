#!/usr/bin/env node

var _ = require('lodash'),
    path = require('path'),
    crypto = require('crypto'),
    mkdirp = require('mkdirp'),
    readline = require('readline'),
    Promise = require('bluebird'),
    chalk = require('chalk'),
    debug = require('debug')('lib'),
    spawn = require('child_process').spawn;

function onLine(stream, callback) {
    var rl = readline.createInterface({
        input: stream,
        terminal: false
    });

    rl.on('line', function(line) {
        callback(line);
    });
}

function identitiesArgsArr(identityPaths) {
    if (!identityPaths) return [];

    var idents = Array.isArray(identityPaths)
        ? identityPaths : [ identityPaths ];

    var params = [];
    idents.forEach(function(ident) {
        params = params.concat(['-i', ident]);
    });

    return params;
}

function scp(opts, srcHost, dstHost) {
    var params = [];

    if (opts.identity) {
        params = params.concat(identitiesArgsArr(opts.identity));
    }

    if (opts.multiplexed) {
        params = params.concat(['-S', opts.multiplexed]);
    }

    params = params.concat([srcHost, dstHost]);

    debug(chalk.bold.green('scp %s'), params.join(' '));

    var proc = spawn('scp', params);

    if (debug.enabled) {
        onLine(proc.stdout, function(l) { debug(chalk.green(l)); });
        onLine(proc.stderr, function(l) { debug(chalk.red(l)); });
    }

    return proc;
}

function ssh(opts, host, cmd) {
    var params = [];

    if (opts.identity) {
        params = params.concat(identitiesArgsArr(opts.identity));
    }

    if (opts.multiplexed) {
        params = params.concat(['-S', opts.multiplexed]);
    }

    params = params.concat([host, cmd]);

    debug(chalk.bold.green('ssh %s'), params.join(' '));

    var proc = spawn('ssh', params);

    if (debug.enabled) {
        onLine(proc.stdout, function(l) { debug(chalk.green(l)); });
        onLine(proc.stderr, function(l) { debug(chalk.red(l)); });
    }

    return proc;
}

module.exports = function(scriptPath, host, userOpts, callback) {
    // if there are only 3 arguments, then there are no userOpts
    if (!callback) {
        callback = userOpts;
        userOpts = {};
    }

    var opts = _.extend({}, {
        identity: false,
        multiplexed: false,
        remoteDir: '/tmp'
    }, userOpts);

    var hash = crypto.randomBytes(10).toString('hex'),
        remotePath = path.join(opts.remoteDir, 'sshrun-'+hash+'.sh');

    new Promise(function(resolve, reject) {
        var proc = scp(opts, scriptPath, host+':'+remotePath);

        var errors = [];
        onLine(proc.stderr, function(line) {
            errors.push(line);
        });

        proc.addListener('exit', function(code, signal) {
            if (code || signal) {
                errors.push('error: scp exited ('+(code || signal)+')');
                reject(errors);
            } else {
                resolve();
            }
        });
    }).then(function() {
        var command = 'sh '+remotePath+'; rm '+remotePath;
        var proc = ssh(opts, host, command);

        //proc.stdout.pipe(process.stdout);
        //proc.stderr.pipe(process.stderr);

        var output = [];
        onLine(proc.stdout, function(line) {
            output.push(line);
        });

        var errors = [];
        onLine(proc.stderr, function(line) {
            errors.push(line);
        });

        proc.addListener('exit', function(code, signal) {
            if (code || signal) {
                errors.push('error: ssh exited ('+(code || signal)+')');
                reject(errors);
            } else {
                callback(output);
            }
        });
    }).catch(function(err) {
        console.log(chalk.bold.red(err));
    });
};
