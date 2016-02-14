var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    q = require('q'),
    _ = require('lodash'),
    split = require('split'),
    ssh2auth = require('ssh2-auth'),
    libdebug = require('debug')('sshrun');

function promisifyProcess(proc, opts) {
    var procInfo = {
        process: proc,
        options: opts,
        stdout: [],
        stderr: [],
        output: []
    };

    if (opts.captureOutput) {
        proc.stdout.pipe(split()).on('data', function(line) {
            procInfo.stdout.push(line);
            procInfo.output.push(line);
        });

        proc.stderr.pipe(split()).on('data', function(line) {
            procInfo.stderr.push(line);
            procInfo.output.push(line);
        });
    }

    var deferred = q.defer();

    proc.on('close', function(code, signal) {
        procInfo.code = code;
        procInfo.signal = signal;
        deferred.resolve(procInfo);
    });

    return deferred.promise;
}

function connectToHost(connOpts, opts) {
    var deferred = q.defer();

    if (typeof connOpts === 'string')
        connOpts = { host: connOpts };

    if (opts.identity) {
        connOpts.privateKey = opts.identity;
    }

    if (opts.password) {
        connOpts.password = opts.password;
    }

    ssh2auth(connOpts, function(err, conn) {
        if (err) return deferred.reject(err);
        deferred.resolve(conn);
    });

    return deferred.promise;
}

function copyToHost(conn, opts, localPath, remotePath) {
    var deferred = q.defer();

    libdebug('copying %s to remote host on %s ...', localPath, remotePath);

    conn.sftp(function(err, sftp) {
        if (err) return deferred.reject(err);

        var localStream = fs.createReadStream(localPath),
            remoteStream = sftp.createWriteStream(remotePath);

        remoteStream.on('error', function(errr) {
            deferred.reject(err);
        });
        remoteStream.on('finish', function() {
            deferred.resolve();
        });

        localStream.pipe(remoteStream);
    });

    return deferred.promise;
}

function runInHost(conn, opts, remotePath) {
    var deferred = q.defer();

    libdebug('running %s ...', remotePath);

    conn.exec('sh '+remotePath, function(err, proc) {
        if (err) return deferred.reject(err);

        opts.progress && opts.progress(proc);

        promisifyProcess(proc, {captureOutput: opts.captureOutput}).then(function(procInfo) {
            deferred.resolve(procInfo);
        });
    });

    return deferred.promise;
}

function removeFromHost(conn, opts, remotePath) {
    var deferred = q.defer();

    libdebug('removing %s ...', remotePath);

    conn.sftp(function(err, sftp) {
        if (err) return deferred.reject(err);

        sftp.unlink(remotePath, function(err) {
            if (err) return deferred.reject(err);
            deferred.resolve();
        });
    });

    return deferred.promise;
}

module.exports = function(scriptPath, host, userOpts, callback) {
    // if there are only 3 arguments, then there are no userOpts
    if (!callback) {
        callback = userOpts;
        userOpts = {};
    }

    // default available options
    var dflOptions = {
        // private key location. Can be an array to send multiple keys. Set to false
        // to let ssh try the default keys.
        identity: null,
        // provide a password directly.
        password: null,
        // remote temporary directory to upload the script to run.
        remoteDir: '/tmp'
    };

    var opts = _.extend({}, dflOptions, userOpts),
        hash = crypto.randomBytes(10).toString('hex'),
        remotePath = path.join(opts.remoteDir, 'sshrun-'+hash+'.sh'),
        scriptProcInfo = {};

    connectToHost(host, opts).then(function(conn) {
        return copyToHost(conn, opts, scriptPath, remotePath)
            .then(function() {
                return runInHost(conn, opts, remotePath);
            }).then(function(procInfo) {
                scriptProcInfo = procInfo;
                return removeFromHost(conn, opts, remotePath);
            }).then(function() {
                // everything went well, close the connection and return control
                // to the user.
                conn.end();
                callback && callback(null, scriptProcInfo);
            }).catch(function(err) {
                // an error during an action in the SSH connection, close the
                // connection and bubble up the error to the general catch().
                conn.end();
                return q.reject(err);
            });
    }).catch(function(err) {
        // there was an error somewhere, inform the user.
        libdebug(err);
        callback && callback(err);
    });
};
