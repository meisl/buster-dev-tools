var cp = require("child_process");
var path = require("path");
var fs = require("fs");

var ERROR_CODE_CMD_NOT_FOUND = 1;

if (process.platform != "win32") { // what about win64 ?!
    throw new Error("this is a workaround for windows only, please use npm link instead");
}
var arg = process.argv[2];
var nodePath = process.env["NODE_PATH"];
if (!nodePath) {
    nodePath = process.env["APPDATA"] + "\\npm\\node_modules";
    console.log("no NODE_PATH in environment, using " + quote(nodePath) + " instead.");
}
nodePath += "\\";
if (!arg) {
    var cwd = process.cwd();
    var moduleName = path.basename(cwd);
    var link = nodePath + moduleName;
    var whereLinkPointsTo = cwd;
    if (path.existsSync(link)) {
        console.log("skipped npm-linking " + moduleName + ", already exists in " + nodePath);
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
    if ((project.name != "buster-syntax") // jsdom (contextify)
        && (project.name != "buster-test") // jsdom (contextify)
        && (project.name != "buster-html-doc") // jsdom (contextify)
        && (project.name != "buster-bayeux-emitter") // faye (redis)
     ) {
        cp.exec("npm install", function(err, stdout, stderr) {
            if (err) rethrow(err, stdout, stderr);
        });
     }
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