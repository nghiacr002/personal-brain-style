import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('development refresh reloads changed assets, retries downtime and protects edits', async () => {
  let version = 'one',
    ok = true,
    reloads = 0,
    notice;
  const handlers = {},
    timers = [];
  const context = vm.createContext({
    document: {
      addEventListener(name, fn) {
        handlers[name] = fn;
      },
      getElementById() {
        return notice;
      },
      createElement() {
        return {
          addEventListener(name, fn) {
            this[name] = fn;
          },
        };
      },
      body: {
        appendChild(node) {
          notice = node;
        },
      },
    },
    location: {
      reload() {
        reloads++;
      },
    },
    fetch: async () => ({ok, json: async () => ({version})}),
    setTimeout(fn) {
      timers.push(fn);
    },
  });
  vm.runInContext(
    readFileSync(new URL('../public/live-reload.js', import.meta.url), 'utf8'),
    context,
  );
  await vm.runInContext('checkForChanges()', context);
  version = 'two';
  await vm.runInContext('checkForChanges()', context);
  assert.equal(reloads, 1);
  handlers.input();
  version = 'three';
  await vm.runInContext('checkForChanges()', context);
  assert.equal(reloads, 1);
  assert.match(notice.textContent, /unsaved edits/);
  notice.click();
  assert.equal(reloads, 2);
  ok = false;
  const before = timers.length;
  await vm.runInContext('checkForChanges()', context);
  assert.equal(timers.length, before + 1);
});
