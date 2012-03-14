var projects = [
    "buster",
    "buster-core",
    "buster-test",
    "buster-assertions",
    "buster-format",
    "buster-evented-logger",
    "buster-test-cli",
    {name: "sinon", gitUrl: "https://github.com/cjohansen/Sinon.JS.git"},
    "sinon-buster",
    "buster-static",
    "buster-util",
    "buster-terminal",
    "buster-client",
    "buster-cli",
    "buster-configuration",
    "buster-capture-server",
    "buster-args",
    "buster-analyzer",
    "buster-syntax",
    "buster-user-agent-parser",
    "buster-bayeux-emitter",
    "buster-resources",
    "buster-stdio-logger",
    "buster-glob",
    "buster-jstestdriver",
    "buster-html-doc"
];

try { projects = require("./local").concat(projects) } catch(e){};

module.exports = projects;
