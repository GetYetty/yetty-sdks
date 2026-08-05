import { spawn, ChildProcess } from 'node:child_process';

let prismProcess: ChildProcess | null = null;
const PRISM_PORT = 4010;
const PRISM_URL = `http://127.0.0.1:${PRISM_PORT}`;

async function waitForPort(port: number, timeout: number = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Port ${port} did not become available within ${timeout}ms`);
}

export async function setup() {
  console.log('Starting Prism mock server...');

  prismProcess = spawn(
    'npx',
    ['@stoplight/prism-cli', 'mock', 'openapi.yaml', '-p', String(PRISM_PORT)],
    { stdio: 'inherit' },
  );

  await waitForPort(PRISM_PORT);
  console.log(`Prism mock server running on ${PRISM_URL}`);

  process.env.SELLSY_BASE_URL = PRISM_URL;
}

export async function teardown() {
  if (prismProcess) {
    console.log('Stopping Prism mock server...');
    prismProcess.kill();

    await new Promise<void>((resolve) => {
      prismProcess!.on('exit', () => resolve());
      setTimeout(resolve, 1000);
    });

    prismProcess = null;
  }
}
