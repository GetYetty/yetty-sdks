import { spawn, ChildProcess } from 'child_process';
import { connect } from 'node:net';

let prismProcess: ChildProcess;

async function waitForPort(host: string, port: number, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connect(port, host);
        socket.once('connect', () => {
          socket.end();
          resolve();
        });
        socket.once('error', reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Prism mock server did not become ready on ${host}:${port}`);
}

export default async function setup() {
  console.debug('Starting Prism mock server...');
  prismProcess = spawn('npx', ['prism', 'mock', 'openapi.json', '-p', '4010'], {
    stdio: 'inherit',
    shell: true,
  });

  // Wait for Prism to start
  await waitForPort('127.0.0.1', 4010);

  return async () => {
    console.debug('Stopping Prism mock server...');
    if (prismProcess) {
      prismProcess.kill();
      // Wait for Prism to exit properly to avoid risking orphaned processes and port conflicts in subsequent test runs
      await new Promise<void>((resolve) => prismProcess.once('exit', () => resolve()));
    }
  };
}
