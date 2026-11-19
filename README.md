# onectl

Common utilities for Bun CLIs

## Features

- Command framework and help system
- Validators for common argument types
- Option selection and fuzzy finder
- Formatter for common interfaces
- Concurrent task runner
- JSON data stores

## Command framework

Register routes with `createCommandFramework()` and pass the tokens after the executable to `handle()`. The framework picks the longest matching route. Return its exit code from your CLI.

```ts
import { createCommandFramework, validateString, validateSwitch } from "onectl/command";

const cli = createCommandFramework("tool");

cli.registerCommand({
  route: ["item"],
  description: "Manage items",
  args: [],
  flags: [],
  executable: false,
});

cli.registerCommand({
  route: ["item", "edit"],
  description: "Edit an item",
  category: "Manage items",
  args: [{ name: "name", description: "The item name", validate: validateString }],
  flags: [
    {
      longName: "add-entries",
      shortName: "a",
      description: "Add entries to the item",
      switch: false,
      params: true,
      valueName: "entry",
      validate: validateString,
    },
    {
      longName: "quiet",
      shortName: "q",
      description: "Suppress output",
      switch: true,
      validate: validateSwitch,
    },
  ],
  run: async ([name], flags) => {
    const entries = flags.find((flag) => flag.longName === "add-entries")?.value;
    if (!flags.some((flag) => flag.longName === "quiet")) console.log(name!.value, entries);
    return 0;
  },
});

process.exitCode = await cli.handle(Bun.argv.slice(2));
```

### Parsing values

- Flags may appear before, between, or after positional arguments **after the complete route**. Use `-f value`, `--flag value`, `-f=value`, or `--flag=value`. Use the attached `=` form for values starting with `-`. A switch takes no value; check for it by name in the flags passed to `run`.
- A final positional argument with `params: true` receives all remaining positional tokens joined with a space. A flag with `params: true` joins spaced values until the next flag or `--`. An attached value always takes exactly one token, even for a params flag.
- Put a greedy params flag after the positional arguments, or separate its values from later arguments with `--` or an attached value. For example, `tool item edit Focus -a one two`, `tool item edit -a one two -- Focus`, and `tool item edit --add-entries='one two' Focus` all pass `Focus` and `one two`. `-a 'one two' Focus` still consumes `Focus`: shell quotes group a token but don't mark the end of the flag's values.
- `--` ends flag and help parsing. All remaining tokens are positional, even if they start with `-`. Nonblank tokens preserve their original whitespace. Unknown or duplicate flags, missing flag values, values attached to switches, and extra positional arguments are errors.

### Validation and help

`validateTimeSpanMs` uses `HH:MM[:SS]` or `D.HH:MM[:SS]`, so `05:30` means five hours and thirty minutes. For commands that expect music track lengths, opt into `[HH:]MM:SS` with `(input) => validateTimeSpanMs(input, true)`.

Validators return a `Result`; successful values are available on `args[i].value` and `flags[i].value`. With a terminal on stdin, missing or invalid positional arguments prompt for input and retry only that argument. Prompt input is trimmed; EOF aborts with exit code `1`. With nonterminal stdin, positional errors fail immediately. Syntax and flag validation failures do not trigger positional prompts. Framework errors go to stderr.

Use `-h`, `-?`, or `--help` after a route to show help before validation. Root help lists visible executable routes, optionally grouped by `category`. A registered `route: []` can supply its own description, flags, and handler; otherwise the framework provides a root that shows usage or help. A group marked `executable: false` shows short usage when invoked by itself and lists its executable descendants in help. Set `hidden: true` to omit a command from listings without disabling direct invocation or help.
