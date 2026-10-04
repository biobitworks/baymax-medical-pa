import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCareWorkspace } from '../src/persistence/use-care-workspace';
import { createWorkspace, type CareWorkspace } from '../src/shared/workspace';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).window = new EventTarget();
const settle = () => new Promise(resolve => setTimeout(resolve, 450));

test('restores after remount, saves edited fields, revokes memory, and resets', async () => {
  let remote: CareWorkspace | null = null;
  let revision = 0;
  const methods: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const method = init?.method ?? 'GET';
    methods.push(method);
    if (method === 'PUT') { const body = JSON.parse(init!.body as string); remote = body.state; revision++; return Response.json({ revision }); }
    if (method === 'DELETE') { remote = null; revision = 0; return Response.json({ deleted: true }); }
    return Response.json({ state: remote, revision });
  };
  let hook!: ReturnType<typeof useCareWorkspace>;
  function Harness() { hook = useCareWorkspace(); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    assert.equal(hook.loading, false);
    await act(async () => { hook.setField('name', 'Synthetic user'); hook.setField('ready', true); });
    await act(async () => { await settle(); });
    assert.equal(methods.filter(method => method === 'PUT').length, 0, 'No save before memory consent');
    await act(async () => { await hook.changeMemory(true); });
    await act(async () => { await settle(); });
    assert.equal(remote?.name, 'Synthetic user');
    await act(async () => { renderer.unmount(); });
    await act(async () => { renderer = create(React.createElement(Harness)); });
    assert.equal(hook.workspace.name, 'Synthetic user');
    assert.equal(hook.workspace.ready, true);
    await act(async () => { hook.setField('water', 7); hook.setField('brief', 'Synthetic edited brief'); });
    await act(async () => { await settle(); });
    assert.equal(remote?.water, 7);
    await act(async () => { await hook.changeMemory(false); });
    assert.equal(remote, null);
    assert.equal(hook.workspace.water, 7, 'Turning memory off preserves this visit');
    assert.equal(hook.workspace.remember, false);
    await act(async () => { await hook.reset(); });
    assert.deepEqual(hook.workspace, createWorkspace());
  } finally { await act(async () => { renderer?.unmount(); }); globalThis.fetch = originalFetch; }
});

test('a failed restore prevents writes and a retry loads the saved state', async () => {
  const originalFetch = globalThis.fetch;
  let failed = true;
  const methods: string[] = [];
  const saved = { ...createWorkspace(), name: 'Restored user', ready: true, remember: true };
  globalThis.fetch = async (_url, init) => { methods.push(init?.method ?? 'GET'); return failed ? new Response('', { status: 503 }) : Response.json({ state: saved, revision: 2 }); };
  let hook!: ReturnType<typeof useCareWorkspace>;
  function Harness() { hook = useCareWorkspace(); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    assert.equal(hook.loadError, true);
    await act(async () => { await settle(); });
    assert.deepEqual(methods, ['GET']);
    failed = false;
    await act(async () => { await hook.retry(); });
    assert.equal(hook.workspace.name, 'Restored user');
    assert.equal(hook.loadError, false);
  } finally { await act(async () => { renderer?.unmount(); }); globalThis.fetch = originalFetch; }
});

test('retrying a failed memory deletion deletes rather than saving again', async () => {
  const originalFetch = globalThis.fetch;
  let remote: CareWorkspace | null = { ...createWorkspace(), ready: true, remember: true };
  let failDeletion = true;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const method = init?.method ?? 'GET'; methods.push(method);
    if (method === 'DELETE') { if (failDeletion) return new Response('', { status: 503 }); remote = null; return Response.json({ deleted: true }); }
    if (method === 'PUT') return Response.json({ revision: 2 });
    return Response.json({ state: remote, revision: 1 });
  };
  let hook!: ReturnType<typeof useCareWorkspace>;
  function Harness() { hook = useCareWorkspace(); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    await act(async () => { await hook.changeMemory(false); });
    assert.ok(remote);
    assert.equal(hook.workspace.remember, true);
    failDeletion = false;
    await act(async () => { await hook.retry(); });
    assert.equal(remote, null);
    assert.deepEqual(methods, ['GET', 'DELETE', 'DELETE']);
  } finally { await act(async () => { renderer?.unmount(); }); globalThis.fetch = originalFetch; }
});

test('failed memory deletion keeps autosaves paused during subsequent edits', async () => {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const method = init?.method ?? 'GET'; methods.push(method);
    if (method === 'DELETE') return new Response('', { status: 503 });
    if (method === 'PUT') return Response.json({ revision: 2 });
    return Response.json({ state: { ...createWorkspace(), ready: true, remember: true }, revision: 1 });
  };
  let hook!: ReturnType<typeof useCareWorkspace>;
  function Harness() { hook = useCareWorkspace(); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    await act(async () => { await hook.changeMemory(false); });
    await act(async () => { hook.setField('water', 8); });
    await act(async () => { await settle(); });
    assert.deepEqual(methods, ['GET', 'DELETE']);
    assert.match(hook.error, /delete/);
  } finally { await act(async () => { renderer?.unmount(); }); globalThis.fetch = originalFetch; }
});

test('restore retry is single flight so late reads cannot overwrite edits', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveRead!: (response: Response) => void;
  globalThis.fetch = async () => { calls++; if (calls === 1) return new Response('', { status: 503 }); return new Promise(resolve => { resolveRead = resolve; }); };
  let hook!: ReturnType<typeof useCareWorkspace>;
  function Harness() { hook = useCareWorkspace(); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => { first = hook.retry(); second = hook.retry(); });
    assert.equal(calls, 2, 'Only one retry GET is made');
    await act(async () => { resolveRead(Response.json({ state: createWorkspace(), revision: 0 })); await Promise.all([first, second]); });
    await act(async () => { hook.setField('water', 7); });
    assert.equal(hook.workspace.water, 7);
  } finally { await act(async () => { renderer?.unmount(); }); globalThis.fetch = originalFetch; }
});
