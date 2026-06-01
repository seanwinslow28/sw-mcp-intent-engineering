import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Hardened file loader for the intent-engineering MCP server.
 *
 * The three tools accept an absolute `file_path` so a caller can audit a spec
 * that lives on disk. Left unguarded, `fs.stat` + `fs.readFile` on an arbitrary
 * path is an arbitrary-file-read primitive: a malicious or confused MCP client
 * (or a prompt-injected upstream model) could call
 * `audit_intent_spec({ file_path: "/etc/passwd" })` and the contents would be
 * handed straight back to the model. `loadFileSafely` is the single chokepoint
 * that closes that hole. See docs/SECURITY.md.
 *
 * Guarantees, in order:
 *   1. Resolve to an absolute path (no implicit cwd surprises).
 *   2. Extension allowlist — only text spec formats.
 *   3. Resolve symlinks with `fs.realpath` so a `.md` symlink can't smuggle a
 *      read of `/etc/shadow`. `fs.stat` follows symlinks; we resolve them
 *      ourselves first so every later check runs against the *real* target.
 *   4. Optional root confinement: if INTENT_ENGINEERING_ALLOWED_ROOT is set,
 *      the resolved real path must live inside it (with a `..`-escape guard).
 *   5. The real target must be a regular file and <= MAX_FILE_BYTES.
 *
 * Only after all of those pass do we read the bytes.
 */

export const MAX_FILE_BYTES = 1_048_576; // 1 MiB

export const ALLOWED_EXTENSIONS = [
  ".md",
  ".markdown",
  ".yaml",
  ".yml",
  ".txt",
] as const;

const ALLOWED_ROOT_ENV = "INTENT_ENGINEERING_ALLOWED_ROOT";

/** Base class so callers can `instanceof SafeFsError` to catch any guard failure. */
export class SafeFsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DisallowedExtensionError extends SafeFsError {}
export class OutsideRootError extends SafeFsError {}
export class NotARegularFileError extends SafeFsError {}
export class FileTooLargeError extends SafeFsError {}

/**
 * Resolve the configured allowed root to an absolute, symlink-free path, or
 * `null` if unset. Documented default: when INTENT_ENGINEERING_ALLOWED_ROOT is
 * not set, any real path that clears the other checks is allowed.
 */
async function resolveAllowedRoot(): Promise<string | null> {
  const raw = process.env[ALLOWED_ROOT_ENV];
  if (!raw || raw.trim() === "") return null;
  const abs = path.resolve(raw.trim());
  // Resolve the root through realpath too, so a symlinked root compares against
  // the same namespace as the symlink-resolved file path below.
  try {
    return await fs.realpath(abs);
  } catch {
    // If the configured root doesn't exist we cannot honor confinement; treat
    // every path as outside it rather than failing open.
    return abs;
  }
}

/** True if `child` is `root` itself or strictly contained within it. */
function isInsideRoot(root: string, child: string): boolean {
  if (child === root) return true;
  // Compare against `root + sep` so that /home/userX is not treated as inside
  // /home/user. path.relative additionally guards against `..` escapes.
  const withSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!child.startsWith(withSep)) return false;
  const rel = path.relative(root, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Validate and read a file for one of the intent tools. Throws a typed
 * SafeFsError subclass on any policy violation; otherwise resolves to the
 * file's UTF-8 contents.
 */
export async function loadFileSafely(filePath: string): Promise<string> {
  // 1. Absolute resolution.
  const resolved = path.resolve(filePath);

  // 2. Extension allowlist (checked on the requested name, before any I/O).
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new DisallowedExtensionError(
      `Refusing to read "${resolved}": extension "${ext || "(none)"}" is not in the allowlist (${ALLOWED_EXTENSIONS.join(", ")}).`,
    );
  }

  // 3. Resolve symlinks to the real target. realpath throws ENOENT for missing
  //    files; surface that as a generic SafeFsError so the tool reports cleanly.
  let realPath: string;
  try {
    realPath = await fs.realpath(resolved);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new SafeFsError(`File not found: ${resolved}`);
    }
    throw new SafeFsError(
      `Cannot resolve path "${resolved}": ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 4. Optional root confinement against the symlink-resolved real path.
  const allowedRoot = await resolveAllowedRoot();
  if (allowedRoot && !isInsideRoot(allowedRoot, realPath)) {
    throw new OutsideRootError(
      `Refusing to read "${realPath}": resolved path is outside the allowed root "${allowedRoot}" (set via ${ALLOWED_ROOT_ENV}).`,
    );
  }

  // 5. Regular-file + size checks on the real target. lstat the realpath would
  //    only re-confirm it is not itself a symlink (realpath already resolved
  //    that), so stat the real target for type + size.
  const stat = await fs.stat(realPath);
  if (!stat.isFile()) {
    throw new NotARegularFileError(
      `Refusing to read "${realPath}": not a regular file.`,
    );
  }
  if (stat.size > MAX_FILE_BYTES) {
    throw new FileTooLargeError(
      `Refusing to read "${realPath}": ${stat.size} bytes exceeds the ${MAX_FILE_BYTES}-byte (1 MiB) limit.`,
    );
  }

  return fs.readFile(realPath, "utf-8");
}
