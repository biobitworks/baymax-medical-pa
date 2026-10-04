import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestContext } from '@mastra/core/request-context';
import { SensitiveDataFilter, deepClean } from '@mastra/observability';
import { computerTraceFilter } from '../src/mastra/computer/tracing';

test('computer capability is redacted from the actual serialized request context and existing secret filtering remains', () => {
  const context = new RequestContext([['computerCapability','private-capability'],['conversationId','chat-1']]);
  const span = {traceId:'test',attributes:{},metadata:{},input:{token:'private-token'},output:{},requestContext:deepClean(context)};
  const defaultFilter = new SensitiveDataFilter();
  defaultFilter.process(span as Parameters<typeof defaultFilter.process>[0]);
  const customFilter = computerTraceFilter();
  customFilter.process(span as Parameters<typeof customFilter.process>[0]);
  assert.doesNotMatch(JSON.stringify(span),/private-capability|private-token/);
  assert.match(JSON.stringify(span),/chat-1/);
});
