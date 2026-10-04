/** Real worker + Docker + private routes + Mastra tool. Requires installed worker deps/Chromium and built computer image. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { createWorkerServer } from '../services/browser-worker/src/server';
import { getComputerRuntime } from '../src/mastra/computer/runtime';
import { computerTool } from '../src/mastra/tools/computer-tool';
import { computerIdentity, runDocker } from '../src/mastra/computer/docker';

const dataDir = await mkdtemp(join(tmpdir(),'baymax-computer-api-'));
const deployment = 'smoke-api-'+randomUUID();
const key = randomBytes(32).toString('hex');
const token = randomBytes(32).toString('hex');
const worker = await createWorkerServer({token,dataDir:join(dataDir,'browser')});
await new Promise<void>(resolve => worker.server.listen(0,'127.0.0.1',resolve));
const address = worker.server.address();
assert(address && typeof address !== 'string');
Object.assign(process.env, {
  BAYMAX_COMPUTER_ENABLED:'true', BAYMAX_COMPUTER_ACCESS_KEY:key,
  BAYMAX_COMPUTER_ID:deployment, BAYMAX_COMPUTER_DATA_DIR:dataDir,
  BAYMAX_BROWSER_WORKER_URL:`http://127.0.0.1:${address.port}`, BAYMAX_BROWSER_WORKER_TOKEN:token,
});
const {handle,service} = getComputerRuntime();
let capability = '';
const req = (path:string,method='GET',body?:unknown,credential=capability) => new Request('http://localhost/computer/'+path,{method,headers:{Origin:'http://localhost',Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined});
async function action(body:unknown) { const response = await handle(req('actions','POST',body)); const data=await response.json(); assert.equal(response.status,200,JSON.stringify(data)); return data; }
try {
  assert.equal((await handle(req('status'))).status,401);
  const unlock = await handle(req('session','POST',undefined,key)); assert.equal(unlock.status,200);
  capability = (await unlock.json()).capability;
  await action({action:'start'});
  const context = new RequestContext([['computerCapability',capability]]);
  assert.ok(computerTool.execute);
  const result = await computerTool.execute({action:'command',command:'printf "care notes" > note.txt; cat note.txt',cwd:'/workspace',operationId:'write-note'}, {requestContext:context});
  assert.equal(result.ok,true);
  assert.equal((result.data as {stdout:string}).stdout,'care notes');
  const note = await action({action:'read',path:'/workspace/note.txt'}); assert.equal(note.text,'care notes');
  await action({action:'browse',url:'https://example.com'});
  const page = await action({action:'browser-read'}); assert.match(page.title,/Example Domain/);
  const screenshot = await computerTool.execute({action:'browser-screenshot'}, {requestContext:context});
  assert.equal(screenshot.ok,true); assert(screenshot.image);
  assert.equal(Buffer.from(screenshot.image,'base64').subarray(1,4).toString(),'PNG');
  assert.ok(computerTool.toModelOutput);
  const model = await computerTool.toModelOutput(screenshot);
  assert.equal(model.type,'content');
  assert(model.type==='content' && model.value.some(part=>part.type==='image-data'));
  const preview = await handle(req('screenshot')); assert.equal(preview.headers.get('content-type'),'image/png');
  await action({action:'browser-input',input:{type:'key',key:'Tab'}});
  await action({action:'browser-input',input:{type:'type',text:'fictional test'}});
  await handle(req('session','DELETE'));
  assert.equal((await handle(req('status'))).status,401);
  const rejected = await computerTool.execute({action:'status'}, {requestContext:context}); assert.equal(rejected.ok,false);
  console.log('Real Computer API + Mastra tool smoke passed: unlock, command, file, public browse, screenshot/image conversion, input, lock/revocation.');
} finally {
  await service.browser.close().catch(()=>{});
  await service.terminal.stop().catch(()=>{});
  const identity = computerIdentity({enabled:true,dataDir,computerDeploymentId:deployment,publicUrl:'http://localhost'},'baymax');
  await runDocker(['container','rm','--force',identity.container],{timeoutMs:10000});
  await runDocker(['volume','rm',identity.volume],{timeoutMs:10000});
  await worker.close();
  await rm(dataDir,{recursive:true,force:true});
}
