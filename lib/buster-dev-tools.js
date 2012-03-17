var CWD = process.cwd();
var path = require("path");
var cp = require("child_process");
var util = require("util");
var fs = require("fs");
var http = require("http");

function doOperations(projects, operations) {
    if (operations.length == 0) return;

    projects = projects.map(function (project) {
        return getProject(project);
    });

    util.print(operations[0].label + ": ");
    doOperationsIter(projects, operations, 0);
}

function doOperationsIter(projects, operations, i, done) {
    if (i == projects.length) {
        util.print("\n");
        return doOperations(projects, operations.slice(1));
    }

    operations[0](projects, projects[i], function () {
        util.print(".");
        doOperationsIter(projects, operations, i + 1, done);
    });
}

function clone (projects, project, done) {
    var cmd = "git clone "
        + quote(project.gitUrl) + " "
        + quote(project.localPath);
    cp.exec(cmd, function (err, stdout, stderr) {
        if (err) throw err;
        done();
    });
}
clone.label = "Cloning repositories";

function pull (projects, project, done) {
    done();
}
pull.label = "Pulling repositories";

function installDeps (projects, project, done) {
    var pkgJsonPath = path.join(project.localPath, "package.json");
    var pkg = require(pkgJsonPath);
    var deps = [];

    // Deliberately not installing optional dependencies
    ["dependencies",
     "devDependencies"].forEach(function (prop) {
        if (!(prop in pkg)) return;
        for (var dep in pkg[prop]) {
            if (isInternalProject(projects, dep)) continue;
            if (process.platform == "win32") { // workarounds for Windows
                if (dep == "faye") continue; // T
                if ((project.name == "buster-html-doc") && (dep == "jsdom")) {  // FIXME: bad hack, should be specified in project-list.js
                    //downloadAndUnzipAsIs("github.com", "/downloads/meisl/buster-dev-tools/contextify-for-buster-dev-tools-on-Windows.zip");
                    downloadAndUnzipAsIs("cloud.github.com", "/downloads/meisl/buster-dev-tools/contextify-for-buster-dev-tools-on-Windows.zip");
                }
            }
            deps = deps.concat(dep + "@" + pkg[prop][dep]);
        }
    });

    if (deps.length == 0) return done();

    var cmd = "npm install " + deps.join(" ");
    cp.exec(cmd, {cwd: project.localPath}, function (err, stdout, stderr) {
        if (err) throw err;
        done();
    });
}
installDeps.label = "Installing non-buster deps";

function submodules (projects, project, done) {
    var cmd = "git submodule update --init";
    cp.exec(cmd, {cwd: project.localPath}, function (err, stdout, stderr) {
        if (err) throw err;
        done();
    });
}
submodules.label = "Updating git submodules";

function getProject (project) {
    if (typeof project == "string") {
        project = {
            name: project,
            gitUrl: "https://github.com/busterjs/" + project + ".git"
        };
    }

    project.localPath = path.join(CWD, project.name);
    return project;
}

function quote (path) {
    return '"' + path + '"';
}

function isInternalProject (projects, projectName) {
    return projects.some(function (p) {
        return p.name === projectName;
    });
}

function downloadAndUnzipAsIs(host, path) {
    var outStream = fs.createWriteStream("temp.zip"); // TODO: extract extension from path, check for file already being there
    http.get({ host: host, path: path }, function(res) {
      console.log("statusCode: ", res.statusCode);
      console.log("headers: ", res.headers);

      res.on('data', function(d) {
        console.log("got " + d.length + " bytes...");
        outStream.write(d);
      });
      res.on('end', function() {
        console.log('done downloading "http://' + host + path + '"');
        outStream.end();
      });

    }).on('error', function(e) {
      throw e;
    });
}

module.exports = {
    doOperations: doOperations,
    clone: clone,
    pull: pull,
    installDeps: installDeps,
    submodules: submodules
}