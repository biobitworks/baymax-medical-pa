import { ComputerControl } from './control';
import type { TerminalComputer } from './terminal';
import type { BrowserComputer } from './browser';
import { computerActionSchema, type ComputerAction } from './schema';

/** Both the UI and Mastra tools use this service, so there is only one computer. */
export class ComputerService {
  readonly control = new ComputerControl(Date.now, () => this.browser.settle());
  constructor(readonly terminal: TerminalComputer, readonly browser: BrowserComputer, readonly enabled: boolean) {}
  async status(capability?:string) {
    // Recovery may stop an interrupted sandbox; inspect status only after it finishes.
    const receipts = await this.terminal.receipts();
    const [terminal, browser] = await Promise.all([this.terminal.status(), this.browser.status()]);
    return { enabled: this.enabled, terminal, browser, receipts, control:this.control.status(capability) };
  }
  async action(input: ComputerAction, signal?: AbortSignal, actor:'agent'|'user' = 'agent', capability?:string) {
    if (!this.enabled) throw new Error('Baymax’s computer is disabled. Set BAYMAX_COMPUTER_ENABLED=true on the server.');
    if (signal?.aborted) throw new Error('Computer operation interrupted before execution.');
    const args = computerActionSchema.parse(input);
    const execute = async (operationSignal?:AbortSignal) => {
    switch (args.action) {
      case 'start': return this.terminal.start(operationSignal);
      case 'stop': return this.terminal.stop(operationSignal);
      case 'command': return this.terminal.execute(args, operationSignal);
      case 'list': case 'read': case 'mkdir': return this.terminal.file(args.action, args.path, undefined, operationSignal);
      case 'write': return this.terminal.file('write', args.path, args.text, operationSignal);
      case 'browse': return this.browser.navigate(args.url, operationSignal);
      case 'browser-read': return this.browser.read(operationSignal);
      case 'browser-input': return this.browser.input(args.input, operationSignal);
      case 'browser-close': return this.browser.close(operationSignal);
    }
    };
    if (['list','read','browser-read'].includes(args.action)) return execute(signal);
    return this.control.run(actor,capability,execute,signal);
  }
}
