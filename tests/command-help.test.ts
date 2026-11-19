import { expect, spyOn, test } from "bun:test";
import { createCommandFramework, validateString, validateSwitch } from "../src/command";

const run = async () => 7;

test("synthetic root shows aligned categories with executable descendant routes only", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({ route: ["item"], description: "Items", args: [], flags: [], executable: false });
  cli.registerCommand({
    route: ["item", "add"],
    description: "Add an item",
    args: [],
    flags: [],
    category: "Manage items",
    run,
  });
  cli.registerCommand({
    route: ["config"],
    description: "Configure",
    args: [],
    flags: [],
    category: "Configure tool",
    run,
  });
  cli.registerCommand({ route: ["status"], description: "Show status", args: [], flags: [], run });
  cli.registerCommand({
    route: ["item", "show"],
    description: "Show an item",
    args: [],
    flags: [],
    category: "Manage items",
    run,
  });
  cli.registerCommand({ route: ["internal"], description: "Internal", args: [], flags: [], hidden: true, run });

  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(await cli.handle(["--help"])).toBe(0);
    const output = log.mock.calls.map(([message]) => message).join("\n");
    expect(output).toBe([
      "usage: tool [-h | --help] <command> [<args>]",
      "description: tool",
      "",
      "Flags:",
      "  -h, --help   Show help",
      "",
      "Available commands:",
      "  tool status      Show status",
      "",
      "Manage items:",
      "  tool item add    Add an item",
      "  tool item show   Show an item",
      "",
      "Configure tool:",
      "  tool config      Configure",
    ].join("\n"));
  } finally {
    log.mockRestore();
  }
});

test("nonexecutable groups show short usage and list flat executable descendants in help", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({ route: ["item"], description: "Items", args: [], flags: [], executable: false });
  cli.registerCommand({ route: ["item", "nested"], description: "Nested", args: [], flags: [], executable: false });
  cli.registerCommand({
    route: ["item", "nested", "add"],
    description: "Add an item",
    args: [],
    flags: [],
    category: "Items",
    run,
  });
  cli.registerCommand({ route: ["item", "internal"], description: "Internal", args: [], flags: [], hidden: true, run });

  const log = spyOn(console, "log").mockImplementation(() => {});
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await cli.handle(["item"])).toBe(0);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "usage: tool item <subcommand>",
      "see: tool item --help",
    ]);
    log.mockClear();
    expect(await cli.handle(["item", "--help"])).toBe(0);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "usage: tool item <subcommand>",
      "description: Items",
      "\nSubcommands:",
      "  tool item nested add   Add an item",
    ]);
    log.mockClear();
    expect(await cli.handle(["item", "extra"])).toBe(1);
    expect(error.mock.calls.map(([message]) => message)).toEqual(["Unexpected argument: extra"]);
    expect(log).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
    log.mockRestore();
  }
});

test("root help includes declared flags and leaf help renders params and value names", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({
    route: [],
    description: "Test tool",
    args: [],
    flags: [{
      longName: "version",
      description: "Show version",
      shortName: "v",
      switch: true,
      validate: validateSwitch,
    }],
    executable: false,
    run,
  });
  cli.registerCommand({
    route: ["item", "edit"],
    description: "Edit an item",
    args: [
      { name: "name", description: "The name", validate: validateString },
      { name: "notes", description: "The notes", params: true, validate: validateString },
    ],
    flags: [
      { longName: "quiet", description: "Suppress output", shortName: "q", switch: true, validate: validateSwitch },
      {
        longName: "append",
        description: "Append entries",
        shortName: "a",
        switch: false,
        params: true,
        valueName: "entry",
        validate: validateString,
      },
      { longName: "label", description: "Set the label", switch: false, validate: validateString },
    ],
    run,
  });

  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(await cli.handle(["--version"])).toBe(7);
    expect(await cli.handle(["-h"])).toBe(0);
    expect(log.mock.calls.map(([message]) => message).slice(0, 5)).toEqual([
      "usage: tool [-v | --version] [-h | --help] <command> [<args>]",
      "description: Test tool",
      "\nFlags:",
      "  -v, --version   Show version",
      "  -h, --help      Show help",
    ]);
    log.mockClear();
    expect(await cli.handle(["item", "edit", "--help"])).toBe(0);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "usage: tool item edit <name> <notes>... [-q | --quiet] [(-a | --append) <entry>...] [--label <label>]",
      "description: Edit an item",
      "\nArguments:",
      "  name    The name",
      "  notes   The notes",
      "\nFlags:",
      "  -q, --quiet    Suppress output",
      "  -a, --append   Append entries",
      "  --label        Set the label",
    ]);
  } finally {
    log.mockRestore();
  }
});

test("help in a subprocess has no ANSI sequences, including on process exit", () => {
  const program = `import { createCommandFramework } from './src/command';
    const cli = createCommandFramework('tool');
    cli.registerCommand({ route: [], description: 'Test tool', args: [], flags: [], run: cli.root });
    process.exitCode = await cli.handle(['--help']);`;
  const execution = Bun.spawnSync([process.execPath, "-e", program], { cwd: import.meta.dir + "/.." });
  expect(execution.exitCode).toBe(0);
  expect(execution.stderr.toString()).toBe("");
  expect(execution.stdout.toString()).not.toContain("\x1b");
  expect(execution.stdout.toString()).toContain("description: Test tool\n");
});
