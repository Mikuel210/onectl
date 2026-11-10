import type { Result } from "./task";

export const validateSwitch = (_: string): Promise<Result> =>
  Promise.resolve({ success: true, value: undefined });

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

export async function validateTimeSpanMs(
  input: string,
): Promise<Result<number>> {
  const parts = input.split(":");
  let partNumbers = [];

  if (parts.length < 2 || parts.length > 3) {
    return {
      success: false,
      error: "Value must be a valid timespan ([HH:]MM:SS)",
    };
  }

  for (const part of parts) {
    const number = parseInt(part);
    if (part.length > 2 || Number.isNaN(number)) {
      return {
        success: false,
        error: "Value must be a valid timespan ([HH:]MM:SS)",
      };
    }
    partNumbers.push(number);
  }

  // Parts to millis
  if (partNumbers.length == 3) {
    const hours = partNumbers[0]!;
    const minutes = partNumbers[1]!;
    const seconds = partNumbers[2]!;

    return {
      success: true,
      value: ((hours * 60 + minutes) * 60 + seconds) * 1000,
    };
  }

  const minutes = partNumbers[0]!;
  const seconds = partNumbers[1]!;

  return {
    success: true,
    value: (minutes * 60 + seconds) * 1000,
  };
}
