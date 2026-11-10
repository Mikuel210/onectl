import { expect, spyOn, test } from "bun:test";
import { createCommandFramework, validatePositiveInteger, validateSwitch } from "../src/command";

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

test("reports missing argument and unknown flag without executing", async () => {
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
    expect(await cli.handle(["do"])).toBe(1);
    expect(await cli.handle(["do", "1", "--bad"])).toBe(1);
    expect(calls).toBe(0);
    expect(error.mock.calls.map((c) => c[0])).toEqual(["<n> is required", "Unknown option: --bad"]);
  } finally {
    error.mockRestore();
  }
});

test("ignores extra positional tokens when no flag starts, as bgmd does", async () => {
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
  expect(await cli.handle(["do", "extra"])).toBe(7);
  expect(called).toBe(true);
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
    expect(output).toContain("usage: tool ");
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
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toContain("tool <command>");

    log.mockClear();
    expect(await cli.handle(["missing"])).toBe(1);
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toContain("Command not found: tool missing");
  } finally {
    log.mockRestore();
  }
});
