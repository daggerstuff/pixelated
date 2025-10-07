declare module 'commander' {
  export class Command {
    // Replace multiple index signatures with specific properties
    name: string;
    commands: Command[];
    options: CommandOption[];
    parent: Command | null;

    constructor(name?: string)

    option(
      flags: string,
      description?: string,
      defaultValue?: string | boolean | number,
    ): this

    parse(argv?: string[]): this

    opts(): { [key: string]: unknown }

    // Add other common Command methods
    action(fn: (...args: unknown[]) => void | Promise<void>): this
    alias(alias: string): this
    description(str: string): this
    version(str: string, flags?: string, description?: string): this
    command(name: string, description?: string): Command
    help(cb?: (str: string) => string): void
  }

  interface CommandOption {
    flags: string;
    description: string;
    required: boolean;
    optional: boolean;
    variadic: boolean;
    mandatory: boolean;
    negate: boolean;
    long: string;
    short?: string;
    defaultValue?: unknown;
  }

  export const program: Command
}

// types module
