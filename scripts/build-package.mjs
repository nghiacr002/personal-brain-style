import ts from 'typescript';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  chmodSync,
} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
rmSync(out, {recursive: true, force: true});
for (const folder of ['src', 'scripts', 'public']) {
  mkdirSync(resolve(out, folder), {recursive: true});
}
for (const file of readdirSync(resolve(root, 'src'), {recursive: true}).filter((f) =>
  f.endsWith('.ts'),
)) {
  // Runtime entry paths must follow the compiled extension too.
  const source = readFileSync(resolve(root, 'src', file), 'utf8').replace(
    /(["'])(\.\.\/)?cli\.ts\1/g,
    '$1$2cli.js$1',
  );
  const result = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      rewriteRelativeImportExtensions: true,
    },
  });
  mkdirSync(dirname(resolve(out, 'src', file)), {recursive: true});
  writeFileSync(resolve(out, 'src', file.replace(/\.ts$/, '.js')), result.outputText);
}
for (const file of ['run.mjs', 'runtime-compat.mjs', 'connect-chatgpt.sh']) {
  copyFileSync(resolve(root, 'scripts', file), resolve(out, 'scripts', file));
}
for (const file of ['app.js', 'style.css', 'index.html']) {
  copyFileSync(resolve(root, 'public', file), resolve(out, 'public', file));
}
const bin = resolve(out, 'scripts/personal-brain.mjs');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
writeFileSync(
  bin,
  `#!/usr/bin/env node
import {supported} from "./runtime-compat.mjs";
if(!supported(process.versions.node)){console.error("Personal Brain requires Node 22.13+ (Node 24 LTS recommended).");process.exit(1);}
if(process.argv.includes("--version")){console.log(${JSON.stringify(version)});process.exit(0);}
if(process.argv.includes("--help")){console.log("personal-brain setup|serve|doctor|connect|disconnect claude|codex|opencode|all|desktop preview|install|repair|remove|status|mcp [claude|codex]|hooks install|remove|status [claude|codex|both]|backup <file>|chatgpt-connect <projectId>");process.exit(0);}
await import("../src/cli.js");
`,
);
chmodSync(bin, 0o755);
