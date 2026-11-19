import { isFlag, parseArguments, requestsHelp } from "./argument-parser";
import type { Argument, Command, Flag } from "./command";
import { createHelp } from "./help";
import type { Result } from "./task";

export function createCommandFramework(programName: string) {
  const commands: Command[] = [];
  const isRoot = (command: Command) => command.route.length === 0;
  const { showHelp, showUsage } = createHelp(programName, commands, isRoot);
  const defaultRoot: Command = { route: [], description: programName, args: [], flags: [], run: root };
  const getRoot = () => commands.find(isRoot) ?? defaultRoot;

  async function handle(tokens: string[]): Promise<number> {
    const command = resolveCommand(tokens);
    if (!command) {
      console.error(`Command not found: ${[programName, ...tokens].join(" ")}`);
      return fail(`see: ${programName} --help`);
    }

    const input = tokens.slice(command.route.length);
    if (requestsHelp(input)) {
      showHelp(command);
      return 0;
    }

    const parsed = parseArguments(input, command.flags);
    if (!parsed.success) return fail(parsed.error);

    const { positionals, flags } = parsed.value;
    const isGroup = command.executable === false && !isRoot(command);
    const args = isGroup ? [] : command.args;
    if (args.at(-1)?.params && positionals.length > args.length) {
      positionals.push(positionals.splice(args.length - 1).join(" "));
    }

    const extra = positionals[args.length];
    if (extra !== undefined) return fail(`Unexpected argument: ${extra}`);

    if (isGroup || !command.run) {
      showUsage(command);
      return 0;
    }

    // Validate flags before asking for positionals so a bad flag cannot trigger an input prompt.
    const validatedFlags: Flag[] = [];
    for (const { flag, input } of flags) {
      if (input === undefined) {
        validatedFlags.push({ ...flag });
        continue;
      }

      const result = await flag.validate(input);
      if (!result.success) return fail(formatValidationError(`[--${flag.longName}]`, result.error));

      validatedFlags.push({ ...flag, value: result.value });
    }

    const validatedArgs = await validatePositionals([programName, ...command.route], args, positionals);
    if (!validatedArgs) return 1;

    return await command.run(validatedArgs, validatedFlags);
  }

  function registerCommand(command: Command): void {
    commands.push(command);
  }

  function resolveCommand(tokens: string[]): Command | undefined {
    let match: Command | undefined;
    for (const command of commands) {
      if (isRoot(command) || command.route.length <= (match?.route.length ?? 0)) continue;
      if (command.route.every((part, index) => part === tokens[index])) match = command;
    }

    if (match) return match;
    if (tokens.length === 0 || isFlag(tokens[0]!)) return getRoot();
  }

  async function root(_args: Argument[], _flags: Flag[]): Promise<number> {
    showUsage(getRoot());
    return 0;
  }

  return { handle, registerCommand, showHelp, commands, isFlag, isRoot, getRoot, root };
}

async function validatePositionals(
  route: string[],
  args: Argument[],
  positionals: string[],
): Promise<Argument[] | null> {
  const validated: Argument[] = [];
  const prefix = [...route];
  let prompted = false;

  for (const [index, argument] of args.entries()) {
    const label = `<${argument.name}>`;
    let input: string | undefined = positionals[index];

    while (true) {
      if (input !== undefined) {
        const result = await validatePositional(argument, label, input);
        if (result.success) {
          validated.push({ ...argument, value: result.value });
          prefix.push(input);
          break;
        }

        console.error(result.error);
      } else if (!process.stdin.isTTY) {
        console.error(`${label} is required`);
      }

      if (!process.stdin.isTTY) return null;

      const response = prompt(`${prefix.join(" ")} ${label}: `);
      if (response == null) return null;

      prompted = true;
      input = response.trim();
    }
  }

  if (prompted) console.log();

  return validated;
}

async function validatePositional(argument: Argument, label: string, input: string): Promise<Result<unknown>> {
  if (!input.trim()) return { success: false, error: `${label} can't be empty` };

  const result = await argument.validate(input);
  if (result.success) return result;

  return { success: false, error: formatValidationError(label, result.error) };
}

function formatValidationError(label: string, detail: string): string {
  return detail ? `${label}: ${detail}` : label;
}

function fail(message: string): 1 {
  console.error(message);
  return 1;
}
