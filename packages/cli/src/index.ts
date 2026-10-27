import { main } from './main';

void main({
  argv: process.argv.slice(2),
  env: process.env,
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  isTty: process.stdout.isTTY,
}).then((code) => {
  process.exitCode = code;
});
