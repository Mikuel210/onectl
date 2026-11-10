import { createSpinner, fuzzySearch, logObject, promptOptions, reserveLines } from "../src/formatter";

import { expect, spyOn, test } from "bun:test";

test("logObject aligns and indents object values", () => {
  const log = spyOn(console, "log").mockImplementation(() => {});

  try {
    logObject({ a: 1, longer: 2 }, true);
    expect(log.mock.calls.map((c) => c[0])).toEqual(["  a        1", "  longer   2"]);
  } finally {
    log.mockRestore();
  }
});

test("fuzzySearch ranks matches and honors limit", () => {
  const entries = [{ name: "Alpha" }, { name: "Beta" }, { name: "Alphabet" }];
  expect(fuzzySearch(entries, ["name"], "alpha", 1)).toEqual([entries[0]]);
});

test("promptOptions returns a perfect match without prompting", async () => {
  const entry = { name: "Alpha" };

  expect(await promptOptions([entry], " alpha ", (e) => e.name, "an", "item")).toEqual({
    success: true,
    value: entry,
  });
});

test("promptOptions validates the numeric selection like bgmd", async () => {
  const entries = [{ name: "Alpha" }, { name: "Beta" }];
  const log = spyOn(console, "log").mockImplementation(() => {});
  const ask = spyOn(globalThis, "prompt").mockReturnValue("2");
  try {
    expect(await promptOptions(entries, "none", (e) => e.name, "an", "item")).toEqual({
      success: true,
      value: entries[1],
    });
    expect(ask.mock.calls[0]?.[0]).toBe("\nSelect an item (1 - 2):");
  } finally {
    ask.mockRestore();
    log.mockRestore();
  }
});

test("promptOptions returns no-match failure", async () => {
  expect(await promptOptions<{ name: string }>([], "x", (e) => e.name, "an", "item")).toEqual({
    success: false,
    error: "No matches found",
  });
});

test("spinners stop their animation when completed", () => {
  const write = spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    reserveLines(2);
    const first = createSpinner("One", 0);
    const second = createSpinner("Two", 1);
    write.mockClear();
    first.succeed("One done");
    second.succeed("Two done");
    expect(write.mock.calls.map((c) => c[0]).join("")).toContain("✔ Two done");
  } finally {
    write.mockRestore();
  }
});

test("spinner stops on success and writes the result", () => {
  const write = spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    reserveLines(1);
    const spinner = createSpinner("Working", 0);
    spinner.succeed("Done");

    expect(write.mock.calls.map((c) => c[0]).join("")).toContain("✔ Done");
  } finally {
    write.mockRestore();
  }
});
