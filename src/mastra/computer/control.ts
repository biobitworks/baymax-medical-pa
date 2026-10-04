import { createHash } from 'node:crypto';
const ownerId = (capability: string) => createHash('sha256').update(capability).digest('hex');
const leaseMs = 5 * 60 * 1000;
export class ComputerControlError extends Error {}

/** A manual-control lease applies to the shared computer, not just one UI tab. */
export class ComputerControl {
  private lease?: {owner:string; expiresAt:number};
  private transitioning = false;
  private failed = false;
  private pending?:Promise<void>;
  private active = new Set<{actor:'user'|'agent'; controller:AbortController; settled:Promise<void>}>();
  constructor(private now:()=>number = Date.now, private settle?:()=>Promise<void>) {}
  status(capability?:string) {
    this.expire();
    return {owner:this.lease ? 'user' as const : 'baymax' as const, isOwner:!!(capability && this.lease?.owner === ownerId(capability)), expiresAt:this.lease?.expiresAt, transitioning:this.transitioning, ...(this.failed ? {error:"Computer handoff could not be confirmed. Take over again to retry."} : {})};
  }
  async change(owner:'user'|'baymax', capability:string) {
    this.expire();
    if (this.transitioning) throw new ComputerControlError('Computer handoff is still in progress. Refresh before continuing.');
    const id=ownerId(capability);
    if (this.lease && this.lease.owner !== id) throw new ComputerControlError('The computer is controlled by another session. Wait for it to return control.');
    if (owner === 'baymax' && !this.lease && !this.failed) return this.status(capability);
    if (owner === 'user' && this.lease?.owner === id && !this.failed) { this.lease.expiresAt=this.now()+leaseMs; return this.status(capability); }
    this.lease = owner === 'user' ? {owner:id,expiresAt:this.now()+leaseMs} : undefined;
    await this.interrupt(true);
    return this.status(capability);
  }
  renew(capability:string) {
    this.expire();
    if (this.transitioning || this.failed || !this.lease || this.lease.owner !== ownerId(capability)) throw new ComputerControlError('Manual control is no longer held by this session. Take over again to continue.');
    this.lease.expiresAt=this.now()+leaseMs;
    return this.status(capability);
  }
  async release(capability:string) {
    if (this.lease?.owner === ownerId(capability)) {
      this.lease=undefined;
      await this.interrupt(true);
    }
  }
  async run<T>(actor:'user'|'agent', capability:string|undefined, operation:(signal:AbortSignal)=>Promise<T>, signal?:AbortSignal):Promise<T> {
    this.expire();
    if (signal?.aborted) throw new ComputerControlError('Computer operation interrupted before execution.');
    if (this.transitioning) throw new ComputerControlError('Computer handoff is still in progress. Refresh before continuing.');
    if (this.failed) throw new ComputerControlError('Computer handoff could not be confirmed. Take over again before making changes.');
    if (actor === 'agent' && this.lease) throw new ComputerControlError('The user has control of the computer. Wait until they return control; do not retry computer actions.');
    if (actor === 'user' && (!this.lease || !capability || this.lease.owner !== ownerId(capability))) throw new ComputerControlError(this.lease ? 'The computer is controlled by another session.' : 'Take over the computer before making changes.');
    const controller=new AbortController();
    const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    let resolve!:()=>void;
    const job={actor,controller,settled:new Promise<void>(done=>{resolve=done;})};
    this.active.add(job);
    try { return await operation(controller.signal); }
    finally { signal?.removeEventListener('abort',abort); this.active.delete(job); resolve(); }
  }
  private expire() {
    if (this.lease && this.lease.expiresAt <= this.now()) {
      this.lease=undefined;
      // Do not admit another mutation until any old manual operation settles.
      void this.interrupt(true).catch(() => { /* Failed settlement blocks mutations until an explicit retry. */ });
    }
  }
  private interrupt(barrier = false):Promise<void> {
    if (this.pending) return this.pending;
    const jobs=[...this.active];
    if (!jobs.length && (!barrier || !this.settle)) return Promise.resolve();
    let resolve!:()=>void; let reject!:(error:Error)=>void;
    const pending=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
    this.pending=pending;
    this.transitioning=true;
    for (const job of jobs) job.controller.abort();
    void (async () => {
      try {
        await Promise.all(jobs.map(job=>job.settled));
        if (barrier) await this.settle?.();
        if (barrier) this.failed=false;
        resolve();
      } catch {
        this.failed=true;
        reject(new ComputerControlError('Computer handoff could not be confirmed. Check the browser worker and take over again.'));
      } finally {
        this.transitioning=false;
        this.pending=undefined;
      }
    })();
    return pending;
  }
}
