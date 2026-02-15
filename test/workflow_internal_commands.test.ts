import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { runWorkflowFile } from '../src/workflows/file.js';
import { createDefaultRegistry } from '../src/commands/registry.js';

test('workflow file can execute internal registry commands', async () => {
  const workflow = {
    name: 'internal-command-test',
    steps: [
      {
        id: 'step1',
        // 'where' is an internal command in the registry.
        // It expects an array of objects and filters them.
        command: "where 'id=1'",
        stdin: [{ id: 1, name: 'first' }, { id: 2, name: 'second' }]
      }
    ],
  };

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lobster-workflow-internal-'));
  const filePath = path.join(tmpDir, 'workflow.lobster');
  await fsp.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf8');

  const registry = createDefaultRegistry();

  const result = await runWorkflowFile({
    filePath,
    ctx: {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
      mode: 'tool',
      registry,
    },
  });

  assert.equal(result.status, 'ok');
  assert.deepEqual(result.output, [{ id: 1, name: 'first' }]);
});
