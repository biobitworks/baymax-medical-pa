export type BrowserSession = {
  id: string;
  title: string;
  url: string;
  status: "active" | "closed" | "error";
};

const errors: Record<string, string> = {
  BLOCKED_URL: "Only public HTTP(S) destinations on ports 80 and 443 are allowed.",
  DNS_UNAVAILABLE: "The browser destination could not be resolved.",
  NAVIGATION_FAILED: "Browser navigation failed. Try reopening the session.",
  BROWSER_UNAVAILABLE: "Chromium is unavailable. Check the browser worker.",
  SESSION_CLOSED: "The browser session is closed. Navigate to reopen it.",
  SESSION_LIMIT: "The browser worker has reached its session limit.",
  INVALID_INPUT: "Unsupported browser input or coordinates.",
  UNAUTHORIZED: "The browser worker rejected server authentication.",
};

/** Server-only bridge. No caller supplies a worker address, credential, or session id. */
export class BrowserComputer {
  readonly configured: boolean;
  private readonly workerUrl: string;
  private readonly workerToken: string;
  private readonly sessionId: string;

  constructor(
    config: { workerUrl?: string; workerToken?: string; sessionId: string },
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.workerUrl = (config.workerUrl ?? "").replace(/\/$/, "");
    this.workerToken = config.workerToken ?? "";
    this.sessionId = config.sessionId.toLowerCase();
    let validUrl = false;
    try {
      const url = new URL(this.workerUrl);
      validUrl = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
    } catch { /* Missing/invalid server configuration is represented by configured=false. */ }
    this.configured = validUrl && this.workerToken.length >= 32 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(this.sessionId);
  }

  private async request(path: string, body?: Record<string, unknown>, binary = false, signal?: AbortSignal): Promise<unknown> {
    if (!this.configured) throw new Error("Browser computer is not configured.");
    if (signal?.aborted) throw new Error("The browser operation was cancelled before dispatch.");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
    try {
      // Cover cancellation between the initial check and listener registration.
      if (signal?.aborted) abort();
      if (controller.signal.aborted) throw new Error("cancelled");
      const response = await this.fetcher(`${this.workerUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${this.workerToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        redirect: "error",
      });
      if (controller.signal.aborted) throw new Error("cancelled");
      if (!response.ok) {
        let code = "";
        try { code = (await response.json()).error?.code ?? ""; } catch { /* Ignore untrusted response bodies. */ }
        throw new Error(errors[code] ?? "The browser operation failed. Check the browser worker.");
      }
      const result = binary ? new Uint8Array(await response.arrayBuffer()) : await response.json();
      if (controller.signal.aborted) throw new Error("cancelled");
      return result;
    } catch (error) {
      if (controller.signal.aborted) {
        if (path.endsWith("/input")) throw new Error("The browser input was interrupted; its outcome may be unknown. Refresh before repeating the action.");
        throw new Error(timedOut ? "The browser worker request timed out." : "The browser operation was cancelled.");
      }
      // Only our fixed messages can cross the server boundary.
      if (error instanceof Error && Object.values(errors).includes(error.message)) throw error;
      throw new Error("The browser worker is unavailable or returned an invalid response.");
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }

  private session(value: unknown): BrowserSession {
    const session = value as Partial<BrowserSession> | null;
    if (!session || session.id !== this.sessionId || typeof session.title !== "string" || typeof session.url !== "string" ||
      !["active", "closed", "error"].includes(session.status ?? "")) throw new Error("The browser worker returned an invalid session.");
    return { id: this.sessionId, title: session.title.slice(0, 300), url: session.url, status: session.status! };
  }

  async status(signal?: AbortSignal): Promise<{ configured: boolean; session?: BrowserSession; error?: string }> {
    if (!this.configured) return { configured: false };
    try {
      const list = await this.request("/sessions", undefined, false, signal);
      if (!Array.isArray(list)) throw new Error("The browser worker returned an invalid session list.");
      const current = list.find((session) => session?.id === this.sessionId);
      return { configured: true, ...(current ? { session: this.session(current) } : {}) };
    } catch (error) {
      return { configured: true, error: error instanceof Error ? error.message : "The browser worker is unavailable." };
    }
  }

  async navigate(value: string, signal?: AbortSignal): Promise<BrowserSession> {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error(errors.BLOCKED_URL); }
    if (value.length > 8192 || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443")) throw new Error(errors.BLOCKED_URL);
    const status = await this.status(signal);
    if (signal?.aborted) throw new Error("The browser operation was cancelled before navigation.");
    if (!status.configured) throw new Error("Browser computer is not configured.");
    if (status.error) throw new Error(status.error);
    const result = status.session?.status === "active"
      ? await this.request(`/sessions/${this.sessionId}/navigate`, { url: value }, false, signal)
      : await this.request("/sessions", { id: this.sessionId, url: value }, false, signal);
    return this.session(result);
  }

  async read(signal?: AbortSignal): Promise<{ title: string; url: string; text: string; truncated: boolean }> {
    const result = await this.request(`/sessions/${this.sessionId}/read`, undefined, false, signal) as Record<string, unknown>;
    if (!result || typeof result.title !== "string" || typeof result.url !== "string" || typeof result.text !== "string" || typeof result.truncated !== "boolean")
      throw new Error("The browser worker returned an invalid page read.");
    return { title: result.title.slice(0, 300), url: result.url, text: result.text.slice(0, 100_000), truncated: result.truncated || result.text.length > 100_000 };
  }

  async input(input: Record<string, unknown>, signal?: AbortSignal): Promise<BrowserSession> {
    const workerInput = input.type === "type" ? { ...input, type: "text" } : input;
    return this.session(await this.request(`/sessions/${this.sessionId}/input`, workerInput, false, signal));
  }

  async screenshot(signal?: AbortSignal): Promise<Uint8Array> {
    return await this.request(`/sessions/${this.sessionId}/screenshot`, undefined, true, signal) as Uint8Array;
  }

  async close(signal?: AbortSignal): Promise<BrowserSession> {
    return this.session(await this.request(`/sessions/${this.sessionId}/close`, {}, false, signal));
  }
}
