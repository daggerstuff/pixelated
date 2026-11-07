#!/usr/bin/env ts-node
/**
 * MentalArena Data Generation Script - Production Version
 *
 * This script uses the production-grade MentalArena implementation
 * to generate synthetic therapeutic conversations with comprehensive
 * validation, quality metrics, and security features.
 *
 * Usage:
 *   ts-node mental-arena-generate-production.ts --num-conversations 10 --output-path ./data/synthetic.jsonl
 */

import { program } from 'commander'


// Parse command line arguments
program
  .option(
    '-n, --num-conversations <number>',
    'Number of conversations to generate',
    '10',
  )
  .option(
    '-o, --output-path <path>',
    'Output path for generated data',
    './data/mental-arena-synthetic.jsonl',
  )
  .option('-m, --model <name>', 'Base model to use', 'gpt-4')
  .option('-p, --python-path <path>', 'Path to Python executable', 'python3')
  .option(
    '--complexity <level>',
    'Complexity level (low|medium|high)',
    'medium',
  )
  .option(
    '--enable-encryption',
    'Enable FHE encryption for sensitive data',
    false,
  )
  .option('--validate-output', 'Enable comprehensive output validation', true)
  .option('--max-turns <number>', 'Maximum turns per conversation', '8')
  .option(
    '--disorders <list>',
    'Comma-separated list of disorders',
    'anxiety,depression,ptsd',
  )
  .parse(process.argv)
