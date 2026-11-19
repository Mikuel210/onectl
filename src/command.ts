import type { Result } from "./task";

export interface Argument {
  name: string;
  description: string;
  params?: boolean;
  validate: (input: string) => Promise<Result<any>>;
  value?: any;
}

export interface Flag {
  longName: string;
  shortName?: string;
  description: string;
  switch: boolean;
  params?: boolean;
  valueName?: string;
  validate: (input: string) => Promise<Result<any>>;
  value?: any;
}

interface CommandDefinition {
  route: string[];
  description: string;
  args: Argument[];
  flags: Flag[];
  hidden?: boolean;
  category?: string;
}

type CommandRunner = (args: Argument[], flags: Flag[]) => Promise<number>;

export type Command =
  & CommandDefinition
  & (
    | { executable?: boolean; run: CommandRunner }
    | { executable: false; run?: never }
  );

export {
  validateDays,
  validatePositiveInteger,
  validateString,
  validateSwitch,
  validateTimeSpanMs,
} from "./validate";

export { createCommandFramework } from "./handler";
