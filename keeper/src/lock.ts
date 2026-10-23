import {open, readFile, unlink} from 'node:fs/promises';

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function acquireLock(path: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, 'wx', 0o600);
      await handle.writeFile(`${process.pid}\n`);
      await handle.close();
      return async () => {
        try { await unlink(path); } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const pid = Number((await readFile(path, 'utf8').catch(() => '')).trim());
      if (Number.isSafeInteger(pid) && pid > 0 && processExists(pid)) {
        throw new Error(`keeper already running with pid ${pid}`);
      }
      await unlink(path).catch(() => undefined);
    }
  }
  throw new Error(`unable to acquire keeper lock: ${path}`);
}
