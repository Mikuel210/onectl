import { expect, test } from "bun:test";
import { validateTimeSpanMs } from "../src/validate";

const duration = (value: number) => ({ success: true as const, value });

test("defaults to hours and minutes, with optional seconds and days", async () => {
  expect(await validateTimeSpanMs("05:30")).toEqual(duration(19_800_000));
  expect(await validateTimeSpanMs("1:02:03")).toEqual(duration(3_723_000));
  expect(await validateTimeSpanMs("26:15")).toEqual(duration(94_500_000));
  expect(await validateTimeSpanMs(" 1.02:15 ")).toEqual(duration(94_500_000));
  expect(await validateTimeSpanMs("00:00")).toEqual(duration(0));
});

test("rejects ambiguous, overflowing, negative and malformed duration values", async () => {
  for (const value of ["12", "24:60", "0.24:00", "03:70:00", "1x:02", "0:1", "0:00:60", "999999999999:00"]) {
    expect(await validateTimeSpanMs(value)).toEqual({
      success: false,
      error: "Value must be a valid timespan (DD.HH:MM:SS)",
    });
  }

  expect(await validateTimeSpanMs("-01:30")).toEqual({
    success: false,
    error: "Value must be a positive timespan",
  });
});

test("can opt into bgmd's minutes-and-seconds shorthand", async () => {
  expect(await validateTimeSpanMs("05:30", true)).toEqual(duration(330_000));
  expect(await validateTimeSpanMs("90:00", true)).toEqual(duration(5_400_000));
  expect(await validateTimeSpanMs("01:05:30", true)).toEqual(duration(3_930_000));
  expect(await validateTimeSpanMs("1.02:15", true)).toEqual({
    success: false,
    error: "Value must be a valid timespan ([HH:]MM:SS)",
  });
});
