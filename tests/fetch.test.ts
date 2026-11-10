import { expect, spyOn, test } from "bun:test";
import { fetchResult } from "../src/fetch";

test("fetchResult returns parsed JSON for successful response", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ count: 2 }), { status: 200 }),
  );

  try {
    expect(await fetchResult<{ count: number }>("https://example.test")).toEqual({
      success: true,
      value: { count: 2 },
    });
  } finally {
    fetcher.mockRestore();
  }
});

test("fetchResult returns server error", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
  );

  try {
    expect(await fetchResult("https://example.test")).toEqual({
      success: false,
      error: "Not found",
    });
  } finally {
    fetcher.mockRestore();
  }
});

test("fetchResult preserves the source response error without substituting a fallback", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
  try {
    expect((await fetchResult("https://example.test")) as unknown).toEqual({
      success: false,
      error: undefined,
    });
  } finally {
    fetcher.mockRestore();
  }
});

test("fetchResult reports connection failure", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

  try {
    expect(await fetchResult("https://example.test")).toEqual({
      success: false,
      error: "Connection refused",
    });
  } finally {
    fetcher.mockRestore();
  }
});
