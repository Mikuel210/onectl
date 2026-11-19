import type { Flag } from "./command";
import type { Result } from "./task";

interface ParsedArguments {
  positionals: string[];
  flags: { flag: Flag; input?: string }[];
}

export function isFlag(token: string): boolean {
  return token.startsWith("-");
}

export function requestsHelp(tokens: string[]): boolean {
  for (const token of tokens) {
    if (token === "--") return false;
    if (token === "-h" || token === "-?" || token === "--help") return true;
  }

  return false;
}

export function parseArguments(tokens: string[], flags: Flag[]): Result<ParsedArguments> {
  const parsed: ParsedArguments = { positionals: [], flags: [] };
  const seen = new Set<string>();

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;

    if (token === "--") {
      parsed.positionals.push(...tokens.slice(index + 1));
      break;
    }

    if (!isFlag(token)) {
      parsed.positionals.push(token);
      continue;
    }

    const separator = token.indexOf("=");
    const name = separator === -1 ? token : token.slice(0, separator);
    const flag = flags.find((flag) =>
      name === `--${flag.longName}` || (flag.shortName && name === `-${flag.shortName}`)
    );
    if (!flag) return { success: false, error: `Unknown flag: ${token}` };

    const canonicalName = `--${flag.longName}`;
    if (seen.has(canonicalName)) return { success: false, error: `Duplicate flag: ${canonicalName}` };

    seen.add(canonicalName);

    if (flag.switch) {
      if (separator !== -1) return { success: false, error: `[${canonicalName}] doesn't take a value` };

      parsed.flags.push({ flag });
      continue;
    }

    let input: string;
    if (separator !== -1) input = token.slice(separator + 1);
    else {
      const start = index + 1;
      while (index + 1 < tokens.length && !isFlag(tokens[index + 1]!)) {
        index++;
        if (!flag.params) break;
      }

      input = tokens.slice(start, index + 1).join(" ");
    }

    if (!input.trim()) return { success: false, error: `[${canonicalName}] can't be empty` };

    parsed.flags.push({ flag, input });
  }

  return { success: true, value: parsed };
}
