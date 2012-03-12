var cp = require("child_process");
var path = require("path");
var fs = require("fs");

var ERROR_CODE_CMD_NOT_FOUND = 1;

if (process.platform != "win32") { // what about win64 ?!
    throw new Error("this is a workaround for windows only, please use npm link instead");
}
var args = process.argv.slice(2);
var optIdx;
if ((optIdx = args.indexOf('-g') >= 0) || (optIdx = args.indexOf('--global') >= 0)) {
    // TODO: find out about -g option for npm link
    throw new Error("Does npm link have a -g option? I don't know...");
}
if (args.length == 0) {
    cp.exec('npm root -g', function(err, stdout, stderr) {
        if (err) rethrow(err, stdout, stderr);
        var npmRoot = stdout.substring(0, stdout.length-1);   // TODO: really ever only one \n on stdout??!
        npmRoot += "\\";
        debugger;
        var cwd = process.cwd();
        var moduleName = path.basename(cwd);
        var link = npmRoot + moduleName;
        var whereLinkPointsTo = cwd;
        if (path.existsSync(link)) {
            console.log("skipped npm-linking " + moduleName + ", already exists in " + npmRoot);
        } else {
            var cmdSuffix = quote(link) + " " + quote(whereLinkPointsTo);
            var cmdJ = "junction.exe " + cmdSuffix; // for XP
            var cmdM = "mklink /D " + cmdSuffix; // built into Vista and later
            cp.exec(cmdM, function(err, stdout, stderr) {
                if(err) {
                    if (err.code == ERROR_CODE_CMD_NOT_FOUND) {
                        // so we're probably on XP, let's try junction.exe then:
                        cp.exec(cmdJ, function(err, stdout, stderr) {
                            if (err) {
                                if (err.code == ERROR_CODE_CMD_NOT_FOUND) {
                                    throw new Error(cmdJ + " not found, get it from http://technet.microsoft.com/en-us/sysinternals/bb896768");
                                } else {
                                    rethrow(err, stdout, stderr);
                                }
                            }
                        });
                    } else {
                        rethrow(err, stdout, stderr);
                    }
                }
            });
        }
        // FIXME: for now we just skip where npm install croaks:
        if ((cwd != "buster-syntax") // jsdom (contextify)
            && (cwd != "buster-test") // jsdom (contextify)
            && (cwd != "buster-html-doc") // jsdom (contextify)
            && (cwd != "buster-bayeux-emitter") // faye (redis)
         ) {
            cp.exec("npm install", function(err, stdout, stderr) {
                if (err) rethrow(err, stdout, stderr);
            });
         }
    });
} else {
    throw new Error("Windows replacement for  npm link <package-name>  is not implemented");
}

// TODO: remove duplication (it's in functions.js, too)
function symlinkExists(path) {
    var stat;
    try {
        stat = fs.lstatSync(path);
    } catch(e) {
        return false;
    }

    if (stat.isSymbolicLink()) {
        return true;
    } else {
        throw new Error("Expected '" + path + "' to be a symlink.");
    }
}

// TODO: remove duplication (it's in functions.js, too)
function rethrow(error, stdout, stderr, additionalMessage) {
    if (additionalMessage) {
        console.error(additionalMessage);
    }
    console.error(stdout); // let's push out all, maybe it'll give us a hint what went wrong
    console.error(stderr);
    console.error("error.code: " + error.code);
    throw error;
}

// TODO: remove duplication (it's in functions.js, too)
function quote(path) {
    return '"' + path + '"';
}