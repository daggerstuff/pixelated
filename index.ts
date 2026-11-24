import { generateText } from 'ai';
import { config } from 'dotenv';

// Load .env.local first with override: true so local credentials take precedence
config({ path: '.env.local', override: true });
config({ path: '.env' });

async function main() {
  const { text } = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(text);
}

main().catch((err) => {
  console.error('Error generating text:', err);
  process.exit(1);
});
