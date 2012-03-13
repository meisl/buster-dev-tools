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
            if (dep == "faye") continue;
            //if (dep == "jsdom") continue;
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
    var defaultEdgeColor = 'black';
    var cycleEdgeColor = 'red';
    var kinds2EdgeColors = {
        normal: defaultEdgeColor, // TODO: tie property names to depKinds .s values
        dev: 'blue',
        opt: 'green'
    };
    var allProjects = { // keep our own internal hash of ALL the projects; what's in here has .vertex initialized
        __toArray: function(f) {
            var result = [];
            for(var name in this) {
                var p = this[name];
                if (p !== this.__toArray) result.push(p);
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
                    project.version = version;  // TODO: there might be multiple versions, coming from deps - clean that up
                } else {
                    project = { name: projectName, isInternal: false, version: version };  // TODO: there might be multiple versions, coming from deps - clean that up
                }
                project.vertex = {
                     project: project
                    ,dotId: projectName.replace(/[-.]/g, '_') // TODO: add version nr
                    ,inEdges: {
                        __toArray: function(f) { // TODO: remove code duplication
                            var result = [];
                            for(var name in this) {
                                var p = this[name];
                                if (p !== this.__toArray) result.push(p);
                            }
                            return result;
                        }
                    }
                    ,outEdges: {
                        __toArray: function(f) { // TODO: remove code duplication
                            var result = [];
                            for(var name in this) {
                                var p = this[name];
                                if (p !== this.__toArray) result.push(p);
                            }
                            return result;
                        }
                    }
                    ,getDotDef: function() {
                        return this.dotId + '['
                            + 'label="' + this.project.name + '\\n' + this.project.version + '"'
                            + ',fillcolor=' + (this.project.isInternal ? 'cyan' : 'lightgray')
                            //+ ',URL="' + pkg.repository.url + '"'
                            //+ ',target="_graphviz"'
                            //+ ',tooltip=""'
                        +'];';
                        ;
                    }
                    ,parents:  function() { return  this.inEdges.__toArray().map(function(e) { return e.from; }); }
                    ,children: function() { return this.outEdges.__toArray().map(function(e) { return e.to;   }); }
                    // Depth-first search, returns an array of edges where a.to === b.from for each pair of consecutive edges a and b.
                    // If indeed a path exists, the first edge's .from will be === vertex and the last edge's .to will be === this.
                    // If no path from this to vertex exists null is returned.
                    ,dfsPathFrom: function(vertex, visited) {
                        var path;
                        visited = visited || {};
                        if (!visited[this.dotId]) {
                            visited[this.dotId] = true;
                            if (vertex == this) {
                                return [this.dotId];
                            } else {
                                var parents = this.parents();
                                for (var parentIdx = 0, parentCount = parents.length; parentIdx < parentCount; parentIdx++) {
                                    var parent = parents[parentIdx];
                                    if (path = parent.dfsPathFrom(vertex, visited)) {
                                        path.push(this.inEdges[parent.dotId]);
                                        return path;
                                    }
                                }
                            }
                        }
                        return null;
                    }
                    ,isCycleCompletion: false
                    ,addEdgeTo: function(target, kind) {
                        if (!(typeof kind == 'string') || (kind == ''))
                            throw new Error('invalid edge kind "' + kind + '"!');
                        var outEdge  = this.outEdges[target.dotId]
                           ,isNew = !outEdge
                        ;
                        if (isNew) {
                            target.inEdges[this.dotId] = this.outEdges[target.dotId] = outEdge = {
                                 from: this
                                ,to: target
                                ,kinds: {}
                                ,kindsMap: function(f) {
                                    var result = [];
                                    for(var kindName in this.kinds) { // TODO: remove code duplication
                                        debugger;
                                        var multiplicity = this.kinds[kindName];
                                        result.push(f(kindName, multiplicity, this.isCycleCompletion)); // TODO: isCycleCompletion, maybe have this even specific to kindName?
                                    }
                                    return result;
                                }
                            };
                        };
                        outEdge.isCycleCompletion |= this.dfsPathFrom(target) ? true : false; // aargh! but it really should be boolean...
                        outEdge.kinds[kind] = (outEdge.kinds[kind] || 0) + 1;
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
                v.addEdgeTo(child, depKind.s);
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
        var dotOutExt = 'svg';
        var outFileName = 'buster-dependencies_all' + '.' + dotOutExt;
        var dotOptions = ['-T' + dotOutExt, '-o' + outFileName];
        var dotCommand = 'dot';
        var dot = cp.spawn(dotCommand, dotOptions);
        var dotStdOut = '', dotStdErr = '';
        dot.stdout.on('data', function(data) {
            dotStdOut += data;
        });
        dot.stderr.on('data', function(data) {
            dotStdErr += data;
        });
        dot.on('exit', function(errorCode, signal) {
            var completeDotCommand = '"' + dotCommand + ' ' + dotOptions.join(' ') + '"';
            if (errorCode) {
                if (dotStdOut) console.log('--- STDOUT of ' + completeDotCommand + ': ---\n' + dotStdOut);
                if (dotStdErr) console.log('--- STDERR of ' + completeDotCommand + ': ---\n' + dotStdErr);
                console.log('--- input to ' + completeDotCommand + ' on its STDIN: ---\n <NOT IMPLEMENTED, sorry>');
                throw new Error('executing ' + completeDotCommand + ' yielded error ' + errorCode);
            }
            console.log('created graph file ' + outFileName + '.');
            cp.exec(outFileName); // invoke browser when finished
        });
        var ttlCycleCount = allProjects.__toArray()
            .map(function(p) { // I WANT selectMany!
                return p.vertex.outEdges.__toArray()
                    .reduce(function(acc, edge) {
                        return acc + (edge.isCycleCompletion ? 1 : 0);
                    }, 0)
                ;
            })
            .reduce(function(acc, n) { return acc + n; }, 0)
        ;
        var ttlProjectsCount = allProjects.__toArray().length;
        var internalProjectsCount = allProjects.__toArray().filter(function(p) { return p.isInternal; } ).length; // TODO: where the hell is .count(..)?!
        var externalProjectsCount = ttlProjectsCount - internalProjectsCount;
        var dotLines = ['digraph "busterjs dependencies" {'
            ,'label="BUSTERJS' 
                + '\\nprojects: ' + ttlProjectsCount + ', thereof ' + internalProjectsCount + ' internal and ' + externalProjectsCount + ' external (direct deps only)'
                + '\\ndependencies: ' + depKinds.map(function(kind) { return depCount[kind.s] + ' ' + kind.s + ' (' + kinds2EdgeColors[kind.s] + ')'; }).join(', ')
                    + ', ' + (ttlCycleCount ? ttlCycleCount + ' CYCLIC (' + cycleEdgeColor + '-ish)!!' : 'no cycles.')
                + '";'
            , 'labelloc="t";'
            , 'concentrate=false;' // do not join edge splines
            , 'fontname="Arial";'
            , 'fontsize=42;'
        /*
            , 'layout="fdp";'
            , 'rotate=90;'
            , 'K=2;'
            , 'maxIter=100;'
            , 'start=random;'
        */
            , 'size="12.61,7.27";'
            , 'ratio=fill;'

            // how much effort to put into node placement and edge-crossing minimization:
            , 'nslimit=100.0;'
            , 'mclimit=16.0;'

            // default node and edge attributes:
            , 'node [height=1,fontsize=32,fontname=Arial,shape=box,style="filled",fillcolor="lightgray",color="black"];'
            , 'edge [arrowsize=2.5,color=' + defaultEdgeColor + '];'

        ];
        var nl = '\n    ';
        var filter = function(p) { return p.isInternal || true; }; // set constant to false to get only internals
        dotString = dotLines
            .concat( allProjects.__toArray().filter(filter)
                .map(function(p) { return p.vertex.getDotDef(); })
            )
            .concat( allProjects.__toArray().filter(filter)
                .map(function(p) { 
                    return p.vertex.inEdges.__toArray() // wish there was a selectMany, or at least flatten
                        .map(function(edge) {
                            var raw = edge.from.dotId + ' -> ' + edge.to.dotId;
                            var result = edge.kindsMap(function(kind, multiplicity, isCycleCompletion) {
                                var props = [];
                                var color = kinds2EdgeColors[kind] || defaultEdgeColor;
                                if (isCycleCompletion) {
                                    color = '"' + color + ':' + cycleEdgeColor + ':' + cycleEdgeColor + ':' + color + '"';
                                    props.push('weight=0'); // do graph layout as if this nasty edge wasn't there
                                    props.push('constraint=false'); // do not use it to affect node ranking either
                                }
                                if (color && (color != defaultEdgeColor)) props.push('color=' + color);
                                return raw + (props.length > 0 ? '[' + props.join(',') + ']' : '') + ';';
                            })
                            .join(nl);
                            return result;
                        })
                        .join(nl)
                    ;
                })
            )
            .join(nl) + '\n}\n'
        ;
        dot.stdin.end(dotString);
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