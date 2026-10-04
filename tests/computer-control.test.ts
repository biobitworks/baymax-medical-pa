import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputerControl } from '../src/mastra/computer/control';

test('takeover blocks agent mutations, enforces capability ownership, and releases on return/lock/expiry', async () => {
  let now = 0;
  const control = new ComputerControl(() => now);
  assert.deepEqual(control.status('a'), {owner:'baymax',isOwner:false,expiresAt:undefined,transitioning:false});
  await assert.rejects(control.run('user','a', async()=>1), /Take over/);
  assert.equal(await control.run('agent',undefined,async()=>1),1);
  await control.change('user','a');
  assert.equal(control.status('a').isOwner,true);
  assert.equal(control.status('b').isOwner,false);
  await assert.rejects(control.run('agent',undefined,async()=>1), /user has control/);
  await assert.rejects(control.run('user','b',async()=>1), /another session/);
  await assert.rejects(control.change('user','b'), /another session/);
  await assert.rejects(control.change('baymax','b'), /another session/);
  assert.equal(await control.run('user','a',async()=>2),2);
  await control.change('baymax','a');
  assert.equal(await control.run('agent',undefined,async()=>3),3);
  await control.change('user','a');
  now = 299999; await control.change('user','a');
  now = 300001; assert.equal(control.status('a').owner,'user');
  now = 600000; assert.equal(control.status('a').owner,'baymax');
  await control.change('user','a');
  await control.release('b'); assert.equal(control.status('a').owner,'user');
  await control.release('a'); assert.equal(control.status('a').owner,'baymax');
});

test('takeover cancels and awaits pending agent mutation before granting manual control', async () => {
  const control = new ComputerControl();
  let cancelled = false; let settle!:()=>void;
  const command = control.run('agent',undefined,signal => new Promise(resolve=> {
    signal.addEventListener('abort',()=>{cancelled=true; settle=()=>resolve('cancelled');},{once:true});
  }));
  let complete=false;
  const take = control.change('user','a').then(()=>{complete=true;});
  assert.equal(cancelled,true);
  assert.equal(complete,false);
  assert.equal(control.status('a').transitioning,true);
  await assert.rejects(control.run('user','a',async()=>1), /handoff/);
  settle(); await command; await take;
  assert.equal(control.status('a').transitioning,false);
  assert.equal(control.status('a').isOwner,true);
});

test('external cancellation is forwarded and pre-aborted jobs never dispatch', async () => {
  const control = new ComputerControl(); const abort = new AbortController(); abort.abort();
  let calls=0;
  await assert.rejects(control.run('agent',undefined,async()=>++calls,abort.signal),/interrupted/);
  assert.equal(calls,0);
});

test('private API handoff enforces ownership on the shared service and locking releases it', async () => {
  const { ComputerService } = await import('../src/mastra/computer/service');
  const { ComputerAccess } = await import('../src/mastra/computer/access');
  const { createComputerHandler } = await import('../src/mastra/computer/handler');
  let starts=0;
  const terminal={start:async()=>{starts++;return {state:'running'};},receipts:async()=>[],status:async()=>({state:'stopped'})};
  const browser={status:async()=>({configured:false}),settle:async()=>{}};
  const service=new ComputerService(terminal as ConstructorParameters<typeof ComputerService>[0],browser as ConstructorParameters<typeof ComputerService>[1],true);
  const access=new ComputerAccess('x'.repeat(32)); const first=access.unlock('x'.repeat(32)).capability; const second=access.unlock('x'.repeat(32)).capability;
  const handle=createComputerHandler(service,access,{origin:'https://baymax.example'});
  const req=(path:string,body:unknown,token=first,origin='https://baymax.example')=>new Request('https://baymax.example/computer/'+path,{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await handle(req('actions',{action:'start'}))).status,409);
  assert.equal((await handle(req('control',{owner:'user'},first,'https://evil.example'))).status,403);
  assert.equal((await handle(req('control',{owner:'bogus'}))).status,400);
  assert.equal((await handle(req('control',{owner:'user'}))).status,200);
  await assert.rejects(service.action({action:'start'}),/user has control/);
  assert.equal(starts,0);
  assert.equal((await handle(req('actions',{action:'start'},second))).status,409);
  assert.equal((await handle(req('actions',{action:'start'}))).status,200);
  assert.equal(starts,1);
  const locked=await handle(new Request('https://baymax.example/computer/session',{method:'DELETE',headers:{origin:'https://baymax.example',authorization:'Bearer '+first}}));
  assert.equal(locked.status,200);
  await service.action({action:'start'}); assert.equal(starts,2);
});


test('handoff waits for remote acknowledgement and failed acknowledgement blocks both actors until retry', async () => {
  let ack!:()=>void; let fail=false;
  const control=new ComputerControl(Date.now,()=>fail ? Promise.reject(new Error('worker lost')) : new Promise<void>(resolve=>{ack=resolve;}));
  let completed=false;
  const takeover=control.change('user','a').then(()=>{completed=true;});
  await Promise.resolve();
  assert.equal(completed,false); assert.equal(control.status('a').transitioning,true);
  ack(); await takeover;
  fail=true;
  await assert.rejects(control.change('baymax','a'),/could not be confirmed/);
  await assert.rejects(control.run('agent',undefined,async()=>1),/could not be confirmed/);
  await assert.rejects(control.run('user','a',async()=>1),/could not be confirmed/);
  fail=false;
  const retry=control.change('user','a'); await Promise.resolve(); ack(); await retry;
  assert.equal(await control.run('user','a',async()=>1),1);
});


test('an automatic renewal cannot retake control after return or expiry', async () => {
 let now=0; const control=new ComputerControl(()=>now);
 await control.change('user','a');
 assert.equal(control.renew('a').owner,'user');
 await control.change('baymax','a');
 assert.throws(()=>control.renew('a'),/no longer held/);
 assert.equal(control.status('a').owner,'baymax');
 await control.change('user','a'); now=300001;
 assert.throws(()=>control.renew('a'),/no longer held/);
});
