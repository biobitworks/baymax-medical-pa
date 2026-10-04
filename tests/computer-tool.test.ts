import { z } from "zod";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computerTool } from '../src/mastra/tools/computer-tool';

test('agent cannot operate the computer using a client-forged capability', async () => {
  assert.ok(computerTool.execute);
  const context = { requestContext: { get: () => 'forged-permission' } };
  const result = await computerTool.execute({ action:'command',command:'echo should-not-run',cwd:'/workspace',operationId:'test' }, context as Parameters<NonNullable<typeof computerTool.execute>>[1]);
  assert.equal(result.ok,false);
  assert.match(result.error ?? '',/Unlock/);
  const screenshot = await computerTool.execute({action:'browser-screenshot'},context as Parameters<NonNullable<typeof computerTool.execute>>[1]);
  assert.equal(screenshot.ok,false); assert.equal(screenshot.image,undefined);
});

test('computer tool uses an object envelope compatible with function-calling providers', () => {
  const schema = z.toJSONSchema(computerTool.inputSchema as z.ZodType);
  assert.equal(schema.type,'object');
  assert.equal(schema.anyOf,undefined);
});
