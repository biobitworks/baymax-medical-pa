import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputerControl } from '../src/mastra/computer/control';
import { ComputerAccess } from '../src/mastra/computer/access';
import { createComputerHandler } from '../src/mastra/computer/handler';

test('computer routes require capabilities; malformed or cross-origin actions never execute', async () => {
  let calls = 0;
  const access = new ComputerAccess('x'.repeat(32));
  const fake = {enabled:true,control:new ComputerControl(),status:async()=>({enabled:true}),action:async()=>{calls++;return {ok:true}},browser:{screenshot:async()=>new Uint8Array([1])}};
  const handle = createComputerHandler(fake as Parameters<typeof createComputerHandler>[0],access,{origin:'https://baymax.example'});
  const req = (path:string,method='GET',token='',body?:unknown,origin='https://baymax.example') => new Request('https://baymax.example/computer/'+path,{method,headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:body ? JSON.stringify(body):undefined});
  assert.equal((await handle(req('status'))).status,401);
  const grant = await (await handle(req('session','POST','x'.repeat(32)))).json();
  assert.equal((await handle(req('actions','POST',grant.capability,{action:'command',command:'echo hi',operationId:'test'},'https://evil.example'))).status,403);
  assert.equal((await handle(req('actions','POST',grant.capability,{action:'write',path:'/workspace/a'}))).status,400);
  assert.equal(calls,0);
  const escapedFile = await handle(req('actions','POST',grant.capability,{action:'write',path:'/workspace/escaped.txt',text:'\"'.repeat(256*1024)}));
  assert.equal(escapedFile.status,200,'256 KiB files remain supported after JSON escaping');
  assert.equal(calls,1);
  const response = await handle(req('actions','POST',grant.capability,{action:'command',command:'echo hi',operationId:'test'}));
  assert.equal(response.status,200); assert.equal(calls,2); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await handle(req('screenshot','GET',grant.capability))).headers.get('content-type'),'image/png');
  await handle(req('session','DELETE',grant.capability));
  assert.equal((await handle(req('status','GET',grant.capability))).status,401);
});


test('revoking a capability while its request body streams prevents late control or action dispatch', async () => {
  const access=new ComputerAccess('x'.repeat(32)); let calls=0;
  const fake={enabled:true,control:new ComputerControl(),status:async()=>({enabled:true}),action:async()=>{calls++;},browser:{screenshot:async()=>new Uint8Array([1])}};
  const handle=createComputerHandler(fake as Parameters<typeof createComputerHandler>[0],access,{origin:'https://baymax.example'});
  for (const path of ['control','actions']) {
    const grant=access.unlock('x'.repeat(32)); let finish!:()=>void;
    const body=new ReadableStream<Uint8Array>({start(controller){finish=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify(path==='control' ? {owner:'user'} : {action:'start'})));controller.close();};}});
    const request=new Request('https://baymax.example/computer/'+path,{method:'POST',headers:{origin:'https://baymax.example',authorization:'Bearer '+grant.capability,'content-type':'application/json'},body,duplex:'half'} as RequestInit);
    const pending=handle(request); access.revoke(grant.capability); finish();
    assert.equal((await pending).status,401);
    assert.equal(fake.control.status(grant.capability).owner,'baymax');
  }
  assert.equal(calls,0);
});
