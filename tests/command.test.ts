import { expect, spyOn, test } from "bun:test";
import type { Argument, Flag } from "../src/command";
import { createCommandFramework, validatePositiveInteger, validateString, validateSwitch } from "../src/command";

function argument(name: string, settings: Partial<Argument> = {}): Argument {
  return { name, description: `The ${name}`, validate: validateString, ...settings };
}

function flag(longName: string, settings: Partial<Flag> = {}): Flag {
  return { longName, description: `Set ${longName}`, switch: false, validate: validateString, ...settings };
}

test("accepts flags anywhere after the complete route and preserves quoted values", async () => {
  const cli = createCommandFramework("tool");
  let seen: unknown;

  cli.registerCommand({
    route: ["item", "edit"],
    description: "Edit an item",
    args: [argument("name"), argument("label")],
    flags: [flag("note", { shortName: "n" }), flag("quiet", { shortName: "q", switch: true }), flag("other")],
    run: async (args, flags) => {
      seen = [args.map((arg) => arg.value), flags.map(({ longName, value }) => [longName, value])];
      return 7;
    },
  });

  expect(await cli.handle(["item", "edit", "-n", "  two words  ", "One", "-q", "Two", "--other", "last"]))
    .toBe(7);
  expect(seen).toEqual([["One", "Two"], [["note", "  two words  "], ["quiet", undefined], ["other", "last"]]]);
});

test("params flag is greedy until another flag or the option terminator", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({
    route: ["item"],
    description: "Edit an item",
    args: [argument("name"), argument("notes", { params: true })],
    flags: [flag("append", { shortName: "a", params: true }), flag("quiet", { switch: true })],
    run: async (args, flags) => {
      expect(args.map((arg) => arg.value)).toEqual(["Focus", "with --help"]);
      expect(flags.map((flag) => flag.value)).toEqual(["one two", undefined]);
      return 7;
    },
  });
  expect(await cli.handle(["item", "-a", "one", "two", "--quiet", "--", "Focus", "with", "--help"])).toBe(7);
});

test("attached flag values consume exactly one token, including dash-prefixed text", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({
    route: ["item"],
    description: "Edit an item",
    args: [argument("name")],
    flags: [flag("append", { params: true }), flag("label", { shortName: "l" })],
    run: async (args, flags) => {
      expect(args[0]?.value).toBe("Focus");
      expect(flags.map((flag) => flag.value)).toEqual(["one two", "--help"]);
      return 7;
    },
  });
  expect(await cli.handle(["item", "--append=one two", "Focus", "-l=--help"])).toBe(7);
});

test.each([
  [["--append", "one", "-a=two"], "Duplicate flag: --append"],
  [["--append", "--quiet"], "[--append] can't be empty"],
  [["--append", "--"], "[--append] can't be empty"],
  [["--append=  "], "[--append] can't be empty"],
  [["--quiet=yes"], "[--quiet] doesn't take a value"],
  [["-undefined"], "Unknown flag: -undefined"],
])("reports flag syntax errors without validation (%j)", async (tokens, diagnostic) => {
  const cli = createCommandFramework("tool");
  const validate = () => {
    throw new Error("Must not validate invalid syntax");
  };
  cli.registerCommand({
    route: ["item"],
    description: "Edit an item",
    args: [argument("name", { validate })],
    flags: [flag("append", { shortName: "a", validate }), flag("quiet", { switch: true })],
    run: async () => {
      throw new Error("Must not run invalid syntax");
    },
  });

  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await cli.handle(["item", "Focus", ...tokens])).toBe(1);
    expect(error.mock.calls.map(([message]) => message)).toEqual([diagnostic]);
  } finally {
    error.mockRestore();
  }
});

test("routes to longest command, validates arguments and flags", async () => {
  const cli = createCommandFramework("tool");
  let seen: unknown;

  cli.registerCommand({
    route: ["item"],
    description: "Items",
    args: [],
    flags: [],
    run: async () => 8,
  });

  cli.registerCommand({
    route: ["item", "add"],
    description: "Add",
    args: [{ name: "count", description: "Count", validate: validatePositiveInteger }],
    flags: [
      {
        longName: "quiet",
        shortName: "q",
        description: "Quiet",
        switch: true,
        validate: validateSwitch,
      },
    ],
    run: async (args, flags) => {
      seen = [args[0]?.value, flags[0]?.longName];
      return 0;
    },
  });

  expect(await cli.handle(["item", "add", "2", "-q"])).toBe(0);
  expect(seen).toEqual([2, "quiet"]);
});

test("reports an unknown flag without executing", async () => {
  const cli = createCommandFramework("tool");
  let calls = 0;

  cli.registerCommand({
    route: ["do"],
    description: "Do",
    args: [{ name: "n", description: "N", validate: validatePositiveInteger }],
    flags: [],
    run: async () => {
      calls++;
      return 0;
    },
  });

  const error = spyOn(console, "error").mockImplementation(() => {});

  try {
    expect(await cli.handle(["do", "1", "--bad"])).toBe(1);
    expect(calls).toBe(0);
    expect(error.mock.calls.map((c) => c[0])).toEqual(["Unknown flag: --bad"]);
  } finally {
    error.mockRestore();
  }
});

test("rejects an unexpected positional token without executing", async () => {
  const cli = createCommandFramework("tool");
  let called = false;
  cli.registerCommand({
    route: ["do"],
    description: "Do",
    args: [],
    flags: [],
    run: async () => {
      called = true;
      return 7;
    },
  });
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await cli.handle(["do", "extra"])).toBe(1);
    expect(error.mock.calls.map(([message]) => message)).toEqual(["Unexpected argument: extra"]);
    expect(called).toBe(false);
  } finally {
    error.mockRestore();
  }
});

test("nested help lists its subcommands", async () => {
  const cli = createCommandFramework("tool");

  cli.registerCommand({
    route: ["item"],
    description: "Items",
    args: [],
    flags: [],
    run: async () => 0,
  });

  cli.registerCommand({
    route: ["item", "add"],
    description: "Adds",
    args: [],
    flags: [],
    run: async () => 0,
  });

  const log = spyOn(console, "log").mockImplementation(() => {});

  try {
    expect(await cli.handle(["item", "--help"])).toBe(0);
    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("tool item add");
    expect(output.split("\n")[0]).toBe("usage: tool item");
  } finally {
    log.mockRestore();
  }
});

test("hidden commands are omitted from root and nested help but remain callable", async () => {
  const cli = createCommandFramework("tool");
  let calls = 0;
  cli.registerCommand({ route: [], description: "Root", args: [], flags: [], run: cli.root });
  cli.registerCommand({ route: ["item"], description: "Items", args: [], flags: [], run: cli.root });
  cli.registerCommand({ route: ["item", "show"], description: "Show", args: [], flags: [], run: cli.root });
  cli.registerCommand({
    route: ["item", "tick"],
    description: "Internal",
    args: [],
    flags: [],
    hidden: true,
    run: async () => {
      calls++;
      return 7;
    },
  });
  cli.registerCommand({
    route: ["internal"],
    description: "Internal",
    args: [],
    flags: [],
    hidden: true,
    run: async () => {
      calls++;
      return 8;
    },
  });

  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(await cli.handle(["--help"])).toBe(0);
    expect(log.mock.calls.map((call) => call[0]).join("\n")).not.toContain("internal");
    log.mockClear();
    expect(await cli.handle(["item", "--help"])).toBe(0);
    const nestedHelp = log.mock.calls.map((call) => call[0]).join("\n");
    expect(nestedHelp).toContain("tool item show");
    expect(nestedHelp).not.toContain("tool item tick");
    log.mockClear();
    expect(await cli.handle(["item", "tick", "--help"])).toBe(0);
    expect(log.mock.calls.map((call) => call[0]).join("\n")).toContain("Internal");
    expect(await cli.handle(["item", "tick"])).toBe(7);
    expect(await cli.handle(["internal"])).toBe(8);
    expect(calls).toBe(2);
  } finally {
    log.mockRestore();
  }
});

test("help and unknown commands use the configured program name", async () => {
  const cli = createCommandFramework("tool");
  cli.registerCommand({ route: [], description: "Root", args: [], flags: [], run: async () => 0 });

  cli.registerCommand({
    route: ["run"],
    description: "Runs",
    args: [],
    flags: [],
    run: async () => 0,
  });

  const log = spyOn(console, "log").mockImplementation(() => {});

  try {
    expect(await cli.handle(["--help"])).toBe(0);
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toContain("tool [-h | --help] <command>");

    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      log.mockClear();
      expect(await cli.handle(["missing", "--help"])).toBe(1);
      expect(log).not.toHaveBeenCalled();
      expect(error.mock.calls.map(([message]) => message)).toEqual([
        "Command not found: tool missing --help",
        "see: tool --help",
      ]);
    } finally {
      error.mockRestore();
    }
  } finally {
    log.mockRestore();
  }
});
