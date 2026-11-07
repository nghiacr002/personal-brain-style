import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function setup() {
  const elements = new Map(),
    rows = [],
    panels = [],
    labels = [];
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        textContent: '',
        innerHTML: '',
        hidden: false,
        disabled: false,
        addEventListener() {},
        focus() {
          this.focused = true;
        },
        reportValidity() {
          return !!this.value;
        },
        querySelector() {
          return element('submit');
        },
      });
    }
    return elements.get(id);
  };
  const document = {
    getElementById: element,
    addEventListener() {},
    querySelector() {
      return element('focus');
    },
    querySelectorAll(q) {
      const matches = {
        '[data-assignment-row]': rows,
        '[data-wizard-step]': panels,
        '[data-wizard-label]': labels,
      };
      return matches[q] ?? [];
    },
  };
  const context = vm.createContext({
    document,
    setTimeout,
    clearTimeout,
    console,
    AbortController,
    fetch: async () => ({ok: true, json: async () => ({folder: '/repo'})}),
  });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  return {context, element, rows, panels, labels};
}
test('style search and selected-only filter preserve selections and override drafts', () => {
  const {context, element, rows} = setup();
  const make = (id, checked) => ({
    dataset: {assignmentRow: id},
    hidden: false,
    draft: 'keep me',
    querySelector() {
      return {checked};
    },
  });
  rows.push(make('a', true), make('b', false), make('c', false));
  vm.runInContext(
    'items=[{id:"a",title:"Selected",tags:[]},{id:"b",title:"Typed code",domain:"coding",tags:["typescript"]},{id:"c",title:"Diagrams",tags:[]}];summary={domainRegistry:[{id:"coding",name:"Development"}]}',
    context,
  );
  element('assignmentSearch').value = 'typescript';
  vm.runInContext('filterProjectStyles()', context);
  assert.deepEqual(
    rows.map((r) => r.hidden),
    [true, false, true],
  );
  assert.equal(rows[0].draft, 'keep me');
  element('assignmentSearch').value = 'development';
  vm.runInContext('filterProjectStyles()', context);
  assert.equal(rows[1].hidden, false);
  element('assignmentSearch').value = 'unmatched';
  vm.runInContext('filterProjectStyles()', context);
  assert.equal(rows[0].hidden, true);
  assert.match(element('assignmentSearchResult').textContent, /No matching styles/);
  element('assignmentSearch').value = '';
  vm.runInContext('filterProjectStyles()', context);
  assert.ok(rows.every((r) => !r.hidden));
  element('selectedOnly').checked = true;
  vm.runInContext('filterProjectStyles()', context);
  assert.deepEqual(
    rows.map((r) => r.hidden),
    [false, true, true],
  );
  assert.equal(rows[0].draft, 'keep me');
  element('assignmentSearch').value = 'unmatched';
  vm.runInContext('filterProjectStyles()', context);
  assert.ok(rows.every((r) => r.hidden));
  element('selectedOnly').checked = false;
  element('assignmentSearch').value = '';
  vm.runInContext('filterProjectStyles()', context);
  assert.ok(rows.every((r) => !r.hidden));
});
test('wizard advances only after folder validation; back preserves fields and review escapes text', async () => {
  const {context, element, panels, labels} = setup();
  for (let n = 0; n < 5; n++) {
    panels.push({dataset: {wizardStep: String(n)}, hidden: false});
    labels.push({
      dataset: {wizardLabel: String(n)},
      setAttribute(k, v) {
        this[k] = v;
      },
      removeAttribute(k) {
        delete this[k];
      },
    });
  }
  element('projectName').value = '<script>Project</script>';
  element('projectDescription').value = 'description';
  element('onboardingFolder').value = '/repo';
  vm.runInContext('showOnboardingStep(0)', context);
  assert.deepEqual(
    panels.map((p) => p.hidden),
    [false, true, true, true, true],
  );
  context.fetch = async () => ({ok: false, json: async () => ({message: 'Folder already linked'})});
  await vm.runInContext('advanceOnboarding()', context);
  assert.equal(vm.runInContext('onboardingStep', context), 0);
  assert.match(element('projectError').textContent, /already linked/);
  context.fetch = async () => ({ok: true, json: async () => ({folder: '/canonical/repo'})});
  await vm.runInContext('advanceOnboarding()', context);
  assert.equal(vm.runInContext('onboardingStep', context), 1);
  assert.equal(element('onboardingFolder').value, '/canonical/repo');
  assert.equal(labels[1]['aria-current'], 'step');
  const scan = {
    folder: '/canonical/repo',
    scannedStyles: [{id: 'a', title: 'Style'}],
    gaps: [
      {
        type: 'skill',
        required: true,
        recordId: 'a',
        recordTitle: 'Style',
        name: '<b>missing-skill</b>',
        status: 'missing',
        message: 'Style uses the skill missing-skill, which is not installed.',
        setup: 'Install it.',
      },
    ],
    issues: [],
  };
  context.fetch = async () => ({ok: true, json: async () => scan});
  vm.runInContext('showOnboardingStep(3)', context);
  await vm.runInContext('scanOnboardingGaps()', context);
  assert.deepEqual(
    panels.map((p) => p.hidden),
    [true, true, true, false, true],
  );
  assert.match(element('onboardingGaps').innerHTML, /&lt;b&gt;missing-skill/);
  assert.match(element('onboardingGaps').innerHTML, /<strong>1<\/strong> required/);
  assert.equal(element('submit').textContent, 'Skip for now');
  context.fetch = async () => ({ok: false, json: async () => ({message: 'Scan failed'})});
  await vm.runInContext('scanOnboardingGaps()', context);
  assert.match(element('onboardingGaps').innerHTML, /role="alert"/);
  assert.equal(element('submit').textContent, 'Continue');
  context.fetch = async () => ({ok: true, json: async () => scan});
  await vm.runInContext('scanOnboardingGaps()', context);
  vm.runInContext('showOnboardingStep(0);showOnboardingStep(4)', context);
  assert.match(element('onboardingReview').innerHTML, /Open gaps \(1\)/);
  assert.equal(element('projectName').value, '<script>Project</script>');
  assert.match(element('onboardingReview').innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(element('onboardingReview').innerHTML, /<script>/);
  assert.match(element('onboardingReview').innerHTML, /No styles selected/);
  assert.equal(element('submit').textContent, 'Create project');
});

test('linked folder prompts to edit the existing project or replace the link', async () => {
  const {context, element, panels, labels} = setup();
  for (let n = 0; n < 5; n++) {
    panels.push({dataset: {wizardStep: String(n)}, hidden: false});
    labels.push({dataset: {wizardLabel: String(n)}, setAttribute() {}, removeAttribute() {}});
  }
  element('projectName').value = 'New';
  element('projectDescription').value = 'description';
  element('onboardingFolder').value = '/repo';
  element('onboardingLinkChoice').hidden = true;
  vm.runInContext('showOnboardingStep(0)', context);
  const existing = {
    projectId: 'p1',
    projectName: '<i>Old</i>',
    file: '/repo/.personal-brain.json',
    inFolder: true,
  };
  context.fetch = async () => ({ok: true, json: async () => ({folder: '/repo', existing})});
  await vm.runInContext('advanceOnboarding()', context);
  assert.equal(vm.runInContext('onboardingStep', context), 0, 'stays on the folder step');
  const panel = element('onboardingLinkChoice');
  assert.equal(panel.hidden, false);
  assert.equal(panel.focused, true);
  assert.match(panel.innerHTML, /&lt;i&gt;Old&lt;\/i&gt;/);
  assert.match(panel.innerHTML, /data-link-choice="edit"/);
  assert.match(panel.innerHTML, /data-link-choice="replace"/);

  context.fetch = async () => ({
    ok: true,
    json: async () => ({folder: '/repo', existing: {...existing, projectName: null}}),
  });
  await vm.runInContext('advanceOnboarding()', context);
  assert.doesNotMatch(
    panel.innerHTML,
    /data-link-choice="edit"/,
    'unknown projects cannot be edited',
  );

  vm.runInContext(`onboardingReplaceLink = ${JSON.stringify(existing)}`, context);
  await vm.runInContext('advanceOnboarding()', context);
  assert.equal(vm.runInContext('onboardingStep', context), 1, 'replace continues setup');
  vm.runInContext('showOnboardingStep(4)', context);
  assert.match(element('onboardingReview').innerHTML, /Replaces the link to “&lt;i&gt;Old/);
});

for (const [inputId, buttonId, errorId] of [
  ['onboardingFolder', 'browseOnboardingFolder', 'projectError'],
  ['repositoryFolder', 'browseRepositoryFolder', 'repositoryResult'],
]) {
  test(`${inputId}: native selection, cancellation and errors preserve the draft`, async () => {
    const {context, element} = setup();
    const input = element(inputId),
      button = element(buttonId);
    input.isConnected = true;
    button.isConnected = true;
    input.value = '/original';
    let changes = 0;
    input.dispatchEvent = () => changes++;
    context.Event = class {
      constructor(type) {
        this.type = type;
      }
    };
    vm.runInContext('api=async()=>({path:null})', context);
    await vm.runInContext(
      `openFolderBrowser(${JSON.stringify(inputId)},${JSON.stringify(buttonId)},${JSON.stringify(errorId)})`,
      context,
    );
    assert.equal(input.value, '/original');
    assert.equal(changes, 0);
    assert.equal(button.disabled, false);
    vm.runInContext('api=async()=>({path:"/chosen repository"})', context);
    await vm.runInContext(
      `openFolderBrowser(${JSON.stringify(inputId)},${JSON.stringify(buttonId)},${JSON.stringify(errorId)})`,
      context,
    );
    assert.equal(input.value, '/chosen repository');
    assert.equal(changes, 1);
    assert.equal(button.textContent, 'Browse folders');
    vm.runInContext('api=async()=>{throw new Error("Dialog unavailable")}', context);
    await vm.runInContext(
      `openFolderBrowser(${JSON.stringify(inputId)},${JSON.stringify(buttonId)},${JSON.stringify(errorId)})`,
      context,
    );
    assert.equal(input.value, '/chosen repository');
    assert.match(element(errorId).textContent, /Dialog unavailable/);
  });
}

test('unified AI analysis offers a scoped draft and preserves customization until accepted', async () => {
  const {context, element} = setup();
  let accept,
    request,
    allow = false;
  const checkbox = {checked: false, disabled: false},
    field = {value: 'Existing customization'};
  const button = {
    textContent: '',
    addEventListener(_, fn) {
      accept = fn;
    },
  };
  const proposal = {
    className: '',
    innerHTML: '',
    querySelector() {
      return button;
    },
  };
  const row = {
    dataset: {assignmentRow: 's'},
    querySelector(q) {
      if (q === '.assignment-choice') {
        return {after() {}};
      }
      return q === 'textarea' ? field : checkbox;
    },
  };
  element('projectForm').querySelectorAll = (q) => (q === '[data-assignment-row]' ? [row] : []);
  context.document.createElement = () => proposal;
  context.confirm = () => allow;
  context.fetch = async (url, options) => {
    request = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        recommendations: [
          {id: 's', reason: 'README.md', projectGuidelines: 'Use npm test (README.md).'},
        ],
        files: ['README.md'],
        issues: [],
        limited: false,
      }),
    };
  };
  vm.runInContext(
    'items=[{id:"s",title:"Coding",content:"Base rules"}];selectedProject={id:"p"};syncProjectSelection=()=>{};',
    context,
  );
  element('onboardingAgent').value = 'codex';
  await vm.runInContext('analyzeOnboarding()', context);
  assert.equal(request.projectId, 'p');
  assert.equal(field.value, 'Existing customization');
  assert.equal(checkbox.checked, false);
  accept();
  assert.equal(field.value, 'Existing customization');
  allow = true;
  accept();
  assert.equal(field.value, 'Base rules\n\nProject-specific guidelines\nUse npm test (README.md).');
  assert.equal(checkbox.checked, true);
  assert.equal(vm.runInContext('projectFormDirty', context), true);
});
