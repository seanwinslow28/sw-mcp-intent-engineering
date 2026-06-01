import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  loadFileSafely,
  DisallowedExtensionError,
  OutsideRootError,
  FileTooLargeError,
  NotARegularFileError,
  MAX_FILE_BYTES,
} from "./safe-fs.js";

const ROOT_ENV = "INTENT_ENGINEERING_ALLOWED_ROOT";

async function tmpDir(prefix: string): Promise<string> {
  // realpath so comparisons line up with safe-fs (macOS /var -> /private/var).
  return fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
}

/** Run `fn` with INTENT_ENGINEERING_ALLOWED_ROOT set to `root`, then restore. */
async function withRoot(root: string | null, fn: () => Promise<void>): Promise<void> {
  const prev = process.env[ROOT_ENV];
  if (root === null) delete process.env[ROOT_ENV];
  else process.env[ROOT_ENV] = root;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[ROOT_ENV];
    else process.env[ROOT_ENV] = prev;
  }
}

test("disallowed extension: /etc/passwd is rejected (DisallowedExtensionError)", async () => {
  await withRoot(null, async () => {
    await assert.rejects(
      () => loadFileSafely("/etc/passwd"),
      DisallowedExtensionError,
    );
  });
});

test("disallowed extension: a .conf path is rejected even if it exists", async () => {
  const dir = await tmpDir("ie-ext-");
  const p = path.join(dir, "app.conf");
  await fs.writeFile(p, "secret=1\n", "utf-8");
  await withRoot(null, async () => {
    await assert.rejects(() => loadFileSafely(p), DisallowedExtensionError);
  });
});

test("allowed extension inside no-root default: reads the file", async () => {
  const dir = await tmpDir("ie-ok-");
  const p = path.join(dir, "spec.md");
  await fs.writeFile(p, "# hello\n", "utf-8");
  await withRoot(null, async () => {
    const out = await loadFileSafely(p);
    assert.equal(out, "# hello\n");
  });
});

test("symlink (.md) pointing outside the allowed root is rejected when root is set", async () => {
  const root = await tmpDir("ie-root-");
  const outside = await tmpDir("ie-outside-");
  const target = path.join(outside, "secret.md");
  await fs.writeFile(target, "TOP SECRET\n", "utf-8");
  const link = path.join(root, "link.md");
  await fs.symlink(target, link);

  await withRoot(root, async () => {
    await assert.rejects(() => loadFileSafely(link), OutsideRootError);
  });
});

test("a real .md inside the allowed root is permitted", async () => {
  const root = await tmpDir("ie-root2-");
  const p = path.join(root, "inside.md");
  await fs.writeFile(p, "ok\n", "utf-8");
  await withRoot(root, async () => {
    assert.equal(await loadFileSafely(p), "ok\n");
  });
});

test("file larger than 1 MiB is rejected (FileTooLargeError)", async () => {
  const dir = await tmpDir("ie-big-");
  const p = path.join(dir, "big.md");
  await fs.writeFile(p, Buffer.alloc(MAX_FILE_BYTES + 1, 0x61)); // 'a'
  await withRoot(null, async () => {
    await assert.rejects(() => loadFileSafely(p), FileTooLargeError);
  });
});

test("a directory with an allowed-looking name is rejected (NotARegularFileError)", async () => {
  const dir = await tmpDir("ie-dir-");
  const sub = path.join(dir, "notafile.md");
  await fs.mkdir(sub);
  await withRoot(null, async () => {
    await assert.rejects(() => loadFileSafely(sub), NotARegularFileError);
  });
});
