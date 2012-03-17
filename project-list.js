var projects = [
    {name: "buster-evented-logger", gitUrl: "https://github.com/meisl/buster-evented-logger.git", branch: "abandon_git_submodules"},
    {name: "buster-capture-server", gitUrl: "https://github.com/meisl/buster-capture-server.git", branch: "abandon_git_submodules"}
/*

    "buster-core",
    "buster-assertions",

    "buster-format",
    "buster-jstestdriver",

    {name: "sinon", gitUrl: "https://github.com/cjohansen/Sinon.JS.git"},
    "buster-util",
    "buster-user-agent-parser",
    "buster-terminal",
    "buster-analyzer",
    "buster-syntax",
    "buster-test",
    "sinon-buster",
    "buster-glob",
    "buster-resources",
    "buster-bayeux-emitter",
    "buster-configuration",
    "buster-client",
    "buster-args",
    "buster-stdio-logger",
    "buster-cli",
    "buster-test-cli",
    "buster-static",
    "buster",
    "buster-html-doc"
*/
];

try { projects = require("./local").concat(projects) } catch(e){};

module.exports = projects;
