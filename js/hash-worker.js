// hash-wasm 4.12.0, vendored with its MIT license. No remote script dependency.
importScripts('./vendor/sha256.umd.min.js');
self.onmessage = async ({ data: file }) => {
  try {
    const hash = await hashwasm.createSHA256();
    hash.init();
    for (let offset = 0; offset < file.size; offset += 4 * 1024 * 1024) {
      hash.update(new Uint8Array(await file.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer()));
    }
    self.postMessage({ sha256: hash.digest('hex') });
  } catch {
    self.postMessage({ error: 'File checksum failed' });
  }
};
