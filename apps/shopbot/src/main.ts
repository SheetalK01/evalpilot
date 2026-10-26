import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { buildApp, createTracer } from './app';
import { createBrain } from './brain';
import { loadShopBotConfig } from './config';

const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) loadDotenv({ path: envFile, quiet: true });

const config = loadShopBotConfig();
const app = buildApp({ config, brain: createBrain(config), tracer: createTracer(config) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

app.listen({ port: config.port, host: config.host }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
