var projects = [
    {name: "buster-evented-logger", gitUrl: "https://github.com/meisl/buster-evented-logger.git", branch: "abandon_git_submodules"},
    {name: "buster-capture-server", gitUrl: "https://github.com/meisl/buster-capture-server.git", branch: "abandon_git_submodules"},

    {name: "buster-core",           gitUrl: "https://github.com/meisl/buster-core.git",           branch: "abandon_git_submodules"},
    {name: "buster-assertions",     gitUrl: "https://github.com/meisl/buster-assertions.git",     branch: "abandon_git_submodules"},

    {name: "buster-format",         gitUrl: "https://github.com/meisl/buster-format.git",         branch: "abandon_git_submodules"},
    {name: "buster-jstestdriver",   gitUrl: "https://github.com/meisl/buster-jstestdriver.git",   branch: "abandon_git_submodules"},

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
    "buster"
//   ,"buster-html-doc" // not really necessary; depends on contextify (through jsdom) which makes problems on Win
];

try { projects = require("./local").concat(projects) } catch(e){};

module.exports = projects;
