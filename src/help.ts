import type { Command, Flag } from "./command";
import { logRows } from "./formatter";

const helpFlag = { shortName: "h", longName: "help", switch: true };
type HelpFlag = Pick<Flag, "shortName" | "longName" | "switch" | "params" | "valueName">;
type HelpRow = [string, string];

export function createHelp(programName: string, commands: Command[], isRoot: (command: Command) => boolean) {
  const getRoute = (command: Command) => [programName, ...command.route].join(" ");

  function showHelp(command: Command): void {
    const rootHelp = isRoot(command);
    console.log(`usage: ${getUsage(command, true)}`);
    console.log(`description: ${command.description}`);

    if (command.args.length > 0) {
      console.log("\nArguments:");
      logRows(command.args.map(({ name, description }) => [name, description]), true);
    }

    if (!rootHelp && command.flags.length > 0) {
      console.log("\nFlags:");
      logRows(command.flags.map((flag) => [getFlagNames(flag, ", "), flag.description]), true);
    }

    const subcommands = commands.filter((child) =>
      (!rootHelp || !child.hidden) && child.executable !== false && child.route.length > command.route.length
      && command.route.every((part, index) => part === child.route[index])
    );
    if (subcommands.length === 0) return;

    if (!rootHelp) {
      console.log("\nSubcommands:");
      logRows(subcommands.map((child) => [getRoute(child), child.description]), true);
      return;
    }

    const groups = new Map<string, HelpRow[]>();
    let keyWidth = 0;
    for (const child of subcommands) {
      const category = child.category?.trim() ?? "";
      const route = getRoute(child);
      keyWidth = Math.max(keyWidth, route.length);
      if (!groups.has(category)) groups.set(category, []);

      groups.get(category)!.push([route, child.description]);
    }

    const ungrouped = groups.get("");
    const hasCategories = groups.size > (ungrouped ? 1 : 0);
    console.log(hasCategories ? "\nBelow is a list of all available commands" : "\nAvailable commands:");

    if (ungrouped) {
      if (hasCategories) console.log();

      logRows(ungrouped, true, keyWidth);
    }

    for (const [category, rows] of groups) {
      if (!category) continue;
      console.log(`\n${category.endsWith(":") ? category : `${category}:`}`);
      logRows(rows, true, keyWidth);
    }
  }

  function showUsage(command: Command): void {
    console.log(`usage: ${getUsage(command, false)}`);
    console.log(`see: ${getRoute(command)} --help`);
  }

  function getUsage(command: Command, includeFlags: boolean): string {
    const route = getRoute(command);
    const flags = includeFlags ? getHelpFlags(command).map(getFlagUsage) : [];
    if (isRoot(command)) return [route, ...flags, "<command> [<args>]"].join(" ");
    if (command.executable === false) return `${route} <subcommand>`;

    const args = command.args.map((argument) => `<${argument.name}>${argument.params ? "..." : ""}`);
    return [route, ...args, ...flags].join(" ");
  }

  function getHelpFlags(command: Command): HelpFlag[] {
    if (!isRoot(command)) return command.flags;
    return [...command.flags, helpFlag];
  }

  return { showHelp, showUsage };
}

function getFlagNames(flag: HelpFlag, separator: string): string {
  const longName = `--${flag.longName}`;
  return flag.shortName ? `-${flag.shortName}${separator}${longName}` : longName;
}

function getFlagUsage(flag: HelpFlag): string {
  const names = getFlagNames(flag, " | ");
  if (flag.switch) return `[${names}]`;

  const value = `<${flag.valueName ?? flag.longName}>${flag.params ? "..." : ""}`;
  return `[${flag.shortName ? `(${names})` : names} ${value}]`;
}
