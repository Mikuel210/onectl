import type { Result } from "./task";

export async function fetchResult<T>(url: string, options: RequestInit = {}): Promise<Result<T>> {
  try {
    const result = await fetch(url, options);
    const json = (await result.json()) as Record<string, any>;

    if (!result.ok) {
      return {
        success: false,
        error: json.error,
      };
    }

    return {
      success: true,
      value: json as T,
    };
  } catch (error) {
    return {
      success: false,
      error: "Connection refused",
    };
  }
}
