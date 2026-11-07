import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        innerHTML: '',
        textContent: '',
        listeners: {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        focus() {},
      });
    }
    return elements.get(id);
  };
  const inputs = [
    {value: 'common', checked: false, disabled: false},
    {value: 'python', checked: true, disabled: false},
    {value: 'skill', checked: false, disabled: false},
    {value: 'legacy', checked: false, disabled: false},
  ];
  const context = vm.createContext({
    document: {
      getElementById: element,
      addEventListener() {},
      querySelectorAll(query) {
        return query === 'input[name="assignment"]' ? inputs : [];
      },
    },
    setTimeout,
    clearTimeout,
    console,
  });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  vm.runInContext(
    `
    items = [
      {id:'common', kind:'preference', domain:'engineering', title:'Common', summary:'Baseline', content:'Rules', tags:[], requiredIds:[], externalSkills:['review-tool']},
      {id:'python', kind:'preference', domain:'engineering', title:'Python <safe>', summary:'Python rules', content:'<script>unsafe</script>', tags:['python'], requiredIds:['common'], skillBindings:[{name:'review-tool'}]},
      {id:'skill', kind:'skill', domain:'writing', title:'Document helper', summary:'Writing procedure', content:'Procedure', tags:[], requiredIds:[]},
      {id:'legacy', kind:'preference', domain:'engineering', title:'Old standard', compatibility:true, summary:'Legacy', content:'Old rules', tags:[]}
    ];
    renderConfiguration();
  `,
    context,
  );
  return {context, element, inputs};
}

test('configuration filters retain selections and show deduplicated inherited references', () => {
  const {context, element, inputs} = fixture();
  assert.match(element('configurationSelected').innerHTML, /Required dependency/);
  assert.match(element('configurationSelected').innerHTML, /Python &lt;safe&gt;/);
  assert.equal(
    (element('configurationSkills').innerHTML.match(/<strong>review-tool<\/strong>/g) || []).length,
    1,
  );
  assert.doesNotMatch(element('configurationOptions').innerHTML, /Old standard|<script>/);
  assert.match(
    element('configurationOptions').innerHTML,
    /data-configuration-select="common" checked disabled/,
  );
  element('configurationKind').value = 'skill';
  vm.runInContext('renderConfiguration()', context);
  assert.match(element('configurationOptions').innerHTML, /Document helper/);
  assert.doesNotMatch(element('configurationOptions').innerHTML, /Python &lt;safe&gt;/);
  assert.equal(inputs[1].checked, true);
  element('configurationSearch').value = 'no match';
  vm.runInContext('renderConfiguration()', context);
  assert.match(element('configurationOptions').innerHTML, /No matching Library items/);
  assert.match(element('configurationSelected').innerHTML, /Python &lt;safe&gt;/);
});

test('configuration uses saved assignment controls and respects conflicting selections', () => {
  const {context, inputs, element} = fixture();
  vm.runInContext(
    'syncProjectSelection = () => renderConfiguration(); setConfigurationSelection("skill", true)',
    context,
  );
  assert.equal(inputs[2].checked, true);
  assert.equal(vm.runInContext('projectFormDirty', context), true);
  vm.runInContext('setConfigurationSelection("python", false)', context);
  assert.equal(inputs[1].checked, false);
  assert.doesNotMatch(element('configurationSelected').innerHTML, /Required dependency/);
  inputs[1].disabled = true;
  vm.runInContext('setConfigurationSelection("python", true)', context);
  assert.equal(inputs[1].checked, false);
});

test('configuration closure handles cycles once and setup labels follow all five steps', () => {
  const {context} = fixture();
  vm.runInContext('items[0].requiredIds = ["python"]', context);
  assert.equal(vm.runInContext('configurationRecords(["python"]).length', context), 2);
  assert.equal(
    vm.runInContext('onboardingSubmitLabel(discoveryStep)', context),
    'Continue to configure',
  );
  assert.equal(vm.runInContext('onboardingSubmitLabel(reviewStep)', context), 'Create project');
  assert.equal(vm.runInContext('reviewStep', context), 4);
});

test('configuration preserves and edits accepted overrides without rebuilding the focused field', () => {
  const {context, element} = fixture();
  element('override-python').value = 'Accepted AI draft <safe>';
  vm.runInContext('renderConfiguration(); bindConfiguration()', context);
  assert.match(element('configurationOptions').innerHTML, /Accepted AI draft &lt;safe&gt;/);
  assert.match(element('configurationOptions').innerHTML, /Customize for this project/);
  vm.runInContext(
    'syncProjectSelection = (refresh) => { globalThis.refreshed = refresh; }',
    context,
  );
  element('configurationOptions').listeners.input({
    target: {
      dataset: {configurationOverride: 'python'},
      value: 'Edited project instructions',
    },
  });
  assert.equal(element('override-python').value, 'Edited project instructions');
  assert.equal(context.refreshed, false);
  element('configurationSearch').value = 'no match';
  vm.runInContext('renderConfiguration()', context);
  element('configurationSearch').value = '';
  vm.runInContext('renderConfiguration()', context);
  assert.match(element('configurationOptions').innerHTML, /Edited project instructions/);
});
