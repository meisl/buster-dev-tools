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
    var depKinds = [
         { l: "dependencies", s: "normal" }
        ,{ l: "devDependencies", s: "dev" }
        ,{ l: "optionalDependencies", s: "opt"}
    ];
    var depCount = {}; // overall stats
    var allProjects = { // keep our own internal hash of ALL the projects; what's in here has .vertex initialized
        __toArray: function(f) {
            var result = [];
            for(var name in allProjects) {
                var p = allProjects[name];
                if (p !== allProjects.__toArray) result.push(p);
            }
            return result;
        }
    };
    var init = function(projects, project, done) {
        if (dotString) { // FIXME: dirty hack, see function build(..) below
            throw new Error("dependencyGraph.init(..) must not be called twice!");
        }
        function initVertex(projectName, version) {
            var project = allProjects[projectName];
            if (!project) {
                if (isInternalProject(projects, projectName)) {
                    project = getProject(projectName);
                    project.isInternal = true;
                    project.version = version;
                } else {
                    project = { name: projectName, isInternal: false, version: version };
                }
                project.vertex = {
                    project: project,
                    dotId: projectName, // TODO: add version nr
                    inEdges: [],
                    outEdges: [],
                    getPathFrom: function(v) {
                        return null;
                    },
                    getDotDef: function() {
                        return this.dotId + '['
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
        depKinds.forEach(function (depKind) {
            depCount[depKind.s] = depCount[depKind.s] || 0; // init if necessary
            if (!(depKind.l in pkg)) return;
            for (var childName in pkg[depKind.l]) {
                depCount[depKind.s]++;
                var child = initVertex(childName, pkg[depKind.l][childName]);
//                console.log(depKind.s + ': ' + v.dotId + ' -> ' + child.dotId);
            }
        });
        done();
    };
    init.label = "Initializing dependency graph";

    var dotString = null;
    var build = function(projects, project, done) { // FIXME: this is really a "reduce" step over allProjects, but to comply with this cps style...
        if (dotString) return done(); // ...I'm using this dirty trick of checking the local dotString 8-}
        // TODO: pattern should rather be internalProjects.selectMany(p => pAndAllItsDeps).distinct().reduceToDotGraph();
        // really it's one big aggregate: projects.aggregate( {} /* empty allProjects */, (acc, p) => acc.union( pAndAllItsDeps ), acc => makeDotGraph(acc) );
        console.log();
        var dotLines = ['digraph "busterjs dependencies" {'
            ,'label="\\G' 
                + ':\\n' + depKinds.map(function(dk) { return depCount[dk.s] + ' ' + dk.s; }).join(', ')
                + '";'
            , 'labelloc="t";'
            , 'concentrate=false;'
            , 'fontname="Arial";'
            , 'fontsize=42;'
        /*
            , 'rotate=90;'
            , 'layout="fdp";'
            , 'K=2;'
            , 'maxIter=100;'
            , 'start=random;'
        */
            , 'size="12.61,10.27";'
            , 'ratio=fill;'

            // how much effort to put into node placement and edge-crossing minimization:
            , 'nslimit=100.0;'
            , 'mclimit=16.0;'

            // default node and edge attributes:
            , 'node [height=1,fontsize=32,fontname=Arial,shape=box,style="filled",fillcolor="lightgray",color="black"];'
            , 'edge [arrowsize=2.5];'

        ];
        dotLines = dotLines.concat( allProjects.__toArray()
            //.filter(function(p) { return p.isInternal; }) // maybe only internals?
            .map(function(p) { return p.vertex.getDotDef(); })
        );
        dotString = dotLines.join('\n    ') + '\n}\n';
        console.log(dotString);
        return; // just run once, do NOT call done()
    };
    build.label = "Visualizing dependency graph";
    return { init: init, build: build };
})();


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