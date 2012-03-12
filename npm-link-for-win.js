var cp = require("child_process");
var path = require("path");

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
    var link = quote(nodePath + moduleName);
    var whereLinkPointsTo = quote(cwd);
    var cmdSuffix = link + " " + whereLinkPointsTo;
    var cmdJ = "junction " + cmdSuffix; // for XP
    var cmdM = "mklink /D " + cmdSuffix; // built into Vista and later
    cp.exec(cmdM, function(error, stdout, stderr) {
        if(error) {
            if (error.code == ERROR_CODE_CMD_NOT_FOUND) {
                // so we're probably on XP, let's try junction.exe then:
                cp.exec(cmdJ, function(error, stdout, stderr) {
                    if (error) {
                        if (error.code == ERROR_CODE_CMD_NOT_FOUND) {
                            throw new Error("junction.exe not found, get it from http://technet.microsoft.com/en-us/sysinternals/bb896768");
                        } else {
                            rethrow(error, stdin, stdout);
                        }
                    }
                });
            } else {
                rethrow(error, stdin, stdout);
            }
        }
    });
} else {
    throw new Error("Windows replacement for  npm link <package-name>  is not implemented");
}


function rethrow(error, stdin, stdout) {
    console.error(stdout); // let's push out all, maybe it'll give us a hint what went wrong
    console.error(stderr);
    console.error("error.code: " + error.code);
    throw error;
}

function quote(path) {
    return '"' + path + '"';
}