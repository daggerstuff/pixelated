import fs from "node:fs";
import process from "process";
import { existsSync, readdirSync } from "node:fs";
import path from "path";
import { pathToFileURL } from "url";

function hasConfiguredValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export function getPortFallbackPolicy(env = process.env) {
  const reasons = [];

  if (hasConfiguredValue(env.PORT)) {
    reasons.push("PORT is explicitly configured");
  }

  if (hasConfiguredValue(env.WEBSITES_PORT)) {
    reasons.push("WEBSITES_PORT is explicitly configured");
  }

  if (hasConfiguredValue(env.NO_PORT_FALLBACK)) {
    reasons.push("NO_PORT_FALLBACK is set");
  }

  if (hasConfiguredValue(env.FORCE_EXIT_ON_EADDRINUSE)) {
    reasons.push("FORCE_EXIT_ON_EADDRINUSE is set");
  }

  if (env.NODE_ENV === "production") {
    reasons.push("NODE_ENV=production");
  }

  return {
    isFallbackDisabled: reasons.length > 0,
    reasons,
  };
}

/** @returns {Promise<string | null>} */
async function findHandlerEntryPath(serverDir) {
  if (!existsSync(serverDir)) {
    return null;
  }

  const normalizedServerDir = path.resolve(serverDir);
  const candidates = readdirSync(serverDir).filter(
    (file) => file.endsWith(".mjs") || file.endsWith(".js"),
  );

  for (const file of candidates) {
    const resolved = path.resolve(normalizedServerDir, file);
    // Guard against symlink-based escapes: entry must stay within serverDir
    if (!resolved.startsWith(normalizedServerDir + path.sep) && resolved !== normalizedServerDir) {
      continue;
    }
    const moduleUrl = pathToFileURL(resolved).href;
    const exports = await import(moduleUrl);
    if (typeof exports.handler === "function") {
      return resolved;
    }
  }

  return null;
}

export async function resolveSsrEntryModuleUrl({ cwd = process.cwd(), env = process.env } = {}) {
  if (hasConfiguredValue(env.SSR_ENTRY_FILE)) {
    const rawEntry = String(env.SSR_ENTRY_FILE);
    const normalizedCwd = path.resolve(cwd);
    // Absolute paths (e.g. staged release entries like /tmp/releases/current/dist/server/entry.mjs)
    // are accepted as-is. Relative paths must resolve inside cwd to prevent traversal.
    const resolvedEntry = path.isAbsolute(rawEntry)
      ? path.resolve(rawEntry)
      : path.resolve(normalizedCwd, rawEntry);
    if (
      !path.isAbsolute(rawEntry) &&
      !resolvedEntry.startsWith(normalizedCwd + path.sep) &&
      resolvedEntry !== normalizedCwd
    ) {
      throw new Error(`SSR_ENTRY_FILE resolves outside the project directory: ${rawEntry}`);
    }
    return pathToFileURL(resolvedEntry).href;
  }

  const serverDir = path.resolve(cwd, "dist/server");
  const defaultEntry = path.join(serverDir, "entry2.mjs");

  if (existsSync(defaultEntry)) {
    try {
      const exports = await import(pathToFileURL(defaultEntry).href);
      if (typeof exports.handler === "function") {
        return pathToFileURL(defaultEntry).href;
      }
    } catch {
      // Fall through to handler discovery.
    }
  }

  const handlerEntry = await findHandlerEntryPath(serverDir);
  if (handlerEntry) {
    return pathToFileURL(handlerEntry).href;
  }

  return pathToFileURL(defaultEntry).href;
}
