#!/usr/bin/env tsx
/**
 * Migrate memories from Mem0 Platform and OpenMemory to ByteRover CLI
 * 
 * Usage:
 *   # From Mem0 Platform
 *   tsx scripts/migrate-mem0-to-byterover.ts --source mem0 --api-key YOUR_MEM0_API_KEY
 * 
 *   # From OpenMemory (hosted)
 *   tsx scripts/migrate-mem0-to-byterover.ts --source openmemory --api-key YOUR_OPENMEMORY_API_KEY
 * 
 *   # From OpenMemory (local)
 *   tsx scripts/migrate-mem0-to-byterover.ts --source openmemory-local --url http://localhost:8765
 * 
 *   # Dry run (preview without importing)
 *   tsx scripts/migrate-mem0-to-byterover.ts --source mem0 --api-key KEY --dry-run
 */

import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface Mem0Memory {
    id: string;
    memory: string;
    created_at: string;
    updated_at: string;
    user_id?: string;
    agent_id?: string;
    categories?: string[];
    metadata?: Record<string, any>;
}

interface OpenMemoryItem {
    id: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

interface MigrationConfig {
    source: 'mem0' | 'openmemory' | 'openmemory-local';
    apiKey?: string;
    url?: string;
    dryRun: boolean;
    filters?: Record<string, any>;
    batchSize: number;
}

class Mem0Migrator {
    private config: MigrationConfig;
    private baseUrl = 'https://api.mem0.ai/v2';

    constructor(config: MigrationConfig) {
        this.config = config;
    }

    async fetchMem0Memories(page = 1): Promise<{ memories: Mem0Memory[]; hasMore: boolean }> {
        const response = await fetch(`${this.baseUrl}/memories/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filters: this.config.filters || {},
                page,
                page_size: this.config.batchSize,
            }),
        });

        if (!response.ok) {
            throw new Error(`Mem0 API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            memories: data.results || [],
            hasMore: data.results?.length === this.config.batchSize,
        };
    }

    async fetchOpenMemoryItems(): Promise<OpenMemoryItem[]> {
        // For hosted OpenMemory, use their API
        const url = this.config.url || 'https://api.openmemory.dev';

        const response = await fetch(`${url}/memories`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`OpenMemory API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async exportAllMemories(): Promise<Array<{ content: string; section: string; metadata: any }>> {
        console.log(`📥 Exporting memories from ${this.config.source}...`);

        const allMemories: Array<{ content: string; section: string; metadata: any }> = [];

        if (this.config.source === 'mem0') {
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                console.log(`  Fetching page ${page}...`);
                const { memories, hasMore: more } = await this.fetchMem0Memories(page);

                for (const mem of memories) {
                    allMemories.push({
                        content: mem.memory,
                        section: this.categorizeMemory(mem),
                        metadata: {
                            originalId: mem.id,
                            source: 'mem0',
                            createdAt: mem.created_at,
                            updatedAt: mem.updated_at,
                            userId: mem.user_id,
                            agentId: mem.agent_id,
                            categories: mem.categories || [],
                            tags: ['migrated-from-mem0', ...(mem.categories || [])],
                        },
                    });
                }

                hasMore = more;
                page++;
            }
        } else {
            // OpenMemory
            const items = await this.fetchOpenMemoryItems();

            for (const item of items) {
                allMemories.push({
                    content: item.content,
                    section: 'Lessons Learned',
                    metadata: {
                        originalId: item.id,
                        source: 'openmemory',
                        timestamp: item.timestamp,
                        tags: ['migrated-from-openmemory'],
                    },
                });
            }
        }

        console.log(`✅ Exported ${allMemories.length} memories`);
        return allMemories;
    }

    categorizeMemory(mem: Mem0Memory): string {
        // Map Mem0 categories to ByteRover sections
        const categories = mem.categories || [];

        if (categories.some(c => c.includes('error') || c.includes('bug'))) {
            return 'Common Errors';
        }
        if (categories.some(c => c.includes('best') || c.includes('practice'))) {
            return 'Best Practices';
        }
        if (categories.some(c => c.includes('architecture') || c.includes('design'))) {
            return 'Architecture';
        }
        if (categories.some(c => c.includes('test'))) {
            return 'Testing';
        }
        if (categories.some(c => c.includes('strategy') || c.includes('approach'))) {
            return 'Strategies';
        }

        return 'Lessons Learned';
    }

    async importToByteRover(memories: Array<{ content: string; section: string; metadata: any }>) {
        console.log(`\n📤 Importing ${memories.length} memories to ByteRover...`);

        if (this.config.dryRun) {
            console.log('\n🔍 DRY RUN - Preview of memories to import:\n');
            memories.slice(0, 5).forEach((mem, idx) => {
                console.log(`${idx + 1}. [${mem.section}] ${mem.content.substring(0, 100)}...`);
            });
            console.log(`\n... and ${memories.length - 5} more`);
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const mem of memories) {
            try {
                // Use brv add command with safe argument passing (prevents command injection)
                const args = ['add', '--section', mem.section, '--content', mem.content];
                const result = spawnSync('brv', args, { stdio: 'pipe' });

                if (result.status !== 0) {
                    throw new Error(`brv add failed: ${result.stderr?.toString()}`);
                }

                successCount++;

                if (successCount % 10 === 0) {
                    console.log(`  Imported ${successCount}/${memories.length}...`);
                }
            } catch (error) {
                console.error(`  ❌ Failed to import: ${mem.content.substring(0, 50)}...`);
                errorCount++;
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Save backup with timestamp to avoid overwriting previous backups
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `migration-backup-${timestamp}.json`;
        const backupPath = join(process.cwd(), '.brv', backupFilename);
        mkdirSync(dirname(backupPath), { recursive: true });
        writeFileSync(backupPath, JSON.stringify(memories, null, 2));
        console.log(`\n💾 Backup saved to: ${backupPath}`);
    }

    async migrate() {
        try {
            const memories = await this.exportAllMemories();
            await this.importToByteRover(memories);
        } catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }
    }
}

// CLI
const args = process.argv.slice(2);
const config: MigrationConfig = {
    source: 'mem0',
    dryRun: false,
    batchSize: 100,
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--source':
            config.source = args[++i] as any;
            break;
        case '--api-key':
            config.apiKey = args[++i];
            break;
        case '--url':
            config.url = args[++i];
            break;
        case '--dry-run':
            config.dryRun = true;
            break;
        case '--batch-size':
            config.batchSize = parseInt(args[++i]);
            break;
        case '--help':
            console.log(`
Migrate memories from Mem0/OpenMemory to ByteRover CLI

Usage:
  tsx scripts/migrate-mem0-to-byterover.ts [options]

Options:
  --source <type>       Source type: mem0, openmemory, openmemory-local
  --api-key <key>       API key for Mem0 or OpenMemory
  --url <url>           Custom URL for local OpenMemory (default: http://localhost:8765)
  --dry-run             Preview without importing
  --batch-size <n>      Batch size for pagination (default: 100)
  --help                Show this help

Examples:
  # From Mem0 Platform
  tsx scripts/migrate-mem0-to-byterover.ts --source mem0 --api-key YOUR_KEY

  # From OpenMemory (hosted)
  tsx scripts/migrate-mem0-to-byterover.ts --source openmemory --api-key YOUR_KEY

  # Dry run
  tsx scripts/migrate-mem0-to-byterover.ts --source mem0 --api-key YOUR_KEY --dry-run
      `);
            process.exit(0);
    }
}

if (!config.apiKey && config.source !== 'openmemory-local') {
    console.error('❌ --api-key is required');
    process.exit(1);
}

const migrator = new Mem0Migrator(config);
migrator.migrate();
