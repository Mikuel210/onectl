import { expect, test } from "bun:test";
import * as validators from "../src/validate";

test("FreeBlock day notation accepts groups and unique case-insensitive letters", async () => {
  const validateDays = (validators as any).validateDays;
  expect(typeof validateDays).toBe("function");
  for (
    const [input, expected] of [
      ["weekdays", [1, 2, 3, 4, 5]],
      ["weekends", [0, 6]],
      ["everyday", [0, 1, 2, 3, 4, 5, 6]],
      ["MTWHFSU", [0, 1, 2, 3, 4, 5, 6]],
      ["mWmm", [1, 3]],
    ] as const
  ) expect(await validateDays(input)).toEqual({ success: true, value: expected });
  for (const input of ["", " ", "monday", "mx", "m,w"]) {
    expect((await validateDays(input)).success).toBe(false);
  }
});
