// Hash in bounded chunks off the UI thread, including multi-gigabyte builds.
export function hashFile(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash-worker.js', import.meta.url));
    const finish = () => worker.terminate();
    worker.onerror = () => { finish(); reject(new Error('File checksum failed')); };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.sha256);
    };
    worker.postMessage(file);
  });
}
