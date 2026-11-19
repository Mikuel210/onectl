import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { createCommandFramework, validatePositiveInteger, validateString } from "../src/command";

const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

beforeEach(() => {
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
});

afterEach(() => {
  if (ttyDescriptor) Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
  else Reflect.deleteProperty(process.stdin, "isTTY");
});

function setup() {
  const cli = createCommandFramework("tool");
  const seen: unknown[][] = [];
  cli.registerCommand({
    route: ["item", "add"],
    description: "Add an item",
    args: [
      { name: "name", description: "The name", validate: validateString },
      { name: "count", description: "The count", validate: validatePositiveInteger },
      { name: "label", description: "The label", validate: validateString },
    ],
    flags: [{ longName: "limit", description: "Set the limit", switch: false, validate: validatePositiveInteger }],
    run: async (args) => {
      seen.push(args.map((arg) => arg.value));
      return 7;
    },
  });

  return { cli, seen };
}

test("retries only the invalid positional and preserves subsequent supplied values", async () => {
  const { cli, seen } = setup();
  const error = spyOn(console, "error").mockImplementation(() => {});
  const log = spyOn(console, "log").mockImplementation(() => {});
  const ask = spyOn(globalThis, "prompt").mockReturnValueOnce("  ").mockReturnValueOnce(" -1 ").mockReturnValue(" 3 ");
  try {
    expect(await cli.handle(["item", "add", " A name ", "no", " label "])).toBe(7);
    expect(seen).toEqual([[" A name ", 3, " label "]]);
    expect(ask.mock.calls.map(([message]) => message)).toEqual(Array(3).fill("tool item add  A name  <count>: "));
    expect(error.mock.calls.map(([message]) => message)).toEqual([
      "<count>: Value must be a number",
      "<count> can't be empty",
      "<count>: Value must be greater than 0",
    ]);
    expect(log.mock.calls).toEqual([[]]);
  } finally {
    ask.mockRestore();
    log.mockRestore();
    error.mockRestore();
  }
});

test("prompts for missing positionals in order and fails without running on EOF", async () => {
  const { cli, seen } = setup();
  const ask = spyOn(globalThis, "prompt").mockReturnValueOnce(" 01 ").mockReturnValue(null);
  try {
    expect(await cli.handle(["item", "add", "Focus"])).toBe(1);
    expect(seen).toEqual([]);
    expect(ask.mock.calls.map(([message]) => message)).toEqual([
      "tool item add Focus <count>: ",
      "tool item add Focus 01 <label>: ",
    ]);
  } finally {
    ask.mockRestore();
  }
});

test("never prompts on non-TTY input, syntax errors, invalid flags or help", async () => {
  const { cli, seen } = setup();
  const ask = spyOn(globalThis, "prompt").mockReturnValue(null);
  const error = spyOn(console, "error").mockImplementation(() => {});
  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(await cli.handle(["item", "add", "--bad", "-?"])).toBe(0);
    expect(await cli.handle(["item", "add", "Focus", "--bad"])).toBe(1);
    expect(await cli.handle(["item", "add", "Focus", "--limit", "no"])).toBe(1);
    expect(await cli.handle(["item", "add", "Focus", "bad", "label", "extra"])).toBe(1);
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
    expect(await cli.handle(["item", "add", "Focus"])).toBe(1);
    expect(await cli.handle(["item", "add", "Focus", " "])).toBe(1);
    expect(error.mock.calls.map(([message]) => message)).toEqual([
      "Unknown flag: --bad",
      "[--limit]: Value must be a number",
      "Unexpected argument: extra",
      "<count> is required",
      "<count> can't be empty",
    ]);
    expect(ask).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  } finally {
    ask.mockRestore();
    log.mockRestore();
    error.mockRestore();
  }
});

test("omits the separator when a validator gives no error details", async () => {
  const cli = createCommandFramework("tool");
  const validate = async () => ({ success: false as const, error: "" });
  cli.registerCommand({
    route: ["do"],
    description: "Do something",
    args: [{ name: "name", description: "The name", validate }],
    flags: [{ longName: "note", description: "Set the note", switch: false, validate }],
    run: async () => {
      throw new Error("Must not execute");
    },
  });

  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await cli.handle(["do", "name"])).toBe(1);
    expect(await cli.handle(["do", "name", "--note", "no"])).toBe(1);
    expect(error.mock.calls.map(([message]) => message)).toEqual(["<name>", "[--note]"]);
  } finally {
    error.mockRestore();
  }
});
