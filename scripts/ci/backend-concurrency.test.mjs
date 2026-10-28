import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const yaml = createRequire(import.meta.url)('js-yaml');

test('skipped source-only backend workflows cannot cancel an active main candidate', () => {
  const workflow = yaml.load(fs.readFileSync('.github/workflows/backend.yml', 'utf8'));
  assert.equal(workflow.concurrency.group, "backend-${{ github.event_name == 'push' && contains(github.event.head_commit.message, '[source-only]') && github.run_id || github.ref }}");
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.equal(workflow.jobs.build.if, "github.ref == 'refs/heads/main' && !contains(github.event.head_commit.message, '[source-only]')");
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
});
