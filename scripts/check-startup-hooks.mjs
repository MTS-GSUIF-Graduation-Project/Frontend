import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
}

if (existsSync(join(root, 'api.js'))) {
  failures.push('api.js must not be present');
}

if (existsSync(join(root, 'public', 'fonts', 'fa-solid-700.otf'))) {
  failures.push('public/fonts/fa-solid-700.otf must not be present');
}

const tasksPath = join(root, '.vscode', 'tasks.json');
if (existsSync(tasksPath)) {
  const tasks = readFileSync(tasksPath, 'utf8');
  if (/folderOpen|fa-solid-700|api\.js/.test(tasks)) {
    failures.push('.vscode/tasks.json must not run a startup payload');
  }
}

const settingsPath = join(root, '.vscode', 'settings.json');
if (existsSync(settingsPath)) {
  const settings = readFileSync(settingsPath, 'utf8');
  if (/"task.allowAutomaticTasks"\s*:\s*true/.test(settings) || /folderOpen/.test(settings)) {
    failures.push('.vscode/settings.json must not auto-run tasks when the folder opens');
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('startup hook check passed');
