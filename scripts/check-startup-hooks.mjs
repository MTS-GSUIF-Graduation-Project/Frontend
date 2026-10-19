// Static guard against the startup payloads removed in the 2026-10 security cleanup.
// It only reads files; it never executes or imports anything from the repository.
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};
const expected = {
  ng: 'ng',
  start: 'ng serve',
  build: 'ng build',
  watch: 'ng build --watch --configuration development',
  test: 'ng test',
  prestart: 'node scripts/check-startup-hooks.mjs',
  prebuild: 'node scripts/check-startup-hooks.mjs',
  pretest: 'node scripts/check-startup-hooks.mjs'
};

for (const [name, command] of Object.entries(expected)) {
  if (scripts[name] !== command) {
    failures.push(`package.json script "${name}" must be exactly: ${command}`);
  }
}

for (const [name, command] of Object.entries(scripts)) {
  if (typeof command !== 'string') {
    continue;
  }

  if (command.includes('api.js') || command.includes('fa-solid-700')) {
    failures.push(`package.json script "${name}" references a removed startup payload`);
  }

  if (/^(pre|post)?install$|^prepare$/.test(name)) {
    failures.push(`package.json must not define the "${name}" lifecycle script`);
  }
}

for (const path of ['api.js', 'public/fonts/fa-solid-700.otf', 'src/app/features/auth/login/public']) {
  if (existsSync(join(root, path))) {
    failures.push(`${path} must not be present`);
  }
}

const tasksPath = join(root, '.vscode', 'tasks.json');
if (existsSync(tasksPath)) {
  const tasks = readFileSync(tasksPath, 'utf8');
  if (/folderOpen|fa-solid-700|api\.js|fonts\//.test(tasks)) {
    failures.push('.vscode/tasks.json must not run a startup payload');
  }
}

const settingsPath = join(root, '.vscode', 'settings.json');
if (existsSync(settingsPath)) {
  const settings = readFileSync(settingsPath, 'utf8');
  if (/"task\.allowAutomaticTasks"\s*:\s*(true|"on")/.test(settings) || /folderOpen/.test(settings)) {
    failures.push('.vscode/settings.json must not auto-run tasks when the folder opens');
  }
  if (/hideOnStartup|"debug\.openDebug"\s*:\s*"neverOpen"/.test(settings)) {
    failures.push('.vscode/settings.json must not hide the terminal or debugger');
  }
}

// Every font must start with a real font signature; the payloads were JavaScript named as fonts.
const FONT = /\.(otf|ttf|woff2?|eot)$/i;
const SIGNATURES = ['774f4646', '774f4632', '4f54544f', '00010000', '74727565'];
// Obfuscated-loader shapes seen in the removed payloads.
const LOADER = [
  /atob\([^)]*\);\s*eval\(/,
  /eval\(\s*atob\(/,
  /global(\['i'\]|\.i)\s*=\s*'A10-/,
  /x-payload-b64/i,
  /eth_getBlockByNumber/,
  /while\(!!\[\]\)\{try\{/,
  / {200,}\S/
];
const SCANNED = /\.(m?js|cjs|ts|json|html|css|otf|ttf|woff2?|eot)$/i;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.angular', 'coverage', 'out-tsc', 'tmp']);
const SELF = relative(root, fileURLToPath(import.meta.url));

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      continue;
    }
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        walk(path);
      }
      continue;
    }
    const name = relative(root, path).split(sep).join('/');
    if (name === SELF.split(sep).join('/') || name === 'package-lock.json' || !SCANNED.test(name)) {
      continue;
    }
    const bytes = readFileSync(path);
    if (FONT.test(name)) {
      const magic = bytes.subarray(0, 4).toString('hex');
      const eot = /\.eot$/i.test(name) && bytes.subarray(34, 36).toString('latin1') === 'LP';
      if (!SIGNATURES.includes(magic) && !eot) {
        failures.push(`${name} is not a font binary`);
        continue;
      }
    }
    const text = bytes.toString('latin1');
    if (LOADER.some(pattern => pattern.test(text))) {
      failures.push(`${name} matches an obfuscated loader pattern`);
    }
  }
}

walk(root);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('startup hook check passed');
