import type { Result } from "./task";

export const validateSwitch = (_: string): Promise<Result> => Promise.resolve({ success: true, value: undefined });

export async function validateDays(input: string): Promise<Result<number[]>> {
  if (!input.trim()) return { success: false, error: "Value must include at least one day" };

  const value = input.toLowerCase();
  const groups: Record<string, number[]> = {
    everyday: [0, 1, 2, 3, 4, 5, 6],
    weekdays: [1, 2, 3, 4, 5],
    weekends: [0, 6],
  };

  if (Object.hasOwn(groups, value)) return { success: true, value: [...groups[value]!] };

  const days = [...value].map(day => "umtwhfs".indexOf(day));
  if (days.includes(-1)) {
    return {
      success: false,
      error: "Value must be days of the week: MTWHFSU | weekdays | weekends | everyday",
    };
  }

  return { success: true, value: [...new Set(days)].sort() };
}

export async function validateString(input: string): Promise<Result<string>> {
  return {
    success: true,
    value: input,
  };
}

export async function validatePositiveInteger(
  input: string,
): Promise<Result<number>> {
  if (input.trim() === "") {
    return {
      success: false,
      error: "Value can't be empty",
    };
  }

  const number = Number(input);
  if (Number.isNaN(number)) {
    return {
      success: false,
      error: "Value must be a number",
    };
  }
  if (!Number.isInteger(number)) {
    return {
      success: false,
      error: "Value must be an integer",
    };
  }
  if (number <= 0) {
    return {
      success: false,
      error: "Value must be greater than 0",
    };
  }

  return {
    success: true,
    value: number,
  };
}

// Match the whole-second range of FreeBlock's .NET TimeSpan.
const MAX_DURATION_SECONDS = 922_337_203_685;

export async function validateTimeSpanMs(
  input: string,
  minutesFirst = false,
): Promise<Result<number>> {
  const text = input.trim();
  const match = /^(-)?(?:(\d+)\.)?(\d+):(\d{2})(?::(\d{2}))?$/.exec(text);
  const format = minutesFirst ? "[HH:]MM:SS" : "DD.HH:MM:SS";
  const invalid = { success: false as const, error: `Value must be a valid timespan (${format})` };

  if (!match) return invalid;

  const [, negative, dayPart, firstPart, secondPart, thirdPart] = match;
  if (dayPart !== undefined && minutesFirst) return invalid;

  const days = Number(dayPart ?? 0);
  const first = Number(firstPart);
  const second = Number(secondPart);
  const third = Number(thirdPart ?? 0);
  const shortForm = minutesFirst && thirdPart === undefined;

  if (second > 59 || third > 59 || (dayPart !== undefined && first > 23)) return invalid;

  const totalSeconds = shortForm ? first * 60 + second : ((days * 24 + first) * 60 + second) * 60 + third;
  if (totalSeconds > MAX_DURATION_SECONDS) return invalid;

  if (negative && totalSeconds !== 0) {
    return { success: false, error: "Value must be a positive timespan" };
  }

  return { success: true, value: totalSeconds * 1000 };
}
