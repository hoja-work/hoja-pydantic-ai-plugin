// Built by scripts/build.mjs from src/ and vendor/trebol/ (see vendor/MANIFEST.json). Do not edit.

// src/api-proxy.ts
import { createInterface } from "node:readline";

// vendor/trebol/.pi/lib/claw/hoja.ts
var HOJA_TOKEN_VARS = ["HOJA_TOKEN", "LINEAR_TOKEN"];
var HOJA_URL_VARS = ["HOJA_API_URL", "LINEAR_API_URL"];
var HOJA_ENDPOINT_HINT = "No Hoja endpoint configured. Set HOJA_API_URL (e.g. https://workspace.hoja.work/graphql) or HOJA_MCP_URL; LINEAR_API_URL is honoured only as a deprecated alias.";
function resolveHojaUrl(env = process.env, override) {
  const direct = override?.trim() || credentialValue(HOJA_URL_VARS, env);
  if (direct) return direct;
  const mcp = env.HOJA_MCP_URL?.trim();
  if (!mcp) return "";
  try {
    const parsed = new URL(mcp);
    parsed.pathname = "/graphql";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}
function resolveHojaToken(env = process.env, override) {
  return override ?? credentialValue(HOJA_TOKEN_VARS, env) ?? "";
}
var MISSING_HOJA_TOKEN = "HOJA_TOKEN is not set (deprecated fallback LINEAR_TOKEN is also unset); Hoja is unavailable";
function credentialValue(names, env = process.env) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return void 0;
}

// src/env.ts
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// src/credentials.ts
import { execFileSync } from "node:child_process";
var URL_VARS = ["HOJA_API_URL", "LINEAR_API_URL", "HOJA_MCP_URL"];
var TOKEN_VARS = ["HOJA_TOKEN", "LINEAR_TOKEN"];
var LOOPBACK = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
function normalizeEndpoint(raw) {
  const value = raw?.trim() ?? "";
  if (!value) return { url: "" };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { url: "", problem: `"${value}" is not a URL. Use the full address, e.g. https://acme.hoja.work/mcp.` };
  }
  if (parsed.protocol === "http:" && !LOOPBACK.has(parsed.hostname)) {
    return { url: "", problem: `Refusing plain-http endpoint ${parsed.host}: Hoja tokens are only sent over https (loopback excepted).` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { url: "", problem: `Unsupported scheme in "${value}".` };
  return { url: parsed.toString() };
}
var defaultRunCli = (args) => execFileSync("hoja", args, {
  encoding: "utf8",
  timeout: 15e3,
  stdio: ["ignore", "pipe", "ignore"],
  windowsHide: true
});
function readCliCredential(run = defaultRunCli) {
  try {
    const parsed = JSON.parse(run(["auth", "token", "--json"]));
    return typeof parsed?.access_token === "string" && parsed.access_token ? parsed : void 0;
  } catch {
    return void 0;
  }
}
var Credentials = class {
  constructor(env = process.env, run = defaultRunCli) {
    this.env = env;
    this.run = run;
  }
  env;
  run;
  source = "none";
  problems = [];
  workspace;
  expiresAt = 0;
  apply() {
    this.problems = [];
    for (const name of URL_VARS) {
      if (!this.env[name]?.trim()) continue;
      const { url, problem } = normalizeEndpoint(this.env[name]);
      if (problem) {
        this.problems.push(`${name}: ${problem}`);
        delete this.env[name];
      } else this.env[name] = url;
    }
    if (TOKEN_VARS.some((name) => this.env[name]?.trim())) {
      this.source = "env";
      return this;
    }
    this.fromCli();
    return this;
  }
  /** The token to send now; refreshes a CLI token that is about to expire. */
  token() {
    if (this.source === "hoja-cli" && this.expiresAt && Date.now() > this.expiresAt - 6e4) this.fromCli();
    return this.env.HOJA_TOKEN?.trim() || this.env.LINEAR_TOKEN?.trim() || "";
  }
  /** After a 401: a pasted key cannot be refreshed; a CLI sign-in can. True when a new token was obtained. */
  refresh() {
    if (this.source !== "hoja-cli") return false;
    const before = this.env.HOJA_TOKEN;
    this.fromCli();
    return this.source === "hoja-cli" && this.env.HOJA_TOKEN !== before;
  }
  fromCli() {
    const credential = readCliCredential(this.run);
    if (!credential) {
      if (this.source === "hoja-cli") delete this.env.HOJA_TOKEN;
      this.source = "none";
      return;
    }
    this.source = "hoja-cli";
    this.env.HOJA_TOKEN = credential.access_token;
    this.workspace = credential.workspace?.name || credential.workspace?.origin;
    const expires = typeof credential.expires_at === "number" ? credential.expires_at * 1e3 : Date.parse(credential.expires_at ?? "");
    this.expiresAt = Number.isFinite(expires) ? expires : 0;
    for (const [name, value] of [["HOJA_API_URL", credential.api_url], ["HOJA_MCP_URL", credential.mcp_url]]) {
      if (this.env[name]?.trim() || !value) continue;
      const { url } = normalizeEndpoint(value);
      if (url) this.env[name] = url;
    }
  }
};
function authFetch(credentials2, base = fetch, extraHeaders) {
  const withToken = (init) => {
    const headers = { ...init?.headers ?? {} };
    const token = credentials2.token();
    if (token) {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === "authorization") delete headers[key];
      headers.authorization = `Bearer ${token}`;
    }
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "x-hoja-actor")) headers["x-hoja-actor"] = "agent";
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders())) {
        if (v && !Object.keys(headers).some((existing) => existing.toLowerCase() === k.toLowerCase())) headers[k] = v;
      }
    }
    return { ...init, headers };
  };
  return async (url, init) => {
    const response = await base(url, withToken(init));
    if (response?.status !== 401 || !credentials2.refresh()) return response;
    return base(url, withToken(init));
  };
}
var SIGN_IN_HINT = "Run `hoja auth login <your-workspace>` in a terminal (recommended), or set HOJA_TOKEN and HOJA_API_URL.";

// src/env.ts
var OPTION_ENV = [
  ["HOJA_API_URL", "HOJA_PLUGIN_API_URL"],
  ["HOJA_MCP_URL", "HOJA_PLUGIN_MCP_URL"],
  ["HOJA_TOKEN", "HOJA_PLUGIN_TOKEN"],
  ["HOJA_PROJECT", "HOJA_PLUGIN_PROJECT"],
  ["TASK_ENFORCEMENT", "HOJA_PLUGIN_ENFORCEMENT"],
  ["TRACE_UPLOAD", "HOJA_PLUGIN_TRACE_UPLOAD"],
  ["TRACE_DETAIL", "HOJA_PLUGIN_TRACE_DETAIL"]
];
function applyUserConfig(env = process.env) {
  for (const [option, name] of OPTION_ENV) {
    const v = env[`CLAUDE_PLUGIN_OPTION_${option}`]?.trim();
    if (v && !env[name]?.trim()) env[name] = v;
  }
  const set = (from, to) => {
    const v = env[from]?.trim();
    if (v) env[to] = v;
  };
  set("HOJA_PLUGIN_API_URL", "HOJA_API_URL");
  set("HOJA_PLUGIN_TOKEN", "HOJA_TOKEN");
  set("HOJA_PLUGIN_PROJECT", "HOJA_PROJECT");
  set("HOJA_PLUGIN_MCP_URL", "HOJA_MCP_URL");
}
var credentials = new Credentials(process.env);
function applyCredentials() {
  applyUserConfig();
  return credentials.apply();
}
function dataDir(env = process.env, script = process.argv[1]) {
  const explicit = env.HOJA_PLUGIN_DATA?.trim() || env.CLAUDE_PLUGIN_DATA?.trim() || env.PLUGIN_DATA?.trim();
  if (explicit) return explicit;
  const host = env.HOJA_PLUGIN_HOST?.trim().toLowerCase();
  if (host === "antigravity" || host === "agy") return join(homedir(), ".gemini", "antigravity-cli", "plugin-data", "hoja");
  if (host !== "codex") return join(homedir(), ".claude", "plugins", "data", "hoja-standalone");
  const installed = script ? /^(.*)[\\/]plugins[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/][^\\/]+$/.exec(resolve(dirname(resolve(script)), "..")) : null;
  if (installed) return join(installed[1], "plugins", "data", `${installed[3]}-${installed[2]}`);
  return join(env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "plugins", "data", "hoja-standalone");
}

// src/host.ts
var PROFILES = {
  // Claude Code may normalize the server name's hyphen.
  claude: { host: "claude", ownToolPrefixes: ["mcp__plugin_hoja_hoja__"], apiToolPrefixes: ["mcp__plugin_hoja_hoja-api__", "mcp__plugin_hoja_hoja_api__"], bashAliases: [] },
  codex: { host: "codex", ownToolPrefixes: ["mcp__hoja__"], apiToolPrefixes: ["mcp__hoja_api__", "mcp__hoja-api__"], bashAliases: ["exec_command", "shell", "local_shell", "container.exec"] },
  // Antigravity names a plugin's MCP server `<plugin>_<server>` and wraps every MCP call in `call_mcp_tool`; agy.ts
  // unwraps it to `mcp__<ServerName>__<ToolName>`. Its shell tool is `run_command`.
  antigravity: { host: "antigravity", ownToolPrefixes: ["mcp__hoja_hoja__"], apiToolPrefixes: ["mcp__hoja_hoja-api__", "mcp__hoja_hoja_api__"], bashAliases: ["run_command"] }
};
var hostOf = (env = process.env) => {
  const v = env.HOJA_PLUGIN_HOST?.trim().toLowerCase();
  return v === "codex" ? "codex" : v === "antigravity" || v === "agy" ? "antigravity" : "claude";
};
var profile = (env = process.env) => PROFILES[hostOf(env)];

// src/trace/touched.ts
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join as join3 } from "node:path";

// src/transcript.ts
var PI_API_PREFIX = "mcp__hoja__";
var ownToolPrefix = (name) => profile().ownToolPrefixes.find((prefix) => name.startsWith(prefix));
var canonicalToolName = (name) => {
  const { apiToolPrefixes, bashAliases } = profile();
  const own = ownToolPrefix(name);
  if (own) return name.slice(own.length);
  const api = apiToolPrefixes.find((prefix) => name.startsWith(prefix));
  if (api) return PI_API_PREFIX + name.slice(api.length);
  return bashAliases.includes(name) ? "Bash" : name;
};

// src/trace/recorder.ts
import { join as join2 } from "node:path";
var tracesDir = (dataDir2) => join2(dataDir2, "traces");

// src/trace/touched.ts
var SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;
var ISSUE_RE = /\b([A-Z][A-Z0-9]{1,9}-\d+(?:-[A-Za-z]-\d+)*)\b/g;
var HOJA_WRITE_OPS = /* @__PURE__ */ new Set([
  "hoja_issueCreate",
  "hoja_taskCreate",
  "hoja_issueUpdate",
  "hoja_taskUpdate",
  "hoja_issueMove",
  "hoja_issueArchive",
  "hoja_issueDelete",
  "hoja_issueSubscribe",
  "hoja_issueUnsubscribe",
  "hoja_commentCreate",
  "hoja_commentUpdate",
  "hoja_commentDelete",
  "hoja_issueDecisionCreate",
  "hoja_taskDecisionCreate",
  "hoja_issueDecisionAnswer",
  "hoja_taskDecisionAnswer",
  "hoja_issueDecisionCancel",
  "hoja_taskDecisionCancel",
  "hoja_issueReviewRequest",
  "hoja_taskReviewRequest",
  "hoja_attachmentCreate",
  "hoja_githubLinkAdd"
]);
var BASH_HOJA_WRITE = /\bhoja\s+(?:issue|task|comment|decision)\s+(?:create|update|comment|edit|close|reopen|archive|move|assign|answer|ask)\b/i;
function writeAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), { mode: 384 });
  renameSync(tmp, path);
}
function readActiveSession(dataDir2, ppid = process.ppid, maxAgeMs = 24 * 60 * 60 * 1e3) {
  if (!dataDir2) return void 0;
  const dir = tracesDir(dataDir2);
  for (const name of [...ppid > 1 ? [`.active-${ppid}.json`] : [], ".active.json"]) {
    const file = join3(dir, name);
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      const sid = typeof parsed?.sessionId === "string" ? parsed.sessionId : "";
      const age = Date.now() - Date.parse(String(parsed?.updatedAt ?? ""));
      if (SAFE_ID.test(sid) && (!Number.isFinite(age) || age <= maxAgeMs)) return sid;
    } catch {
    }
  }
  return void 0;
}
function isHojaWriteTool(rawTool, params) {
  const canonical = canonicalToolName(rawTool);
  const mcp = /^mcp__(?:plugin_[^_]+_)?[^_]+__(.+)$/.exec(canonical);
  const op = mcp ? mcp[1] : canonical;
  if (HOJA_WRITE_OPS.has(op)) return { isWrite: true, op };
  if (canonical === "Bash") {
    const cmd = typeof params?.command === "string" ? params.command : "";
    if (BASH_HOJA_WRITE.test(cmd)) return { isWrite: true, op: "Bash" };
  }
  return { isWrite: false, op };
}
function collectIdentifiers(value, out, depth = 0) {
  if (depth > 5 || value == null) return;
  if (typeof value === "string") {
    for (const m of value.matchAll(ISSUE_RE)) out.add(m[1]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIdentifiers(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "identifier" || k === "issueId" || k === "id" || k === "url" || k === "issue" || k === "task" || k === "comment" || k === "decision" || /^(?:issue|task|comment|decision|attachment|githubLink)[A-Z]/.test(k)) {
        collectIdentifiers(v, out, depth + 1);
      }
    }
  }
}
function extractTouchedIssuesFromTool(rawTool, params, outputText) {
  const { isWrite, op } = isHojaWriteTool(rawTool, params);
  if (!isWrite) return [];
  const found = /* @__PURE__ */ new Set();
  if (op !== "Bash" && params && typeof params === "object") {
    const p = params;
    for (const key of ["issueId", "id", "identifier"]) {
      if (typeof p[key] === "string") collectIdentifiers(p[key], found);
    }
  } else if (op === "Bash" && typeof params?.command === "string") {
    const cmd = String(params.command);
    const head = cmd.split(/\s--(?:body|description|title)\b/)[0] ?? cmd;
    collectIdentifiers(head, found);
  }
  if (outputText) {
    try {
      const parsed = JSON.parse(outputText);
      collectIdentifiers(parsed, found);
    } catch {
      if (op !== "Bash") collectIdentifiers(outputText, found);
      else {
        for (const m of outputText.slice(0, 1e3).matchAll(ISSUE_RE)) found.add(m[1]);
      }
    }
  }
  return [...found];
}
var touchedPath = (dataDir2, sessionId) => join3(tracesDir(dataDir2), `${SAFE_ID.test(sessionId) ? sessionId : "invalid-session"}.issues.json`);
function readTouchedIssues(dataDir2, sessionId) {
  if (!dataDir2 || !SAFE_ID.test(sessionId)) return [];
  const path = touchedPath(dataDir2, sessionId);
  if (!existsSync(path)) return [];
  try {
    const v = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && !!x) : [];
  } catch {
    return [];
  }
}
function appendTouchedIssues(dataDir2, sessionId, issues) {
  if (!dataDir2 || !SAFE_ID.test(sessionId) || !issues.length) return [];
  try {
    const merged = [.../* @__PURE__ */ new Set([...readTouchedIssues(dataDir2, sessionId), ...issues.filter(Boolean)])];
    const path = touchedPath(dataDir2, sessionId);
    mkdirSync(tracesDir(dataDir2), { recursive: true, mode: 448 });
    writeAtomic(path, merged);
    return merged;
  } catch {
    return [];
  }
}

// src/api-proxy.ts
function resolveMcpUrl(env = process.env) {
  const direct = env.HOJA_MCP_URL?.trim();
  if (direct) return normalizeEndpoint(direct).url;
  const graphql = resolveHojaUrl(env);
  if (!graphql) return "";
  try {
    const u = new URL(graphql);
    u.pathname = "/mcp";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}
var UpstreamMcp = class {
  constructor(url, token, fetchImpl = fetch, extraHeaders) {
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.extraHeaders = extraHeaders;
  }
  url;
  token;
  fetchImpl;
  extraHeaders;
  session;
  seq = 0;
  protocolVersion = "2025-06-18";
  async send(method, params, notification = false, signal) {
    const id = notification ? void 0 : `up-${++this.seq}`;
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${this.token}`,
      "mcp-protocol-version": this.protocolVersion,
      "x-hoja-actor": "agent"
    };
    if (this.extraHeaders) {
      for (const [k, v] of Object.entries(this.extraHeaders())) {
        if (v) headers[k] = v;
      }
    }
    if (this.session) headers["mcp-session-id"] = this.session;
    const response = await this.fetchImpl(this.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...id ? { id } : {}, method, ...params ? { params } : {} }), signal });
    const session = response.headers.get("mcp-session-id");
    if (session) this.session = session;
    const text = await response.text();
    if (notification) return void 0;
    if (response.status === 401 || response.status === 403) throw new Error(`Hoja MCP rejected the token (${response.status}). ${SIGN_IN_HINT}`);
    if (response.status >= 400) throw new Error(`Hoja MCP ${this.url} answered HTTP ${response.status}`);
    const message = parseMessages(text, response.headers.get("content-type") ?? "").find((m) => m.id === id);
    if (!message) throw new Error(`Hoja MCP returned no response for ${method}`);
    if (message.error) throw new Error(message.error.message ?? `Hoja MCP ${method} failed`);
    return message.result;
  }
};
function parseMessages(body, contentType) {
  if (!contentType.includes("text/event-stream")) {
    try {
      const v = JSON.parse(body);
      return Array.isArray(v) ? v : [v];
    } catch {
      return [];
    }
  }
  const out = [];
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
    if (data) try {
      out.push(JSON.parse(data));
    } catch {
    }
  }
  return out;
}
function createProxy(env = process.env, fetchImpl, credentials2, pluginDataDir) {
  const url = resolveMcpUrl(env);
  const token = credentials2 ? credentials2.token() : resolveHojaToken(env);
  const configProblem = credentials2?.problems.join(" ") ?? "";
  const problem = configProblem || (!url ? HOJA_ENDPOINT_HINT : !token ? `${MISSING_HOJA_TOKEN}. ${SIGN_IN_HINT}` : "");
  const sessionDir = pluginDataDir ?? (env.HOJA_PLUGIN_DATA || env.CLAUDE_PLUGIN_DATA || env.PLUGIN_DATA ? dataDir(env) : "");
  const host = hostOf(env);
  const clientName = host === "claude" ? "claude-code" : host;
  const headerProvider = () => ({
    "x-hoja-actor": "agent",
    "x-hoja-client": clientName,
    ...sessionDir ? { "x-hoja-session-id": readActiveSession(sessionDir) } : {}
  });
  const transport = credentials2 ? authFetch(credentials2, fetchImpl ?? fetch, headerProvider) : fetchImpl;
  const upstream = problem ? void 0 : new UpstreamMcp(url, token, transport, headerProvider);
  let ready;
  let failure = problem;
  const connect = (protocolVersion) => ready ??= (async () => {
    upstream.protocolVersion = protocolVersion;
    const result = await upstream.send("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: `hoja-${host}-plugin`, version: "0.2.0" } });
    if (typeof result?.protocolVersion === "string") upstream.protocolVersion = result.protocolVersion;
    await upstream.send("notifications/initialized", void 0, true);
    return result;
  })().catch((error) => {
    failure = error.message;
    ready = void 0;
    throw error;
  });
  async function handle(method, params, signal) {
    if (method === "initialize") {
      const protocolVersion = params?.protocolVersion ?? "2025-06-18";
      let instructions = "";
      if (upstream) {
        try {
          instructions = (await connect(protocolVersion))?.instructions ?? "";
        } catch {
        }
      }
      if (failure) instructions = `Hoja API unavailable: ${failure}`;
      return { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "hoja-api", version: "0.2.0" }, ...instructions ? { instructions } : {} };
    }
    if (method === "tools/list") {
      if (!upstream) return { tools: [] };
      try {
        await connect(upstream.protocolVersion);
        const tools = [];
        let cursor;
        do {
          const page = await upstream.send("tools/list", cursor ? { cursor } : {}, false, signal);
          tools.push(...page?.tools ?? []);
          cursor = page?.nextCursor;
        } while (cursor);
        return { tools };
      } catch {
        return { tools: [] };
      }
    }
    if (method === "tools/call") {
      if (!upstream) return { content: [{ type: "text", text: `Hoja API unavailable: ${failure}` }], isError: true };
      try {
        await connect(upstream.protocolVersion);
        const result = await upstream.send("tools/call", params, false, signal);
        if (sessionDir && !result?.isError) {
          const activeSid = readActiveSession(sessionDir);
          if (activeSid) {
            const text = Array.isArray(result?.content) ? result.content.map((c) => c?.text ?? "").join("\n") : "";
            const touched = extractTouchedIssuesFromTool(String(params?.name ?? ""), params?.arguments, text);
            if (touched.length) appendTouchedIssues(sessionDir, activeSid, touched);
          }
        }
        return result;
      } catch (error) {
        return { content: [{ type: "text", text: error.message }], isError: true };
      }
    }
    if (method === "ping") return {};
    throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
  }
  return { handle, url, problem: () => failure };
}
function main() {
  const credentials2 = applyCredentials();
  const proxy = createProxy(process.env, void 0, credentials2, dataDir());
  const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  const inflight = /* @__PURE__ */ new Map();
  createInterface({ input: process.stdin }).on("line", async (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = message;
    if (method === "notifications/cancelled") {
      inflight.get(params?.requestId)?.abort();
      return;
    }
    if (id === void 0 || typeof method !== "string") return;
    const controller = new AbortController();
    inflight.set(id, controller);
    try {
      send({ jsonrpc: "2.0", id, result: await proxy.handle(method, params ?? {}, controller.signal) });
    } catch (error) {
      send({ jsonrpc: "2.0", id, error: { code: error.code ?? -32603, message: error.message } });
    } finally {
      inflight.delete(id);
    }
  }).on("close", () => process.exit(0));
}
if (process.argv[1] && /api-proxy\.(m?js|ts)$/.test(process.argv[1])) main();
export {
  UpstreamMcp,
  createProxy,
  parseMessages,
  resolveMcpUrl
};
