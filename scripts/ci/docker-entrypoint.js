#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';

// Function to read secret and inject into environment
function injectSecret(fileEnv, targetEnv, urlEnv = null) {
    const filePath = process.env[fileEnv];
    if (filePath && fs.existsSync(filePath)) {
        try {
            const secret = fs.readFileSync(filePath, 'utf8').trim();
            if (secret) {
                // Inject as standard env var (e.g. REDIS_PASSWORD) if targetEnv provided
                if (targetEnv) {
                    process.env[targetEnv] = secret;
                    console.log(`[Entrypoint] Injected ${fileEnv} into ${targetEnv}`);
                }

                // Inject into URL if urlEnv provided (e.g. REDIS_URL)
                if (urlEnv && process.env[urlEnv]) {
                    try {
                        const url = new URL(process.env[urlEnv]);
                        // Only inject if password matches default (empty or ":")? 
                        // Better: Always inject if missing or overwrite? 
                        // ioredis needs password in URL or options.
                        // If we overwrite, we ensure consistency.
                        if (!url.password) {
                            url.password = secret;
                            process.env[urlEnv] = url.toString();
                            // Mask the password in logs
                            const maskedUrl = url.toString().replace(/:[^:@]*@/, ':****@');
                            console.log(`[Entrypoint] Injected ${fileEnv} into ${urlEnv} (Result: ${maskedUrl})`);
                        }
                    } catch (e) {
                        console.error(`[Entrypoint] Failed to parse ${urlEnv}:`, e);
                    }
                }
            }
        } catch (err) {
            console.error(`[Entrypoint] Failed to read ${fileEnv}:`, err);
        }
    }
}

// Inject Redis Password
injectSecret('REDIS_PASSWORD_FILE', 'REDIS_PASSWORD', 'REDIS_URL');

// Inject DB Password
injectSecret('DB_PASSWORD_FILE', 'PGPASSWORD', 'DATABASE_URL');
injectSecret('DB_PASSWORD_FILE', 'DB_PASSWORD');

// Run the command passed as arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    args.push('node', './dist/server/entry.mjs');
}

console.log(`[Entrypoint] Starting: ${args.join(' ')}`);

const child = spawn(args[0], args.slice(1), { stdio: 'inherit' });

child.on('close', (code) => {
    process.exit(code);
});

child.on('error', (err) => {
    console.error('[Entrypoint] Failed to start child process:', err);
    process.exit(1);
});

// Forward signals
['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'].forEach((signal) => {
    process.on(signal, () => {
        if (child.killed) return;
        child.kill(signal);
    });
});
