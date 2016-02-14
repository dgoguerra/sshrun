## sshrun

Utility to run a script remotely through SSH. Internally uses the node.js SSH implementation [SSH2](https://github.com/mscdex/ssh2).

### Installation

```bash
npm install -g sshrun
which sshrun # /usr/local/bin/sshrun
```

### Usage

```bash
$ cat hello.sh
#!/bin/bash
echo "hello world! I'm $(whoami) on $(hostname)."

$ sshrun -i /path/to/key hello.sh ubuntu@example.com:2222'
hello world! I'm ubuntu on example.com.
```

Alternatively, the module can be used directly within node.js.

```js
var sshrun = require('sshrun');

var host = { user: 'ubuntu', host: 'example.com', port: 2222 },
    opts = { identity: '/path/to/key' };

// optional callback called when the script process starts to run.
opts.progress = function(proc) {
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
};

// tell sshrun to not capture any script output in procInfo, for performance
// reasons. Useful to use together with the progress() handler to do any
// custom manipulation to stdout and stderr.
opts.captureOutput = false;

sshrun('/path/to/hello.sh', host, opts, function(err, procInfo) {
    if (err) return console.log(err);

    // procInfo contains some info and the output of the
    // process which ran the script

    console.log('exit code: ' + procInfo.code);

    // buffered stdout and stderr line by line, unless captureOutput == false
    console.log(procInfo.stdout.join(''));
    console.error(procInfo.stderr.join(''));

    // stdout and stderr mixed in order, unless captureOutput == false
    console.log(procInfo.output.join(''));
});

```

### License

MIT license - http://www.opensource.org/licenses/mit-license.php
