import * as path from "path";

/**
 * Server-side path utility functions
 */

/**
 * Secure path validation utility to prevent path traversal attacks
 * @param basePath - The base directory path that should not be escaped
 * @param userPath - The user-provided path segment
 * @param options - Additional validation options
 * @returns The validated and resolved path
 * @throws Error if the path is unsafe or attempts directory traversal
 */
export function securePathJoin(
    basePath: string,
    userPath: string,
    options: {
        allowAbsolute?: boolean;
        allowedExtensions?: string[];
        maxDepth?: number;
    } = {},
): string {
    const {
        allowAbsolute = false,
        allowedExtensions = [],
        maxDepth = 10,
    } = options;

    // Reject absolute paths unless explicitly allowed
    if (!allowAbsolute && path.isAbsolute(userPath)) {
        throw new Error("Absolute paths are not allowed");
    }

    // Reject paths with .. segments (directory traversal)
    if (
        userPath.includes("..") ||
        userPath.includes("../") ||
        userPath.includes("..\\")
    ) {
        throw new Error("Directory traversal sequences (..) are not allowed");
    }

    // Reject paths with unsafe characters (no control characters)
    const unsafeChars = /[<>:"|?*]/; // Windows forbidden chars only
    if (unsafeChars.test(userPath)) {
        throw new Error("Path contains unsafe characters");
    }

    // Check depth limit
    const segments = userPath
        .split(/[/\\]/)
        .filter((segment) => segment.length > 0);
    if (segments.length > maxDepth) {
        throw new Error(`Path depth exceeds maximum allowed depth of ${maxDepth}`);
    }

    // Check file extension allowlist if provided
    if (allowedExtensions.length > 0) {
        const ext = path.extname(userPath).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            throw new Error(
                `File extension '${ext}' is not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`,
            );
        }
    }

    // Resolve the path and ensure it stays within the base directory
    const resolvedPath = path.resolve(basePath, userPath);
    const resolvedBase = path.resolve(basePath);

    // Verify the resolved path starts with the base path
    if (
        !resolvedPath.startsWith(resolvedBase + path.sep) &&
        resolvedPath !== resolvedBase
    ) {
        throw new Error(
            "Path traversal detected: resolved path escapes base directory",
        );
    }

    return resolvedPath;
}
