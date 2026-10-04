import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TerminalComputer } from '../src/mastra/computer/terminal.js';
import { computerIdentity, computerOutput, workspacePath, type DockerRunner, type DockerResult } from '../src/mastra/computer/docker.js';
const ok = (stdout = ''): DockerResult => ({ stdout, stderr: '', exitCode: 0, timedOut: false, interrupted: false, truncated: false });
async function fixture() {
 const config = { enabled: true, dataDir: await mkdtemp(join(tmpdir(), 'baymax-terminal-')), publicUrl: 'http://localhost:4111', computerDeploymentId: 'test' };
 const identity = computerIdentity(config);
 const inspection = { Id:'x', Name:`/${identity.container}`, Config: { Image:'baymax-computer:local', User:'1000:1000', Labels:identity.labels, Env:['HOME=/workspace','PATH=/usr/bin'], Entrypoint:['/usr/bin/sleep'], Cmd:['infinity'], WorkingDir:'/workspace' }, HostConfig: { ReadonlyRootfs:true, Privileged:false, CapDrop:['ALL'], CapAdd:null, SecurityOpt:['no-new-privileges'], NetworkMode:'none', Memory:536870912, MemorySwap:536870912, PidsLimit:128, NanoCpus:1000000000, Binds:null, Devices:null, DeviceRequests:null, PortBindings:null, PidMode:'', IpcMode:'private', Tmpfs:{'/tmp':'rw,nosuid,nodev,noexec,size=67108864,mode=1777'}, RestartPolicy:{Name:'no'} }, Mounts:[{Type:'volume',Name:identity.volume,Destination:'/workspace',RW:true}], NetworkSettings:{Networks:{none:{}}}, State:{Running:true} };
 const calls: {args:string[];options:Parameters<DockerRunner>[1]}[] = [];
 let executeResult = ok('hello');
 const docker: DockerRunner = async (args, options) => { calls.push({args,options}); if(args[0] === 'exec') return args.includes('/usr/bin/python3') ? ok('{"path":"/workspace/a","text":"hello"}') : executeResult; if(args[0]==='container' && args[1]==='ls') return ok('x'); if(args[0]==='container' && args[1]==='inspect') return ok(JSON.stringify([inspection])); if(args[0]==='volume' && args[1]==='inspect') return ok(JSON.stringify([{Name:identity.volume,Labels:identity.labels,Driver:'local',Options:null,Scope:'local'}])); if(args[0]==='container' && args[1]==='stop') inspection.State.Running=false; if(args[0]==='container' && args[1]==='start') inspection.State.Running=true; return ok(); };
 return {config,inspection,calls,docker,service:new TerminalComputer(config,docker),setResult:(r:DockerResult)=>executeResult=r};
}
test('workspace boundaries and shared output cap', () => {
 for(const path of ['/etc','/workspace-escape','/workspace/../etc','/workspace/\0x']) assert.throws(()=>workspacePath(path));
 assert.equal(workspacePath('/workspace/a/./b'),'/workspace/a/b');
 const capture=computerOutput(5); capture.stdout('abc');capture.stderr('def');const result=capture.finish(); assert.equal(result.stdout,'abc');assert.equal(result.stderr,'de');assert.equal(result.truncated,true);
});
test('disabled services refuse every operation without invoking Docker', async () => {
 const f=await fixture(); const service=new TerminalComputer({...f.config,enabled:false},f.docker);
 for(const call of [()=>service.status(),()=>service.start(),()=>service.stop(),()=>service.receipts(),()=>service.file('list','/workspace'),()=>service.execute({command:'id',operationId:'x'})]) assert.throws(call,/disabled/);
 assert.equal(f.calls.length,0);
});
test('Docker isolation mismatch refuses terminal and files', async () => {
 const f=await fixture(); f.inspection.HostConfig.NetworkMode='host';
 await assert.rejects(f.service.execute({command:'id',operationId:'x'}),/isolation/);
 await assert.rejects(f.service.file('read','/workspace/a'),/isolation/);
 assert.equal(f.calls.some(c=>c.args[0]==='exec'),false);
});
test('commands use container argv, file data uses stdin, receipts survive recreation', async () => {
 const f=await fixture(); const input={command:'echo "$(touch /host-danger)"',cwd:'/workspace',operationId:'one'};
 const receipt=await f.service.execute(input); assert.equal(receipt.status,'succeeded');
 const exec=f.calls.find(c=>c.args[0]==='exec')!; assert.equal(exec.args.at(-1),input.command);assert.ok(exec.args.includes('30s'));assert.equal(exec.options.timeoutMs,35000);
 await f.service.file('write','/workspace/a','$(host shell)'); const file=f.calls.find(c=>c.args.includes('/usr/bin/python3'))!; assert.equal(JSON.parse(file.options.input!).text,'$(host shell)');
 const recreated=new TerminalComputer(f.config,f.docker); assert.deepEqual(await recreated.execute(input),receipt);assert.equal(f.calls.filter(c=>c.args[0]==='exec' && !c.args.includes('/usr/bin/python3')).length,1);
 await assert.rejects(recreated.execute({...input,command:'different'}),/different command/);
});
test('failed exits and timeouts are honest and stop sandbox', async () => {
 const f=await fixture();f.setResult({...ok(),exitCode:2,stderr:'bad'}); const failed=await f.service.execute({command:'false',operationId:'failed'});assert.equal(failed.status,'failed'); assert.equal(failed.exitCode,2);
 f.setResult({...ok('partial'),exitCode:124}); const timed=await f.service.execute({command:'sleep 60',operationId:'timed'});assert.equal(timed.timedOut,true);assert.equal(timed.status,'timed_out');assert.equal(f.inspection.State.Running,false);
});
test('durable uncertain intent is never replayed after service restart', async () => {
 const f=await fixture();const input={command:'touch once',operationId:'uncertain'}; const receipt=await f.service.execute(input);
 const deployments=await readdir(join(f.config.dataDir,'computer-receipts')); const path=join(f.config.dataDir,'computer-receipts',deployments[0],'commands.json'); const stored=JSON.parse(await readFile(path,'utf8'));stored[0].status='running';await writeFile(path,JSON.stringify(stored));
 const recovered=await new TerminalComputer(f.config,f.docker).execute(input);assert.equal(recovered.id,receipt.id);assert.equal(recovered.interrupted,true);assert.equal(recovered.exitCode,null);assert.equal(f.inspection.State.Running,false);assert.equal(f.calls.filter(c=>c.args[0]==='exec').length,1);
});
test('concurrent operation IDs serialize and execute once',async()=>{const f=await fixture();const input={command:'id',operationId:'same'};const [a,b]=await Promise.all([f.service.execute(input),f.service.execute(input)]);assert.deepEqual(a,b);assert.equal(f.calls.filter(c=>c.args[0]==='exec').length,1);});
test('unknown Docker result stops container and quarantine prevents further exec until stop succeeds',async()=>{
 const f=await fixture(); let failStop=true;
 const runner: DockerRunner=async(args,options)=> {if(args[0]==='container' && args[1]==='stop' && failStop) return {...ok(),exitCode:1};return f.docker(args,options);};
 f.setResult({...ok(),exitCode:null,interrupted:true});const service=new TerminalComputer(f.config,runner);
 const receipt=await service.execute({command:'sleep 60',operationId:'unknown'});assert.equal(receipt.cleanupRequired,true);assert.match(receipt.stderr,/blocked/);
 await assert.rejects(service.execute({command:'id',operationId:'next'}),/Docker operation failed/);assert.equal(f.calls.filter(c=>c.args[0]==='exec').length,1);
 failStop=false;assert.equal((await service.stop()).state,'stopped');
});
test('ownership labels and host binds cannot be attached',async()=>{
 for(const mutate of [(f:Awaited<ReturnType<typeof fixture>>)=>{f.inspection.Config.Labels['dev.baymax.owner']='foreign';},(f:Awaited<ReturnType<typeof fixture>>)=>{(f.inspection.HostConfig as any).Binds=['/host:/workspace'];}]) {
  const f=await fixture();mutate(f);await assert.rejects(f.service.start(),/isolation/);assert.equal(f.calls.some(c=>c.args[0]==='exec'||c.args[1]==='start'),false);
 }
});
