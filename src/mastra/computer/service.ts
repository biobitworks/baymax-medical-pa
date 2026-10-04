import type { TerminalComputer } from './terminal';
import type { BrowserComputer } from './browser';
import { computerActionSchema, type ComputerAction } from './schema';

/** Both the UI and Mastra tools use this service, so there is only one computer. */
export class ComputerService {
  constructor(readonly terminal: TerminalComputer, readonly browser: BrowserComputer, readonly enabled: boolean) {}
  async status() {
    // Recovery may stop an interrupted sandbox; inspect status only after it finishes.
    const receipts = await this.terminal.receipts();
    const [terminal, browser] = await Promise.all([this.terminal.status(), this.browser.status()]);
    return { enabled: this.enabled, terminal, browser, receipts };
  }
  async action(input: ComputerAction, signal?: AbortSignal) {
    if (!this.enabled) throw new Error('Baymax’s computer is disabled. Set BAYMAX_COMPUTER_ENABLED=true on the server.');
    if (signal?.aborted) throw new Error('Computer operation interrupted before execution.');
    const args = computerActionSchema.parse(input);
    switch (args.action) {
      case 'start': return this.terminal.start();
      case 'stop': return this.terminal.stop();
      case 'command': return this.terminal.execute(args, signal);
      case 'list': case 'read': case 'mkdir': return this.terminal.file(args.action, args.path);
      case 'write': return this.terminal.file('write', args.path, args.text);
      case 'browse': return this.browser.navigate(args.url, signal);
      case 'browser-read': return this.browser.read(signal);
      case 'browser-input': return this.browser.input(args.input, signal);
      case 'browser-close': return this.browser.close(signal);
    }
  }
}
