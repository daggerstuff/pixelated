#!/usr/bin/env node
/**
 * Build wrapper that handles EPIPE errors gracefully
 * 
 * Problem: During CI builds, parent process may close stdout/stderr pipes
 * before the build completes, causing Node.js to throw unhandled EPIPE errors
 * 
 * Solution: This wrapper handles broken pipe errors and exits cleanly
 */
import { spawn } from 'child_process';
import process from 'process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to load .env file manually to ensure variables are available
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });
        if (result.error) {
            console.warn('⚠️  Warning: Failed to load .env file via dotenv:', result.error.message);
        }
    }
} catch (e) {
    console.warn('⚠️  Warning: Error trying to load .env file:', e.message);
}

// Handle EPIPE errors on stdout/stderr
process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') {
        // Parent process closed the pipe - exit gracefully
        // This is not a fatal error, just means logs won't be printed
        process.exit(0);
    }
    throw error;
});

process.stderr.on('error', (error) => {
    if (error.code === 'EPIPE') {
        // Parent process closed the pipe - exit gracefully
        process.exit(0);
    }
    throw error;
});

// Ignore SIGPIPE signal (common when piping to pager or when pipe closes)
// This is more robust than trying to handle it in the error handler
process.on('SIGPIPE', () => {
    // Silently exit - the pipe was closed by parent process
    process.exit(0);
});

// Spawn the actual Astro build
const build = spawn('astro', ['build'], {
    stdio: 'inherit',
});

build.on('error', (error) => {
    console.error('Failed to start build:', error);
    process.exit(1);
});

build.on('exit', (code, signal) => {
    // Exit with the same code as the build process
    // If it was killed by a signal, exit with code 1
    if (signal) {
        process.exit(1);
    }
    process.exit(code ?? 0);
});

// Handle parent process termination gracefully
process.on('SIGTERM', () => {
    build.kill('SIGTERM');
});

process.on('SIGINT', () => {
    build.kill('SIGINT');
});
