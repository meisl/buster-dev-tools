var CWD = process.cwd();
var path = require("path");
var cp = require("child_process");
var util = require("util");
var fs = require("fs");

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

var dependencyGraph = (function() {
    var depCount = {}; // overall stats
    var allProjects = {}; // keep our own internal hash of ALL the projects; what's in here has .vertex initialized
    return function(projects, project, done) {
        function initVertex(projectName, version) {
            var project = allProjects[projectName];
            if (!project) {
                //debugger;
                if (isInternalProject(projects, projectName)) {
                    project = getProject(projectName);
                    project.isInternal = true;
                    project.version = version;
                } else {
                    project = { name: projectName, isInternal: false, version: version };
                }
                project.vertex = {
                    project: project,
                    dotId: projectName + '@' + project.version, // TODO: add version nr
                    inEdges: [],
                    outEdges: [],
                    getPathFrom: function(v) {
                        return null;
                    },
                    getDotDef: function() {
                        return "    "
                            + this.dotId + '['
                            + 'label="' + this.project.name + '\\n' + this.project.version + '"'
                            + ',fillcolor=' + (this.project.isInternal ? 'cyan' : 'lightgray')
                            //+ ',URL="' + pkg.repository.url + '"'
                            //+ ',target="_graphviz"'
                            //+ ',tooltip=""'
                        +'];';
                        ;
                    }
                };
                allProjects[projectName] = project;
            }
            return project.vertex;
        }
        var pkgJsonPath = path.join(project.localPath, "package.json");
        var pkg = require(pkgJsonPath);
        var v = initVertex(project.name, pkg.version);
        //console.log(project.name + "  ----------------------------------------------");
        var depKinds = [
             "dependencies",
             "devDependencies",
             "optionalDependencies"
        ];
        depKinds.forEach(function (depKind) {
            depCount[depKind] = depCount[depKind] || 0; // init if necessary
            if (!(depKind in pkg)) return;
            for (var childName in pkg[depKind]) {
                depCount[depKind]++;
                var child = initVertex(childName, pkg[depKind][childName]);
                console.log(depKind + ': ' + v.dotId + ' -> ' + child.dotId);
            }
        });
        console.log("---------------------");
        depKinds.forEach(function (depKind) {
            console.log(depKind, depCount[depKind]);
        });

        done();
    };
})();
dependencyGraph.label = "Creating dependency graph"

function getProject (project) {
    if (typeof project == "string") {
        project = {
            name: project,
            gitUrl: "git://github.com/busterjs/" + project + ".git"
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

module.exports = {
    doOperations: doOperations,
    clone: clone,
    pull: pull,
    installDeps: installDeps,
    submodules: submodules,
    dependencyGraph: dependencyGraph
}