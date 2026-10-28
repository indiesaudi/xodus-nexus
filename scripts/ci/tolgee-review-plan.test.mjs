import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDigest, reviewPlan, validatePlan } from '../tolgee-review-plan.mjs';

const english = { hello: 'Hello {{name}}', runtime: 'Runtime {{version}}' };
const plan = () => [{ language: 'fr', key: 'hello', source: english.hello, suggestion: 'Bonjor {name}',
  translation: 'Bonjour {{name}}', previous: null, previousState: 'UNTRANSLATED' }];
const clone = value => structuredClone(value);
const page = (name, values) => ({ _embedded: { [name]: values }, page: { number: 0, totalPages: 1, totalElements: values.length } });
function fixture(change) {
  const row = { keyId: 10, keyName: 'hello', keyNamespace: null, keyIsPlural: false, branch: 'main', translations: {
    en: { text: 'Hello {name}' }, fr: { id: 20, text: null, state: 'UNTRANSLATED', outdated: false, unresolvedCommentCount: 0, qaIssueCount: 0,
      suggestions: [{ id: 30, state: 'ACTIVE', translation: 'Bonjor {name}', isPlural: false }] } } };
  const calls = []; let views = 0;
  const api = async (route, method = 'GET', body) => {
    calls.push({ route, method, body });
    if (route.includes('/languages?')) return page('languages', [{ id: 1, tag: 'en', base: true }, { id: 2, tag: 'fr', base: false }]);
    if (route.includes('/translations?')) { views++; change?.(row, views); return page('keys', [clone(row)]); }
    if (route.includes('/suggestion/30/accept?declineOther=false')) {
      row.translations.fr.text = 'Bonjor {name}'; row.translations.fr.state = 'TRANSLATED';
      row.translations.fr.id = 20;
      return { accepted: { ...row.translations.fr.suggestions[0], keyId: 10, languageId: 2, state: 'ACCEPTED' }, declined: [] };
    }
    if (route === '/v2/projects/36162/translations' && method === 'PUT') {
      assert.deepEqual(body, { key: 'hello', namespace: null, translations: { fr: 'Bonjour {name}' } });
      row.translations.fr.text = body.translations.fr;
      return clone(row);
    }
    if (route.endsWith('/20/set-state/REVIEWED')) { row.translations.fr.state = 'REVIEWED'; return clone(row.translations.fr); }
    throw Error('Unexpected fixture operation.');
  };
  return { api, calls, row };
}

test('explicit reviewed plan accepts the chosen author suggestion, corrects a typo and verifies Reviewed', async () => {
  const f = fixture(), selected = plan();
  const report = await reviewPlan({ api: f.api, english, plan: selected, digest: planDigest(selected), apply: true });
  assert.equal(report.accepted, 1); assert.equal(report.corrected, 1); assert.equal(report.reviewed, 1);
  assert.equal(f.row.translations.en.text, 'Hello {name}');
  assert.equal(f.row.translations.fr.text, 'Bonjour {name}');
  assert.equal(f.row.translations.fr.state, 'REVIEWED');
  assert.equal(f.calls.filter(call => call.method === 'PUT').length, 3);
  assert.doesNotMatch(JSON.stringify(report), /keyId|languageId|suggestionId|Bonjor|Bonjour/);
});

test('preview and changed digest never mutate translations', async () => {
  const f = fixture(), selected = plan();
  assert.equal((await reviewPlan({ api: f.api, english, plan: selected, digest: planDigest(selected) })).reviewed, 0);
  assert.ok(f.calls.every(call => call.method === 'GET'));
  await assert.rejects(reviewPlan({ api: f.api, english, plan: selected, digest: '0'.repeat(64), apply: true }), /digest/);
  assert.ok(f.calls.every(call => call.method === 'GET'));
});

test('explicit exact existing-text selections recover a partial batch without accepting anything twice', async () => {
  const f = fixture(), selected = plan();
  f.row.translations.fr.text = 'Bonjor {name}'; f.row.translations.fr.state = 'TRANSLATED'; f.row.translations.fr.suggestions = [];
  selected[0] = { ...selected[0], previous: 'Bonjor {name}', previousState: 'TRANSLATED', existing: true };
  const report = await reviewPlan({ api: f.api, english, plan: selected, digest: planDigest(selected), apply: true });
  assert.equal(report.accepted, 0); assert.equal(report.corrected, 1); assert.equal(report.reviewed, 1);
  assert.ok(f.calls.every(call => !call.route.includes('/accept')));
  assert.throws(() => validatePlan([{ ...selected[0], previous: 'Other' }], english));
  assert.throws(() => validatePlan([{ ...selected[0], previousState: 'UNTRANSLATED' }], english));
});

test('official simple view model permits an absent untranslated cell ID but receipts still require full identity', async () => {
  const f = fixture(), selected = plan(); f.row.translations.fr.id = null;
  assert.equal((await reviewPlan({ api: f.api, english, plan: selected, digest: planDigest(selected), apply: true })).reviewed, 1);
  const bad = fixture();
  const api = async (...args) => { const result = await bad.api(...args); if (result.accepted) delete result.accepted.keyId; return result; };
  await assert.rejects(reviewPlan({ api, english, plan: selected, digest: planDigest(selected), apply: true }), /receipt/);
  assert.equal(bad.row.translations.fr.state, 'TRANSLATED');
});

test('source, parameters, protected names, whitespace, duplicate keys and English targets remain guarded', () => {
  for (const change of [p => { p[0].source = 'Other'; }, p => { p[0].language = 'en'; }, p => { p[0].translation = 'Bonjour'; },
    p => { p[0].translation = ' Bonjour {{name}}'; }, p => { p.push(clone(p[0])); }, p => { p[0].translation = '<b>{{name}}</b>'; }]) {
    const selected = plan(); change(selected); assert.throws(() => validatePlan(selected, english));
  }
  assert.throws(() => validatePlan([{ ...plan()[0], source: 'Xbox {{name}}' }], { hello: 'Xbox {{name}}' }));
  validatePlan([{ language: 'fr', key: 'runtime', source: english.runtime, suggestion: 'Runtime {version}', translation: english.runtime,
    previous: null, previousState: 'UNTRANSLATED' }], english);
});

test('changed source, flags, comments, plurals, current values and candidate identity fail before writes', async () => {
  for (const mutate of [r => { r.translations.en.text = 'Other {name}'; }, r => { r.translations.fr.outdated = true; },
    r => { r.translations.fr.unresolvedCommentCount = 1; }, r => { r.translations.fr.qaIssueCount = 1; }, r => { r.keyIsPlural = true; },
    r => { r.translations.fr.text = 'Already edited'; }, r => { r.translations.fr.suggestions[0].id = -1; },
    r => { r.translations.fr.suggestions[0].keyId = 99; }, r => { r.translations.fr.suggestions[0].languageId = 99; }]) {
    const f = fixture((row, views) => { if (views === 2) mutate(row); }), selected = plan();
    await assert.rejects(reviewPlan({ api: f.api, english, plan: selected, digest: planDigest(selected), apply: true }));
    assert.ok(f.calls.every(call => call.method === 'GET'));
  }
});

test('uncertain mutation stops without retry or marking any translation Reviewed', async () => {
  const f = fixture(), selected = plan(); let writes = 0;
  const api = (route, method, body) => { if (method === 'PUT') { writes++; throw Error('Synthetic transport failure'); } return f.api(route, method, body); };
  await assert.rejects(reviewPlan({ api, english, plan: selected, digest: planDigest(selected), apply: true }));
  assert.equal(writes, 1);
  assert.equal(f.row.translations.fr.state, 'UNTRANSLATED');
});
