import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

test('upload worker hashes multiple bounded chunks with the standard SHA-256 result', async () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024 + 11, 0x61);
  const slices = [];
  const file = { size: bytes.length, slice(start, end) {
    slices.push(end-start);
    return new Blob([bytes.subarray(start,end)]);
  }};
  let result;
  const context = vm.createContext({ Uint8Array, WebAssembly, TextEncoder, atob,
    self: { postMessage: value => { result = value; } },
    importScripts: () => vm.runInContext(readFileSync(new URL('../js/vendor/sha256.umd.min.js', import.meta.url),'utf8'), context),
  });
  vm.runInContext(readFileSync(new URL('../js/hash-worker.js', import.meta.url),'utf8'), context);
  await context.self.onmessage({data:file});
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(slices.length,3);
  assert.ok(slices.every(n => n <= 4*1024*1024));
});
