import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { createStore } from "../src/store";

test("store loads schema defaults then saves and backs up JSON in configured directory", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bun-kit-store-"));
  try {
    const store = createStore(dir);
    const schema = z.object({ volume: z.number().default(50) });

    expect(await store.load("settings.json", schema)).toEqual({
      success: true,
      value: { volume: 50 },
    });

    expect(await store.save("settings.json", { volume: 10 })).toEqual({
      success: true,
      value: undefined,
    });

    expect(await store.save("settings.json", { volume: 20 })).toEqual({
      success: true,
      value: undefined,
    });

    expect(await store.load("settings.json", schema)).toEqual({
      success: true,
      value: { volume: 20 },
    });

    expect(JSON.parse(readFileSync(path.join(dir, "settings.json.bak"), "utf8"))).toEqual({
      volume: 10,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("store reports validation failure", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bun-kit-store-"));
  try {
    const store = createStore(dir);
    const result = await store.load("missing.json", z.object({ required: z.string() }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("required");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
