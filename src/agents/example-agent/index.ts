/**
 * Example OpenCode agent.
 *
 * This agent receives an input object `{ message: string }` and returns a
 * transformed string where the original message is reversed and converted to
 * upper‑case. It demonstrates the required project structure, TypeScript typing,
 * async entry point, and CLI integration.
 */

export interface Input {
  message: string;
}

export interface Output {
  transformed: string;
}

/**
 * Run the agent.
 * @param input - Object containing the message to transform.
 * @returns The transformed string.
 */
export async function run(input: Input): Promise<Output> {
  const { message } = input;
  // Simple transformation: reverse and upper‑case.
  const transformed = message.split('').reverse().join('').toUpperCase();
  return { transformed };
}

// If executed directly via `node`/`ts-node`, allow CLI usage.
if (require.main === module) {
  // Expect a JSON string or a plain message via CLI args.
  const args = process.argv.slice(2);
  let input: Input;
  if (args.length === 1) {
    try {
      input = JSON.parse(args[0]);
    } catch {
      // Fallback to plain string.
      input = { message: args[0] };
    }
  } else {
    console.error('Usage: pnpm run agent:example "Your message"');
    process.exit(1);
  }

  run(input)
    .then((out) => console.log(out.transformed))
    .catch((err) => {
      console.error('Agent error:', err);
      process.exit(1);
    });
}
