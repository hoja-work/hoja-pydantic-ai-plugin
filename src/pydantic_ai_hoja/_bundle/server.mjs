// Built by scripts/build.mjs from src/ and vendor/trebol/ (see vendor/MANIFEST.json). Do not edit.

// src/server.ts
import { appendFileSync as appendFileSync3 } from "node:fs";

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

// src/server.ts
import { createInterface as createInterface2 } from "node:readline";

// vendor/trebol/packages/tools/taskmanage/src/persistence.ts
var CURRENT_SCHEMA_VERSION = 2;
function snapshot(state, revision, now = (/* @__PURE__ */ new Date()).toISOString()) {
  return { ...structuredClone(state), schemaVersion: CURRENT_SCHEMA_VERSION, revision, savedAt: now };
}
function replayLatest(entries, type, migrate) {
  const candidates = [];
  const audit = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry;
    if (value.type !== type && !(value.type === "custom" && value.customType === type)) continue;
    const data = value.data;
    const version = typeof data?.schemaVersion === "number" ? data.schemaVersion : 1;
    if (version > CURRENT_SCHEMA_VERSION) continue;
    const raw = data?.state ?? (() => {
      if (!data || typeof data !== "object") return data;
      const { schemaVersion: _schemaVersion, revision: _revision, savedAt: _savedAt, ...state } = data;
      return state;
    })();
    try {
      const state = migrate(raw, version);
      const revision = typeof data?.revision === "number" ? data.revision : 0;
      candidates.push({ state: structuredClone(state), revision });
      if (version !== CURRENT_SCHEMA_VERSION) audit.push({ operation: "migrate", schemaVersion: version, revision, at: (/* @__PURE__ */ new Date()).toISOString() });
    } catch {
    }
  }
  if (!candidates.length) return void 0;
  const selected = candidates.reduce((a, b) => b.revision >= a.revision ? b : a);
  audit.push({ operation: "replay", schemaVersion: CURRENT_SCHEMA_VERSION, revision: selected.revision, at: (/* @__PURE__ */ new Date()).toISOString() });
  return { state: structuredClone(selected.state), revision: selected.revision, audit };
}

// vendor/trebol/packages/tools/taskmanage/src/swarm-validate.ts
var MAX_OPERATIONS = 50;
var DEFAULT_LIST_LIMIT = 50;
var MAX_LIST_LIMIT = 500;
var MINIMAL_CREATE = `{"key":"<your-key>","op":"create","subject":"<short imperative title>"}`;
var CATEGORIES = /* @__PURE__ */ new Set(["researching", "planning", "acting", "verifying", "debugging", "documenting"]);
var PRIORITIES = /* @__PURE__ */ new Set(["low", "medium", "high"]);
var NOTE_TYPES = /* @__PURE__ */ new Set(["decision", "blocker", "learning", "milestone", "question", "observation", "other"]);
var MAX_TASK_QUESTIONS = 12;
var MAX_QUESTION_ID_LENGTH = 64;
var MAX_QUESTION_TEXT_LENGTH = 240;
var MAX_ANSWER_LENGTH = 2e3;
var MAX_EVIDENCE_LENGTH = 512;
var ALLOWED = {
  create: ["subject", "description", "activeForm", "category", "priority", "metadata", "parentTaskId", "owner_id", "status", "active", "addBlocks", "addBlockedBy", "questions"],
  update: ["taskId", "status", "category", "priority", "subject", "description", "activeForm", "active", "parentTaskId", "metadata", "addBlocks", "addBlockedBy", "addNote", "noteType", "questions", "answers"],
  get: ["taskId", "include_audit"],
  list: ["category", "status", "active", "limit", "offset", "subject"]
};
var q = (v) => JSON.stringify(String(v));
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var Failure = class extends Error {
};
var fail = (message) => {
  throw new Failure(message);
};
function requiredString(raw, field) {
  if (!(field in raw)) fail(`${field} is required`);
  const v = raw[field];
  if (typeof v !== "string" || v.trim() === "") fail(`${field} must be a non-empty string`);
  return v;
}
function optionalString(raw, field) {
  if (!(field in raw)) return void 0;
  const v = raw[field];
  if (typeof v !== "string") fail(`${field} must be a string`);
  return v;
}
function integer(value, field) {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${field} must be an integer`);
  return value;
}
function target(value, field) {
  if (typeof value === "string") {
    if (value === "" && field !== "parentTaskId") fail(`${field} must not be empty`);
    return;
  }
  if (isObj(value)) {
    for (const key of Object.keys(value)) if (key !== "ref" && key !== "field") fail(`${field} reference contains unknown field ${q(key)}`);
    if (!("ref" in value)) fail(`${field} reference requires ref`);
    const ref = value.ref;
    if (typeof ref !== "string" || ref.trim() === "") fail(`${field} reference ref must be a non-empty string`);
    let refField = "taskId";
    if ("field" in value) {
      if (typeof value.field !== "string") fail(`${field} reference field must be a string`);
      refField = value.field;
    }
    if (refField !== "taskId") fail(`${field} reference field must be taskId`);
    return;
  }
  fail(`${field} must be a task ID or reference`);
}
function targets(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  value.forEach((raw, i) => target(raw, `${field}[${i}]`));
}
function coerceTaskRef(value) {
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (Array.isArray(value)) return value.map(coerceTaskRef);
  if (!isObj(value)) return value;
  if (typeof value.ref === "number" && Number.isInteger(value.ref)) return { ...value, ref: String(value.ref) };
  const next = { ...value };
  for (const key of ["addBlocks", "addBlockedBy"]) {
    if (Array.isArray(next[key])) next[key] = coerceTaskRef(next[key]);
  }
  return next;
}
function validateQuestions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TASK_QUESTIONS) fail(`questions must contain 1-${MAX_TASK_QUESTIONS} items`);
  const ids = /* @__PURE__ */ new Set();
  for (const item of value) {
    if (!isObj(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > MAX_QUESTION_ID_LENGTH || typeof item.text !== "string" || !item.text.trim() || item.text.length > MAX_QUESTION_TEXT_LENGTH || Object.keys(item).some((k) => k !== "id" && k !== "text")) fail("questions must contain bounded {id,text} items");
    if (isObj(item) && typeof item.id === "string" && ids.has(item.id)) fail("question ids must be unique");
    if (isObj(item) && typeof item.id === "string") ids.add(item.id);
  }
}
function validateAnswers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TASK_QUESTIONS) fail(`answers must contain 1-${MAX_TASK_QUESTIONS} items`);
  const ids = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    if (!isObj(item)) fail(`answers[${index}] must be an object with {question,answer,evidence}`);
    for (const [field, limit] of [["question", MAX_QUESTION_ID_LENGTH], ["answer", MAX_ANSWER_LENGTH], ["evidence", MAX_EVIDENCE_LENGTH]]) {
      const raw = item[field];
      if (typeof raw !== "string" || !raw.trim()) fail(`answers[${index}].${field} must be a non-empty string`);
      if (raw.length > limit) fail(`answers[${index}].${field} is ${raw.length} characters; the limit is ${limit}`);
    }
    const answer = item;
    const unknownField = Object.keys(answer).find((k) => !["question", "answer", "evidence"].includes(k));
    if (unknownField !== void 0) fail(`answers[${index}] has unknown field "${unknownField}"; allowed fields are question, answer and evidence`);
    ids.add(answer.question);
  }
}
function parseOperation(raw, index) {
  let key = "";
  try {
    key = requiredString(raw, "key");
  } catch (e) {
    if (e instanceof Failure) fail(`operation ${index}: ${e.message}`);
    throw e;
  }
  const opScoped = (fn) => {
    try {
      fn();
    } catch (e) {
      if (e instanceof Failure) fail(`operation ${q(key)}: ${e.message}`);
      throw e;
    }
  };
  let kind = "";
  opScoped(() => {
    kind = requiredString(raw, "op");
  });
  opScoped(() => {
    const fields = ALLOWED[kind];
    if (!fields) fail(`unsupported op ${q(kind)}`);
    const common = /* @__PURE__ */ new Set(["key", "op", ...fields]);
    for (const field of Object.keys(raw)) {
      if (common.has(field)) continue;
      if (kind === "create" && (field === "addNote" || field === "noteType"))
        fail(`field ${q(field)} is not valid for create; create the task first, then add the note with an update operation targeting taskId:{"ref":${q(key)}}`);
      fail(`field ${q(field)} is not valid for ${kind}`);
    }
  });
  if ("taskId" in raw) target(raw.taskId, "taskId");
  if ("parentTaskId" in raw) target(raw.parentTaskId, "parentTaskId");
  if ("addBlocks" in raw) targets(raw.addBlocks, "addBlocks");
  if ("addBlockedBy" in raw) targets(raw.addBlockedBy, "addBlockedBy");
  let subject = "", category = "", priority = "", status = "", noteType = "", limit = DEFAULT_LIST_LIMIT, offset = 0;
  opScoped(() => {
    subject = optionalString(raw, "subject") ?? "";
    optionalString(raw, "description");
    optionalString(raw, "activeForm");
    category = optionalString(raw, "category") ?? "";
    priority = optionalString(raw, "priority") ?? "";
    if ("metadata" in raw && !isObj(raw.metadata)) fail("metadata must be an object");
    optionalString(raw, "owner_id");
    status = optionalString(raw, "status") ?? "";
    if ("active" in raw && typeof raw.active !== "boolean") fail("active must be a boolean");
    if ("limit" in raw) limit = integer(raw.limit, "limit");
    if ("offset" in raw) offset = integer(raw.offset, "offset");
    optionalString(raw, "addNote");
    noteType = optionalString(raw, "noteType") ?? "";
    if ("include_audit" in raw && typeof raw.include_audit !== "boolean") fail("include_audit must be a boolean");
    if ("questions" in raw) validateQuestions(raw.questions);
    if ("answers" in raw) validateAnswers(raw.answers);
  });
  if (kind === "create" && subject.trim() === "") fail(`operation ${q(key)}: op:"create" requires a non-blank "subject". A minimal valid create is ${MINIMAL_CREATE} \u2014 "description" is optional and is never required. Retry this operation with "subject" set to a short imperative title.`);
  if (kind === "create" && status === "completed" && Array.isArray(raw.questions) && raw.questions.length) fail(`operation ${q(key)}: question-bearing tasks cannot be created completed`);
  if (category !== "" && !CATEGORIES.has(category)) fail(`operation ${q(key)}: invalid category ${q(category)}`);
  if (priority !== "" && !PRIORITIES.has(priority)) fail(`operation ${q(key)}: invalid priority ${q(priority)}`);
  if (status !== "" && !["pending", "in_progress", "completed", "deleted"].includes(status)) fail(`operation ${q(key)}: invalid status ${q(status)}`);
  if (noteType !== "" && !NOTE_TYPES.has(noteType)) fail(`operation ${q(key)}: invalid noteType ${q(noteType)}`);
  if (kind === "list") {
    if (limit < 1 || limit > MAX_LIST_LIMIT) fail(`operation ${q(key)}: limit must be between 1 and ${MAX_LIST_LIMIT}`);
    if (offset < 0) fail(`operation ${q(key)}: offset must be non-negative`);
  }
  return { key, kind };
}
function normalizeTaskManageParams(params) {
  if (!isObj(params) || !Array.isArray(params.operations)) return params;
  const optionalScalars = /* @__PURE__ */ new Set(["description", "activeForm", "category", "priority", "metadata", "owner_id", "status", "active", "addNote", "noteType", "include_audit"]);
  const refFields = /* @__PURE__ */ new Set(["taskId", "parentTaskId", "addBlocks", "addBlockedBy"]);
  return {
    ...params,
    operations: params.operations.map((item) => {
      if (!isObj(item)) return item;
      const copy = { ...item };
      for (const field of optionalScalars) if (copy[field] === null) delete copy[field];
      for (const field of refFields) if (copy[field] !== void 0 && copy[field] !== null) copy[field] = coerceTaskRef(copy[field]);
      return copy;
    })
  };
}
function swarmValidateTaskManageParams(params) {
  try {
    const normalized = normalizeTaskManageParams(params);
    const raw = isObj(normalized) ? normalized : {};
    for (const field of Object.keys(raw)) if (field !== "operations" && field !== "mode" && field !== "description") fail(`unknown top-level field ${q(field)}`);
    if (raw.description !== void 0 && typeof raw.description !== "string") fail("description must be a string");
    const ops = raw.operations;
    if (ops === void 0) fail("operations is required");
    if (!Array.isArray(ops)) fail("operations must be an array");
    if (ops.length === 0) fail("operations must contain at least one operation");
    if (ops.length > MAX_OPERATIONS) fail(`operations exceeds maximum of ${MAX_OPERATIONS}`);
    let mode = "sequential";
    if ("mode" in raw) {
      if (typeof raw.mode !== "string") fail("mode must be a string");
      mode = raw.mode;
    }
    if (mode !== "sequential" && mode !== "atomic") fail(`unsupported mode ${q(mode)}`);
    const first = /* @__PURE__ */ new Map();
    ops.forEach((item, index) => {
      if (!isObj(item)) fail(`operation ${index} must be an object`);
      const op = parseOperation(item, index);
      const seen = first.get(op.key);
      if (seen !== void 0) {
        const rawOp = ops[index];
        const sameCreateFollowup = seen === "create" && op.kind !== "create";
        const explicitTargetFollowup = op.kind === "update" && "taskId" in rawOp;
        if (!sameCreateFollowup && !explicitTargetFollowup) fail(`duplicate operation key ${q(op.key)}: keys must be unique per operation`);
      } else first.set(op.key, op.kind);
    });
    return void 0;
  } catch (e) {
    if (e instanceof Failure) return e.message;
    throw e;
  }
}
function goNow() {
  const ms2 = Date.now();
  const iso = new Date(ms2).toISOString();
  const sub = String(Number(process.hrtime.bigint() % 1000000n)).padStart(6, "0");
  const frac = (iso.slice(20, 23) + sub).replace(/0+$/, "");
  return `${iso.slice(0, 19)}${frac ? `.${frac}` : ""}Z`;
}

// vendor/trebol/packages/tools/taskmanage/src/task-manage.ts
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, realpathSync } from "node:fs";
import { resolve as resolvePath, relative as relativePath, isAbsolute } from "node:path";
var CATEGORIES2 = ["researching", "planning", "acting", "verifying", "debugging", "documenting"];
var PRIORITIES2 = ["low", "medium", "high"];
var NOTE_TYPES2 = ["decision", "blocker", "learning", "milestone", "question", "observation", "other"];
var MAX_TASK_QUESTIONS2 = 12;
var MAX_QUESTION_ID_LENGTH2 = 64;
var MAX_QUESTION_TEXT_LENGTH2 = 240;
var MAX_ANSWER_LENGTH2 = 2e3;
var MAX_EVIDENCE_LENGTH2 = 512;
var sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)) out[key] = sortKeysDeep(value[key]);
  return out;
};
function goMapOrdered(batch) {
  if (!Array.isArray(batch?.results)) return batch;
  return { ...batch, results: batch.results.map((entry) => {
    const data = entry?.data;
    if (!data || typeof data !== "object") return entry;
    const next = { ...data };
    if ("task" in data) next.task = sortKeysDeep(data.task);
    if ("tasks" in data) next.tasks = sortKeysDeep(data.tasks);
    return { ...entry, data: next };
  }) };
}
var OPERATION_FIELDS = Object.fromEntries(Object.entries(ALLOWED).map(([op, fields]) => [op, ["key", "op", ...fields]]));
var fail2 = (code, message, retryable = false) => ({ code, message, retryable });
function splitEvidence(evidence) {
  const parts = evidence.split(/[;,]\s*(?=tool:[^\s;,]*|[^\s;,]*(?:\/|\.[A-Za-z0-9]{1,8}(?:#|$)))/g).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [evidence.trim()];
}
var clone = (x) => structuredClone(x);
var isObj2 = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var taskRef = () => ({ oneOf: [{ type: "string" }, { type: "object", required: ["ref"], additionalProperties: false, properties: { ref: { type: "string" }, field: { type: "string", enum: ["taskId"] } } }] });
var FIELD_SCHEMA = {
  key: () => ({ type: "string", description: 'Correlation handle for this operation; unique within the batch. Later operations may target it as taskId:{"ref":"<key>"}.' }),
  op: () => ({ type: "string", enum: ["create", "update", "get", "list"] }),
  taskId: taskRef,
  parentTaskId: taskRef,
  subject: () => ({ type: "string" }),
  description: () => ({ type: "string" }),
  activeForm: () => ({ type: "string" }),
  category: () => ({ type: "string", enum: CATEGORIES2 }),
  priority: () => ({ type: "string", enum: PRIORITIES2 }),
  metadata: () => ({ type: "object" }),
  owner_id: () => ({ type: "string" }),
  status: () => ({ type: "string", enum: ["pending", "in_progress", "completed", "deleted"] }),
  active: () => ({ type: "boolean" }),
  limit: () => ({ type: "integer", minimum: 1, maximum: 500 }),
  offset: () => ({ type: "integer", minimum: 0 }),
  addBlocks: () => ({ type: "array", items: taskRef() }),
  addBlockedBy: () => ({ type: "array", items: taskRef() }),
  addNote: () => ({ type: "string" }),
  noteType: () => ({ type: "string", enum: NOTE_TYPES2 }),
  include_audit: () => ({ type: "boolean" }),
  questions: () => ({ type: "array", minItems: 1, maxItems: MAX_TASK_QUESTIONS2, items: { type: "object", required: ["id", "text"], additionalProperties: false, properties: { id: { type: "string", minLength: 1, maxLength: MAX_QUESTION_ID_LENGTH2 }, text: { type: "string", minLength: 1, maxLength: MAX_QUESTION_TEXT_LENGTH2 } } } }),
  answers: () => ({ type: "array", minItems: 1, maxItems: MAX_TASK_QUESTIONS2, items: { type: "object", required: ["question", "answer", "evidence"], additionalProperties: false, properties: { question: { type: "string", minLength: 1, maxLength: MAX_QUESTION_ID_LENGTH2, description: "The id of the question being answered." }, answer: { type: "string", minLength: 1, maxLength: MAX_ANSWER_LENGTH2 }, evidence: { type: "string", minLength: 1, maxLength: MAX_EVIDENCE_LENGTH2, description: 'One or more references, separated by ";" or ",": file#Lx-Ly, file#L42, file.md#Heading, a bare file path, or tool:<ToolName> with optional #<n> (1-based) citing a live tool result from this session. Every reference must resolve.' } } } })
};
var REQUIRED_FIELDS = {
  // `questions` is enforced at runtime (see TaskManager.validate) and must be
  // advertised here, or the model reads it as optional and every minimal
  // create is rejected by a rule it was never shown.
  create: ["subject", "questions"],
  update: ["taskId"],
  get: ["taskId"],
  list: []
};
var operationSchema = (op) => ({
  type: "object",
  required: ["key", "op", ...REQUIRED_FIELDS[op]],
  additionalProperties: false,
  properties: Object.fromEntries([
    ["key", FIELD_SCHEMA.key()],
    ["op", { const: op }],
    ...OPERATION_FIELDS[op].filter((field) => field !== "key" && field !== "op").map((field) => [field, FIELD_SCHEMA[field]()])
  ])
});
var taskManageSchema = {
  type: "object",
  required: ["operations"],
  additionalProperties: false,
  properties: {
    description: { type: "string", description: "Brief rendering label for this call; not stored on tasks." },
    mode: { type: "string", enum: ["sequential", "atomic"] },
    operations: { type: "array", minItems: 1, maxItems: 50, items: { oneOf: ["create", "update", "get", "list"].map(operationSchema) } }
  }
};
var style = (theme, color, value) => theme.fg ? theme.fg(color, value) : value;
var bold = (theme, value) => theme.bold ? theme.bold(value) : value;
var dim = (theme, value) => theme.dim ? theme.dim(value) : value;
var characterWidth = (character) => {
  const point = character.codePointAt(0) ?? 0;
  if (new RegExp("\\p{Mark}", "u").test(character)) return 0;
  return point >= 4352 && (point <= 4447 || point === 9001 || point === 9002 || point >= 11904 && point <= 42191 || point >= 44032 && point <= 55203 || point >= 63744 && point <= 64255 || point >= 65040 && point <= 65135 || point >= 65280 && point <= 65376 || point >= 127744 && point <= 129791) ? 2 : 1;
};
var taskDisplayWidth = (value) => Array.from(value).reduce((width, character) => width + characterWidth(character), 0);
var truncateTaskText = (value, width) => {
  const limitWidth = Math.max(0, width);
  if (taskDisplayWidth(value) <= limitWidth) return value;
  const limit = Math.max(0, limitWidth - 1);
  let used = 0;
  let result = "";
  for (const character of value) {
    const next = characterWidth(character);
    if (used + next > limit) break;
    result += character;
    used += next;
  }
  return `${result}${limitWidth > 0 ? "\u2026" : ""}`;
};
var truncate = truncateTaskText;
var component = (lines) => ({
  render: (width) => typeof lines === "function" ? lines(width) : lines,
  invalidate: () => {
  }
});
var questionSummary = (task) => {
  const questions = Array.isArray(task.questions) ? task.questions : [];
  const ids = /* @__PURE__ */ new Set();
  const valid = questions.filter((question) => {
    const ok = !!question && typeof question.id === "string" && question.id.trim() !== "" && typeof question.text === "string" && question.text.trim() !== "" && !ids.has(question.id);
    if (ok) ids.add(question.id);
    return ok;
  });
  const answers = Array.isArray(task.answers) ? task.answers : [];
  const answered = new Set(answers.filter((answer) => answer && typeof answer.question === "string" && ids.has(answer.question) && typeof answer.answer === "string" && answer.answer.trim() && typeof answer.evidence === "string" && answer.evidence.trim()).map((answer) => answer.question));
  return { total: valid.length, answered: answered.size, unresolved: valid.filter((question) => !answered.has(question.id)), malformed: valid.length !== questions.length };
};
var renderQuestionLines = (task, prefix, width, theme) => {
  const summary2 = questionSummary(task);
  if (!summary2.total) return summary2.malformed ? [truncate(`${prefix}? questions unavailable (malformed)`, width)] : [truncate(`${prefix}? acceptance questions missing \u2014 repair required`, width)];
  const lines = [`${prefix}${summary2.unresolved.length ? style(theme, "warning", "?") : style(theme, "success", "\u2713")} questions: ${summary2.answered}/${summary2.total} answered`];
  for (const question of summary2.unresolved.slice(0, 3)) lines.push(truncate(`${prefix}  ${question.id}: ${question.text}`, width));
  if (summary2.unresolved.length > 3) lines.push(truncate(`${prefix}  +${summary2.unresolved.length - 3} more unresolved`, width));
  return lines;
};
function taskRows(batch) {
  const order = [];
  const tasks = /* @__PURE__ */ new Map();
  const errors = [];
  let anonymous = 0;
  for (const result of batch.results) {
    if (result.error) {
      errors.push(result.error.message || "Task update failed");
      continue;
    }
    if (result.status !== "succeeded" || !isObj2(result.data)) continue;
    const data = result.data;
    const values = data.task ? [data.task] : Array.isArray(data.tasks) ? data.tasks : [];
    for (const task of values) {
      const key = task.id || `__anonymous_${anonymous++}`;
      if (!tasks.has(key)) order.push(key);
      tasks.set(key, task);
    }
  }
  return { tasks: order.map((key) => tasks.get(key)), errors };
}
function renderTaskResult(task, first, width, theme) {
  const prefix = first ? "    \u23BF " : "      ";
  const rawIcon = task.status === "completed" ? "\u2713" : task.status === "in_progress" ? "\u25C9" : task.status === "pending" ? "\u25CB" : "?";
  if (width <= taskDisplayWidth(prefix) + 2) return truncate(`${prefix}${rawIcon}`, width);
  const icon2 = task.status === "completed" ? style(theme, "success", rawIcon) : task.status === "in_progress" ? style(theme, "warning", rawIcon) : dim(theme, rawIcon);
  const label = `${task.id ? `#${task.id} ` : ""}${task.content || task.subject || "Untitled task"}`;
  const available = Math.max(0, width - taskDisplayWidth(prefix) - 2);
  const text3 = truncate(label, available);
  const rendered = task.status === "in_progress" ? bold(theme, text3) : task.status === "completed" ? dim(theme, text3) : text3;
  return `${prefix}${icon2} ${rendered}`;
}
var taskManageRenderers = {
  renderCall(_args, theme) {
    return component([`${bold(theme, "TaskManage")} ${dim(theme, "Managing tasks\u2026")}`]);
  },
  renderResult(result, options, theme) {
    if (options.isPartial)
      return component([`    ${dim(theme, "\u23BF")} ${dim(theme, "Managing tasks\u2026")}`]);
    let batch;
    const structured = result?.details?.batch ?? result?.details;
    if (structured && Array.isArray(structured.results)) batch = structured;
    const text3 = result?.content?.find((item) => item?.type === "text")?.text;
    if (!batch && typeof text3 === "string") {
      try {
        batch = JSON.parse(text3);
      } catch {
      }
    }
    if (!batch || !Array.isArray(batch.results)) {
      const message = options.isError ? "Task update failed" : "Task state unavailable";
      return component([`    ${dim(theme, "\u23BF")} ${options.isError ? style(theme, "error", message) : dim(theme, message)}`]);
    }
    const rows = taskRows(batch);
    if (!rows.tasks.length && !rows.errors.length)
      return component([`    ${dim(theme, "\u23BF")} ${dim(theme, "Tasks unchanged")}`]);
    return component((width) => {
      const lines = rows.tasks.flatMap((task, index) => [renderTaskResult(task, index === 0, width, theme), ...renderQuestionLines(task, "      ", width, theme)]);
      for (const message of rows.errors) {
        const prefix = lines.length ? "      " : "    \u23BF ";
        lines.push(`${prefix}${style(theme, "error", "\u2717")} ${truncate(message, Math.max(0, width - taskDisplayWidth(prefix) - 2))}`);
      }
      return lines;
    });
  }
};
function taskWidgetRenderer(tasks, theme) {
  const summary2 = taskFocusSummary(tasks);
  return component((width) => {
    const rows = [bold(theme, dim(theme, truncate(`Tasks  ${summary2.completed}/${summary2.completed + summary2.open} done   /tasks`, width)))];
    const task = summary2.focus;
    rows.push(task ? style(theme, "accent", bold(theme, truncate(`  \u25CF #${task.id} ${task.subject}  Q ${summary2.focusQuestions.answered}/${summary2.focusQuestions.total}`, width))) : dim(theme, truncate("  \u25CB No task focused", width)));
    if (task) {
      if (!task.questions?.length) rows.push(style(theme, "warning", truncate("    ! Acceptance questions missing \u2014 repair required", width)));
      for (const q2 of task.questions ?? []) {
        const answered = task.answers?.some((a) => a.question === q2.id && a.answer?.trim() && a.evidence?.trim());
        rows.push(style(theme, answered ? "success" : "warning", truncate(`    ${answered ? "\u2713" : "?"} ${q2.id}: ${q2.text}`, width)));
      }
    }
    rows.push(dim(theme, truncate(summary2.next ? `  \u21B3 Next #${summary2.next.id} ${summary2.next.subject}` : "  \u21B3 No unblocked next task", width)));
    return rows;
  });
}
var taskFocusSummary = (tasks, shortcut = "/tasks") => {
  const current = tasks.filter((task) => task.status !== "deleted");
  const byId = new Map(current.map((task) => [task.id, task]));
  const blocked = (task) => task.dependsOn.some((id) => byId.get(id)?.status !== "completed");
  const openTasks = current.filter((task) => task.status === "pending" || task.status === "in_progress");
  const focus = current.find((task) => task.active && task.status === "in_progress");
  const focusQuestions = focus ? questionSummary(focus) : { total: 0, answered: 0, unresolved: [], malformed: false };
  const eligible = openTasks.filter((task) => !blocked(task) && task.id !== focus?.id && !openTasks.some((child) => child.parentTaskId === task.id));
  return {
    open: openTasks.length,
    blocked: openTasks.filter(blocked).length,
    completed: current.filter((task) => task.status === "completed").length,
    focus,
    focusQuestions,
    next: eligible[0],
    remaining: eligible.length,
    shortcut
  };
};
var TaskManager = class {
  constructor(persist, emitOperation, options = {}, worktrees = void 0) {
    this.persist = persist;
    this.emitOperation = emitOperation;
    this.options = options;
    this.worktrees = worktrees;
    if (options.resolveEvidence && (options.evidenceRoots !== void 0 || options.canReadEvidence !== void 0)) throw new Error("resolveEvidence is an exclusive trusted resolver; do not combine it with evidenceRoots or canReadEvidence");
  }
  persist;
  emitOperation;
  options;
  worktrees;
  state = { nextId: 1, tasks: [], keys: {} };
  revision = 0;
  stats = { mutations: 0, reads: 0, failures: 0, lastRevision: 0 };
  snapshot() {
    return clone(this.state);
  }
  metrics() {
    return { ...this.stats };
  }
  /** Append a compact, already-sanitized tool observation to the focused task. */
  appendActiveAuditEvent(event) {
    const task = this.state.tasks.find((candidate) => candidate.status === "in_progress" && candidate.active);
    if (!task) return false;
    const at = event.at ?? (/* @__PURE__ */ new Date()).toISOString();
    (task.audit_events ??= []).push({ action: "tool", at, ...event });
    task.updatedAt = at;
    this.commit();
    return true;
  }
  restore(state) {
    const restored = clone(state);
    if (!restored || !Array.isArray(restored.tasks) || !Number.isFinite(restored.nextId) || !isObj2(restored.keys)) {
      this.state = { nextId: 1, tasks: [], keys: {} };
      return;
    }
    const tasks = restored.tasks.filter((task) => isObj2(task) && typeof task.id === "string" && task.id.trim() && typeof task.subject === "string" && task.subject.trim()).map((task) => {
      const normalized = task;
      normalized.subject = normalized.subject.trim();
      normalized.status = ["pending", "in_progress", "completed", "deleted"].includes(normalized.status) ? normalized.status : "pending";
      normalized.priority = PRIORITIES2.includes(normalized.priority) ? normalized.priority : "medium";
      normalized.category = CATEGORIES2.includes(normalized.category) ? normalized.category : "acting";
      normalized.dependsOn = Array.isArray(normalized.dependsOn) ? [...new Set(normalized.dependsOn.filter((id) => typeof id === "string" && id !== normalized.id))] : [];
      normalized.notes = Array.isArray(normalized.notes) ? normalized.notes.filter((note) => typeof note === "string") : [];
      normalized.questions = Array.isArray(normalized.questions) ? normalized.questions.filter((question) => this.validQuestion(question)) : void 0;
      normalized.answers = Array.isArray(normalized.answers) ? normalized.answers.filter((answer) => this.validAnswer(answer)) : void 0;
      normalized.active = normalized.status === "in_progress" && normalized.active === true;
      if (normalized.parentTaskId === normalized.id || typeof normalized.parentTaskId !== "string") delete normalized.parentTaskId;
      normalized.audit_events = Array.isArray(normalized.audit_events) ? normalized.audit_events.filter((event) => isObj2(event) && typeof event.at === "string" && typeof event.action === "string") : [];
      if (!Array.isArray(normalized.typed_notes)) delete normalized.typed_notes;
      return normalized;
    });
    const ids = new Set(tasks.map((task) => task.id));
    for (const task of tasks) {
      task.dependsOn = task.dependsOn.filter((id) => ids.has(id));
      if (task.parentTaskId && !ids.has(task.parentTaskId)) delete task.parentTaskId;
    }
    for (const task of tasks) {
      const seen = /* @__PURE__ */ new Set();
      let current = task;
      while (current?.parentTaskId) {
        if (seen.has(current.id)) {
          delete task.parentTaskId;
          break;
        }
        seen.add(current.id);
        current = tasks.find((candidate) => candidate.id === current.parentTaskId);
      }
    }
    let focused = false;
    for (const task of tasks) {
      if (task.active && !focused) focused = true;
      else task.active = false;
    }
    const keys = {};
    for (const [key, id] of Object.entries(restored.keys)) if (typeof id === "string" && ids.has(id)) keys[key] = id;
    const maxID = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0);
    this.state = { nextId: Math.max(1, Math.floor(restored.nextId), maxID + 1), tasks, keys };
  }
  rehydrate(entries) {
    this.state = { nextId: 1, tasks: [], keys: {} };
    this.revision = 0;
    this.stats = { mutations: 0, reads: 0, failures: 0, lastRevision: 0 };
    const replayed = replayLatest(entries, "pi-swarm-task-state", (value) => value);
    if (replayed) {
      this.restore(replayed.state);
      this.revision = replayed.revision;
      this.stats.lastRevision = this.revision;
    }
  }
  commit() {
    this.revision++;
    this.stats.mutations++;
    this.stats.lastRevision = this.revision;
    this.persist?.({ type: "pi-swarm-task-state", data: snapshot(this.snapshot(), this.revision) });
  }
  find(id) {
    return this.state.tasks.find((t) => t.id === id);
  }
  resolve(ref, local) {
    if (typeof ref === "number" && Number.isInteger(ref)) ref = String(ref);
    if (isObj2(ref) && typeof ref.ref === "number" && Number.isInteger(ref.ref)) ref = { ...ref, ref: String(ref.ref) };
    if (typeof ref === "string") {
      return this.find(ref) ? ref : local[ref] ?? this.state.keys[ref] ?? ref;
    }
    if (!ref) return fail2("validation_failed", "taskId is required");
    if (ref.field && ref.field !== "taskId") return fail2("validation_failed", "reference field must be taskId");
    const id = local[ref.ref] ?? this.state.keys[ref.ref] ?? (this.find(ref.ref) ? ref.ref : void 0);
    return id ?? fail2("reference_failed", `reference ${ref.ref} is not available`);
  }
  inferCategory(text3) {
    const value = text3.toLowerCase();
    const rules = [
      ["planning", ["plan", "design", "architect", "strategy", "specification", "specify", "outline", "draft", "proposal", "tech spec", "write spec", "create spec"]],
      ["researching", ["research", "explore", "investigate", "search", "find", "analyze", "read", "understand", "study", "review docs", "check docs", "examine", "discover"]],
      ["debugging", ["debug", "troubleshoot", "trace error", "trace bug", "resolve error", "resolve issue", "investigate error", "fix bug", "fix error", "fix crash", "fix panic", "stack trace", "segfault", "deadlock"]],
      ["verifying", ["test", "verify", "validate", "check", "confirm", "assert", "ensure", "prove", "inspect"]],
      ["documenting", ["document", "write docs", "add docs", "update docs", "readme", "changelog", "comment", "comments", "documentation", "docstring", "javadoc", "godoc"]]
    ];
    for (const [category, words] of rules) if (words.some((word) => value.includes(word))) return category;
    return "acting";
  }
  validate(op, index) {
    if (!isObj2(op) || typeof op.key !== "string" || !op.key || !["create", "update", "get", "list"].includes(op.op))
      return fail2("validation_failed", `operation ${index} must contain a valid key and op`);
    for (const field of Object.keys(op)) if (!OPERATION_FIELDS[op.op]?.includes(field))
      return fail2("validation_failed", `operation ${op.key}: field ${field} is not valid for ${op.op}`);
    for (const field of ["taskId", "parentTaskId"]) {
      const error = this.validateRef(op[field], field);
      if (error) return error;
    }
    for (const field of ["addBlocks", "addBlockedBy"]) {
      const refs = op[field];
      if (refs !== void 0 && (!Array.isArray(refs) || refs.some((ref) => ref === void 0 || this.validateRef(ref, field)))) {
        return fail2("validation_failed", `operation ${op.key}: ${field} must contain only task IDs or {ref, field:"taskId"} references`);
      }
    }
    const stringFields = ["subject", "description", "activeForm", "owner_id", "addNote", "noteType", "category", "priority", "status"];
    for (const field of stringFields) {
      if (op[field] !== void 0 && typeof op[field] !== "string")
        return fail2("validation_failed", `operation ${op.key}: ${field} must be a string`);
    }
    if (op.metadata !== void 0 && (!isObj2(op.metadata) || !this.isJSONValue(op.metadata)))
      return fail2("validation_failed", `operation ${op.key}: metadata must be a JSON-compatible object`);
    const questionError = this.validateQuestions(op.questions, op.key);
    if (questionError) return questionError;
    const answerError = this.validateAnswers(op.answers, op.key);
    if (answerError) return answerError;
    for (const field of ["active", "include_audit"]) {
      if (op[field] !== void 0 && typeof op[field] !== "boolean")
        return fail2("validation_failed", `operation ${op.key}: ${field} must be a boolean`);
    }
    if (op.op === "create" && (!op.subject || !op.subject.trim())) return fail2("validation_failed", `operation ${op.key}: subject must not be blank`);
    if (op.active === true && (op.op === "create" || op.status !== void 0) && op.status !== "in_progress")
      return fail2("validation_failed", `operation ${op.key}: active task must be in_progress`);
    if (op.category !== void 0 && !CATEGORIES2.includes(op.category)) return fail2("validation_failed", `operation ${op.key}: invalid category ${op.category}`);
    if (op.priority !== void 0 && !PRIORITIES2.includes(op.priority)) return fail2("validation_failed", `operation ${op.key}: invalid priority ${op.priority}`);
    if (op.status !== void 0 && !["pending", "in_progress", "completed", "deleted"].includes(op.status)) return fail2("validation_failed", `operation ${op.key}: invalid status ${op.status}`);
    if (op.op === "create" && op.status === "completed") return fail2("validation_failed", `operation ${op.key}: tasks must be created pending or in_progress and completed only after evidence-backed work`);
    if (op.op === "create" && (!Array.isArray(op.questions) || op.questions.length === 0)) return fail2("validation_failed", `operation ${op.key}: new tasks require 1..${MAX_TASK_QUESTIONS2} task-specific acceptance questions`);
    if (op.noteType !== void 0 && !NOTE_TYPES2.includes(op.noteType)) return fail2("validation_failed", `operation ${op.key}: invalid noteType ${op.noteType}`);
    if (op.limit !== void 0 && (!Number.isInteger(op.limit) || op.limit < 1 || op.limit > 500)) return fail2("validation_failed", `operation ${op.key}: limit must be 1..500`);
    if (op.offset !== void 0 && (!Number.isInteger(op.offset) || op.offset < 0)) return fail2("validation_failed", `operation ${op.key}: offset must be non-negative`);
    return void 0;
  }
  isJSONValue(value, seen = /* @__PURE__ */ new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    const valid = Array.isArray(value) ? value.every((item) => this.isJSONValue(item, seen)) : isObj2(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) && Object.values(value).every((item) => this.isJSONValue(item, seen));
    seen.delete(value);
    return valid;
  }
  validateRef(value, field) {
    if (value === void 0) return void 0;
    if (typeof value === "number" && Number.isInteger(value)) value = String(value);
    else if (isObj2(value) && typeof value.ref === "number" && Number.isInteger(value.ref)) value = { ...value, ref: String(value.ref) };
    if (typeof value === "string") {
      return value.trim() || field === "parentTaskId" ? void 0 : fail2("validation_failed", `${field} must be a task ID or reference`);
    }
    if (!isObj2(value) || typeof value.ref !== "string" || !value.ref.trim() || value.field !== void 0 && value.field !== "taskId" || Object.keys(value).some((key) => key !== "ref" && key !== "field"))
      return fail2("validation_failed", `${field} must be a task ID or {ref, field:"taskId"} reference`);
    return void 0;
  }
  validQuestion(value) {
    return isObj2(value) && Object.keys(value).every((key) => key === "id" || key === "text") && typeof value.id === "string" && value.id.trim().length > 0 && value.id.length <= MAX_QUESTION_ID_LENGTH2 && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= MAX_QUESTION_TEXT_LENGTH2;
  }
  validAnswer(value) {
    return isObj2(value) && Object.keys(value).every((key) => key === "question" || key === "answer" || key === "evidence") && typeof value.question === "string" && value.question.trim().length > 0 && value.question.length <= MAX_QUESTION_ID_LENGTH2 && typeof value.answer === "string" && value.answer.trim().length > 0 && value.answer.length <= MAX_ANSWER_LENGTH2 && (typeof value.evidence === "string" && value.evidence.trim().length > 0 && value.evidence.length <= MAX_EVIDENCE_LENGTH2);
  }
  validateQuestions(questions, key) {
    if (questions === void 0) return;
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_TASK_QUESTIONS2 || questions.some((q2) => !this.validQuestion(q2)) || new Set(questions.map((q2) => q2.id)).size !== questions.length) return fail2("validation_failed", `operation ${key}: questions must contain 1..${MAX_TASK_QUESTIONS2} unique {id,text} items within bounds`);
  }
  validateAnswers(answers, key) {
    if (answers === void 0) return;
    if (!Array.isArray(answers)) return fail2("validation_failed", `operation ${key}: answers must be an array`);
    if (answers.length < 1 || answers.length > MAX_TASK_QUESTIONS2) return fail2("validation_failed", `operation ${key}: answers must contain 1..${MAX_TASK_QUESTIONS2} items`);
    for (const [index, answer] of answers.entries()) {
      if (!isObj2(answer)) return fail2("validation_failed", `operation ${key}: answers[${index}] must be an object`);
      if (typeof answer.question !== "string" || !answer.question.trim()) return fail2("validation_failed", `operation ${key}: answers[${index}].question must be a non-empty string`);
      if (answer.question.length > MAX_QUESTION_ID_LENGTH2) return fail2("validation_failed", `operation ${key}: answers[${index}].question exceeds ${MAX_QUESTION_ID_LENGTH2} characters`);
      if (typeof answer.answer !== "string" || !answer.answer.trim()) return fail2("validation_failed", `operation ${key}: answers[${index}].answer must be a non-empty string`);
      if (answer.answer.length > MAX_ANSWER_LENGTH2) return fail2("validation_failed", `operation ${key}: answers[${index}].answer exceeds ${MAX_ANSWER_LENGTH2} characters`);
      if (typeof answer.evidence !== "string" || !answer.evidence.trim()) return fail2("validation_failed", `operation ${key}: answers[${index}].evidence must be a non-empty string`);
      if (answer.evidence.length > MAX_EVIDENCE_LENGTH2) return fail2("validation_failed", `operation ${key}: answers[${index}].evidence exceeds ${MAX_EVIDENCE_LENGTH2} characters`);
      if (Object.keys(answer).some((field) => !["question", "answer", "evidence"].includes(field))) return fail2("validation_failed", `operation ${key}: answers[${index}] contains an unknown field`);
    }
    const duplicate = answers.findIndex((answer, index) => answers.findIndex((other) => other.question === answer.question) !== index);
    if (duplicate >= 0) return fail2("validation_failed", `operation ${key}: answers[${duplicate}].question duplicates an earlier question id`);
  }
  /**
   * Saved answers survive when their question still exists with identical
   * text; a reworded or removed question drops only its own answer.
   */
  retainedAnswers(task, questions) {
    if (!questions) return [...task.answers ?? []];
    const textById = new Map((task.questions ?? []).map((question) => [question.id, question.text]));
    return (task.answers ?? []).filter((answer) => {
      const current = questions.find((question) => question.id === answer.question);
      return !!current && textById.get(answer.question) === current.text;
    });
  }
  /** Supplied answers override saved ones by question ID; order follows the question list. */
  mergeAnswers(task, op) {
    if (op.questions === void 0 && !task.questions?.length && !op.answers?.length) return clone(task.answers ?? []);
    const questions = op.questions ?? task.questions ?? [];
    const merged = new Map(this.retainedAnswers(task, op.questions).map((answer) => [answer.question, answer]));
    for (const answer of op.answers ?? []) {
      const saved = clone(answer);
      if (this.options.canonicalizeToolEvidence) saved.evidence = splitEvidence(saved.evidence).map((ref) => this.options.canonicalizeToolEvidence(ref)).join("; ");
      merged.set(answer.question, saved);
    }
    return questions.filter((question) => merged.has(question.id)).map((question) => merged.get(question.id));
  }
  completionError(task, op) {
    if (task.status === "completed" && op.questions !== void 0 && (op.status === void 0 || op.status === "completed")) return fail2("validation_failed", "reopen task before changing questions");
    if (op.status !== "completed" && op.status !== "in_progress") return;
    if (!task.questions?.length) return fail2("validation_failed", `task ${task.id} is a legacy questionless task; repair it with task-specific questions before resuming or completing`);
    if (op.status !== "completed") return;
    if (op.questions !== void 0) return fail2("validation_failed", "cannot replace or drop questions while completing a task");
    const ids = /* @__PURE__ */ new Set();
    const malformed = task.questions.some((question) => !this.validQuestion(question) || ids.has(question.id) || !ids.add(question.id));
    if (malformed) return fail2("validation_failed", `cannot complete task ${task.id}: task questions are malformed or duplicated. Re-read the task and repair questions before completing`);
    const supplied = /* @__PURE__ */ new Set();
    for (const answer of op.answers ?? []) {
      if (supplied.has(answer.question)) return fail2("validation_failed", `duplicate answer for question id: ${answer.question}`);
      supplied.add(answer.question);
      if (!ids.has(answer.question)) return fail2("validation_failed", `unknown question id: ${answer.question}`);
    }
    const answers = this.mergeAnswers(task, op);
    const seen = new Set(answers.map((answer) => answer.question));
    const missing = task.questions.filter((question) => !seen.has(question.id));
    if (missing.length) return fail2("validation_failed", `missing answers for question(s): ${missing.map((question) => `${question.id} (${question.text})`).join("; ")}. Re-read the task, then retry with status:"completed" and answers:[{question:"<question id>",answer:"<truthful answer>",evidence:"path/to/file.md#Heading, path/to/file.ts#L1-L2, or tool:<ToolName>#<n> for a live tool result from this session"}] for every listed question; do not invent answers or evidence`);
    for (const answer of answers) {
      if (!answer.evidence) continue;
      const unresolved = splitEvidence(answer.evidence).flatMap((reference) => {
        this.evidenceReason = "unavailable";
        return this.resolveEvidence(reference) ? [] : [`${reference} (${this.evidenceReason})`];
      });
      if (unresolved.length) return fail2("validation_failed", `evidence reference is unavailable: ${unresolved.join("; ")}`);
    }
  }
  /**
   * Accept the citation shapes agents actually write. A bare path cites a whole
   * file; `#Lx`, `#Lx-Ly` and `#Heading` narrow it. Multi-file citations are
   * split by `splitEvidence` before reaching here.
   */
  evidenceReason = "unavailable";
  resolveEvidence(reference) {
    if (this.options.resolveEvidence) {
      if (this.options.evidenceRoots !== void 0 || this.options.canReadEvidence !== void 0) {
        this.evidenceReason = "conflicting_resolver_policy";
        return false;
      }
      return this.options.resolveEvidence(reference) === true;
    }
    if (/^tool:/i.test(reference)) {
      this.evidenceReason = "tool_result_unavailable: use an exact registered tool name and a current-branch result index" + (this.options.sessionEvidenceHints?.() ?? "");
      return this.options.resolveSessionEvidence?.(reference) === true;
    }
    const match = /^([^#]+?)(?:#(L\d+(?:-L\d+)?|[^#\s].*))?$/.exec(reference.trim());
    if (!match || !this.options.workspaceRoot) {
      this.evidenceReason = "invalid_reference_or_missing_workspace";
      return false;
    }
    const roots = [resolvePath(this.options.workspaceRoot), ...this.linkedWorktreeRoots(), ...(this.options.evidenceRoots ?? []).map((root) => resolvePath(root))];
    this.evidenceReason = "outside_allowed_roots: use the workspace, a linked worktree, or a host-authorized evidence root";
    for (const root of roots) {
      const file = resolvePath(root, match[1]);
      const rel = relativePath(root, file);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith("../")) continue;
      try {
        this.evidenceReason = "missing_file";
        const physical = relativePath(realpathSync(root), realpathSync(file));
        if (isAbsolute(physical) || physical === ".." || physical.startsWith("../")) {
          this.evidenceReason = "outside_allowed_roots: symlink escape";
          continue;
        }
        if (this.options.canReadEvidence && this.options.canReadEvidence(realpathSync(file)) !== true) {
          this.evidenceReason = "access_denied";
          continue;
        }
        const stat = statSync(file);
        if (!stat.isFile()) {
          this.evidenceReason = "not_a_file";
          continue;
        }
        if (stat.size > 1024 * 1024) {
          this.evidenceReason = "file_too_large";
          continue;
        }
        const text3 = readFileSync(file, "utf8"), section = match[2];
        if (section === void 0) return true;
        const lines = /^L(\d+)(?:-L(\d+))?$/.exec(section);
        if (lines) {
          const start = Number(lines[1]), end = lines[2] === void 0 ? start : Number(lines[2]);
          this.evidenceReason = "invalid_line_range";
          return start >= 1 && end >= start && end <= text3.split("\n").length;
        }
        this.evidenceReason = "missing_heading";
        if (!/\.md$/i.test(file)) return false;
        const loose = (value) => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        return text3.split("\n").some((line) => {
          if (!/^#{1,6}\s+/.test(line)) return false;
          const heading = line.replace(/^#{1,6}\s+/, "").trim();
          return heading === section || heading.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-") === section || loose(heading) === loose(section);
        });
      } catch (error) {
        const code = error?.code;
        this.evidenceReason = code === "ENOENT" || code === "ENOTDIR" ? "missing_file" : code === "EACCES" || code === "EPERM" ? "access_denied" : "evidence_io_error";
        continue;
      }
    }
    return false;
  }
  /**
   * Linked worktrees of the workspace repository, primary root excluded.
   * Discovery refreshes `git worktree list` once per execute batch
   * and degrades to an empty list outside a git repository or without git.
   */
  linkedWorktreeRoots() {
    const now = Date.now();
    if (!this.worktrees) {
      let list = [];
      try {
        const out = execFileSync("git", ["-C", String(this.options.workspaceRoot), "worktree", "list", "--porcelain"], { timeout: 5e3, stdio: ["ignore", "pipe", "ignore"] }).toString();
        list = out.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length));
      } catch {
        list = [];
      }
      this.worktrees = { at: now, roots: list };
    }
    let primary = "";
    try {
      primary = this.options.workspaceRoot ? realpathSync(this.options.workspaceRoot) : "";
    } catch {
    }
    return this.worktrees.roots.filter((root) => root !== primary).filter((root) => existsSync(root));
  }
  execute(params, signal) {
    this.worktrees = void 0;
    if (!isObj2(params))
      return { status: "failed", results: [{ key: "batch", op: "list", status: "failed", error: fail2("validation_failed", "unknown batch field") }] };
    const unknownField = Object.keys(params).find((key) => key !== "operations" && key !== "mode" && key !== "description");
    if (unknownField !== void 0)
      return { status: "failed", results: [{ key: "batch", op: "list", status: "failed", error: fail2("validation_failed", `unknown top-level field ${JSON.stringify(unknownField)}`) }] };
    if (params.description !== void 0 && typeof params.description !== "string")
      return { status: "failed", results: [{ key: "batch", op: "list", status: "failed", error: fail2("validation_failed", "description must be a string") }] };
    const ops = Array.isArray(params.operations) ? params.operations.map((operation) => {
      if (!isObj2(operation)) return operation;
      const normalized = { ...operation };
      const untrusted = normalized;
      for (const field of ["category", "priority", "status", "noteType"]) {
        if (untrusted[field] === "") delete normalized[field];
      }
      return normalized;
    }) : params.operations;
    if (Array.isArray(ops)) this.stats.reads += ops.filter((op) => op?.op === "get" || op?.op === "list").length;
    if (!Array.isArray(ops) || !ops.length || ops.length > 50) return { status: "failed", results: [{ key: "batch", op: "list", status: "failed", error: fail2("validation_failed", "operations must contain 1..50 operations") }] };
    if (params.mode && params.mode !== "sequential" && params.mode !== "atomic") return { status: "failed", results: [{ key: "batch", op: "list", status: "failed", error: fail2("validation_failed", "unsupported mode") }] };
    const seen = /* @__PURE__ */ new Map();
    for (let i = 0; i < ops.length; i++) {
      const e = this.validate(ops[i], i);
      if (e) return { status: "failed", results: [{ key: ops[i]?.key ?? "batch", op: ops[i]?.op ?? "list", status: "failed", error: e }] };
      const prior = seen.get(ops[i].key);
      if (prior && (prior === "create" || ops[i].op === "create") && !(prior === "create" && ops[i].op !== "create")) return { status: "failed", results: [{ key: ops[i].key, op: ops[i].op, status: "failed", error: fail2("validation_failed", `duplicate operation key ${ops[i].key}`) }] };
      seen.set(ops[i].key, prior ?? ops[i].op);
    }
    const before = this.snapshot(), local = {}, results = [];
    let stopped = false;
    for (const op of ops) {
      if (stopped) {
        results.push({ key: op.key, op: op.op, status: "skipped" });
        continue;
      }
      if (signal?.aborted) {
        results.push({ key: op.key, op: op.op, status: "failed", error: fail2("cancelled", "operation cancelled") });
        stopped = true;
        continue;
      }
      const operationBefore = this.snapshot(), localBefore = { ...local };
      const existingId = op.op === "create" ? this.state.keys[op.key] : void 0;
      let result;
      try {
        result = existingId ? this.replayedCreate(op, existingId) : this.run(op, local);
      } catch {
        result = { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", "operation validation failed unexpectedly; inspect host evidence configuration") };
      }
      results.push(result);
      if (result.status === "succeeded" && !existingId && (op.op === "create" || op.op === "update" && op.status !== "deleted")) {
        const produced = result.data;
        if (produced?.task?.id) {
          this.state.keys[op.key] = produced.task.id;
          local[op.key] = produced.task.id;
        }
      }
      if (result.status === "failed") {
        stopped = true;
        this.restore(params.mode === "atomic" ? before : operationBefore);
        for (const key of Object.keys(local)) delete local[key];
        Object.assign(local, localBefore);
        if (params.mode === "atomic") this.restore(before);
      } else if (result.status === "succeeded" && params.mode !== "atomic" && (op.op === "create" || op.op === "update")) {
        this.commit();
      }
    }
    if (params.mode === "atomic" && !stopped && ops.some((op, i) => (op.op === "create" || op.op === "update") && results[i]?.status === "succeeded")) this.commit();
    if (params.mode === "atomic" && stopped) {
      this.restore(before);
      const failedIndex = results.findIndex((r) => r.status === "failed");
      for (let i = 0; i < failedIndex; i++) {
        results[i] = {
          ...results[i],
          status: "failed",
          data: void 0,
          error: fail2("atomic_rollback", "operation was rolled back because the atomic batch failed")
        };
      }
    }
    const status = params.mode === "atomic" && stopped ? "failed" : stopped ? results.some((r) => r.status === "succeeded") ? "partial" : "failed" : "succeeded";
    this.stats.failures += results.filter((result) => result.status === "failed").length;
    const batch = { status, results };
    this.emitOperation?.({ type: "pi-swarm-task-operation", data: {
      mode: params.mode ?? "sequential",
      status,
      results: clone(results),
      at: (/* @__PURE__ */ new Date()).toISOString()
    } });
    return batch;
  }
  /** Identifies a create request; the same key with a different request is a conflict, not a retry. */
  createFingerprint(op) {
    return createHash("sha256").update(JSON.stringify(sortKeysDeep({ ...op, subject: op.subject?.trim() }))).digest("hex");
  }
  replayedCreate(op, id) {
    const task = this.find(id);
    if (!task) return { key: op.key, op: op.op, status: "failed", error: fail2("reference_failed", `operation key ${op.key} points to missing task ${id}`) };
    const same = task.createFingerprint !== void 0 ? task.createFingerprint === this.createFingerprint(op) : task.subject === op.subject?.trim() && JSON.stringify(sortKeysDeep(task.questions ?? [])) === JSON.stringify(sortKeysDeep(op.questions ?? []));
    if (!same) return { key: op.key, op: op.op, status: "failed", error: fail2("idempotency_conflict", `create key ${op.key} already created task ${id} with a different payload; use a fresh key for a new task`) };
    return { key: op.key, op: op.op, status: "succeeded", data: { task: this.createAck(task) } };
  }
  run(op, local) {
    const target2 = (r) => this.resolve(r, local);
    if (op.op === "create") {
      if (op.active === true && op.status !== "in_progress")
        return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot create task ${op.subject}: active task must be in_progress`) };
      const parent = op.parentTaskId === void 0 ? void 0 : target2(op.parentTaskId);
      if (typeof parent !== "string" && op.parentTaskId) return { key: op.key, op: op.op, status: "failed", error: parent };
      const parentId = typeof parent === "string" && parent !== "" ? parent : void 0;
      if (parentId && !this.find(parentId)) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `task ${parentId} not found`) };
      const deps2 = [...op.addBlockedBy ?? []].map(target2);
      if (deps2.some((x) => typeof x !== "string")) return { key: op.key, op: op.op, status: "failed", error: deps2.find((x) => typeof x !== "string") };
      for (const d of deps2) {
        const dependency = this.find(d);
        if (!dependency) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `dependency task ${d} not found`) };
        if (op.status === "in_progress" && dependency.status !== "completed")
          return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot create task ${op.subject}: dependency ${d} is not completed`) };
      }
      const blocks = [...op.addBlocks ?? []].map(target2);
      if (blocks.some((x) => typeof x !== "string")) return { key: op.key, op: op.op, status: "failed", error: blocks.find((x) => typeof x !== "string") };
      for (const d of blocks) if (!this.find(d)) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `task ${d} not found`) };
      const owner = op.owner_id ?? "";
      const sequence = this.state.tasks.filter((t) => (t.owner_id ?? "") === owner).reduce((max, t) => Math.max(max, t.sequence ?? 0), 0) + 1;
      const now = goNow(), task2 = { id: String(this.state.nextId++), subject: op.subject.trim(), description: op.description, activeForm: op.activeForm, category: op.category ?? this.inferCategory(`${op.subject} ${op.description ?? ""}`), priority: op.priority ?? "medium", metadata: op.metadata && clone(op.metadata), parentTaskId: parentId, owner_id: op.owner_id, questions: op.questions ? clone(op.questions) : void 0, answers: void 0, status: op.status === "in_progress" || op.status === "completed" ? op.status : "pending", active: op.status === "in_progress" || op.active === true, dependsOn: [...new Set(deps2)], notes: op.addNote ? [op.addNote] : [], typed_notes: op.addNote && op.noteType ? [{ text: op.addNote, type: op.noteType, at: now }] : void 0, audit_events: [{ action: "created", at: now }], createdAt: now, updatedAt: now, sequence, createFingerprint: this.createFingerprint(op) };
      this.state.tasks.push(task2);
      if (task2.status === "in_progress") {
        for (const other of this.state.tasks) if (other.id !== task2.id) other.active = false;
      }
      for (const d of blocks) {
        const other = this.find(d);
        if (d === task2.id || this.reaches(task2.id, d) || this.reaches(d, task2.id)) return { key: op.key, op: op.op, status: "failed", error: fail2("cycle", "dependency would create a cycle") };
        if (!other.dependsOn.includes(task2.id)) other.dependsOn.push(task2.id);
      }
      return { key: op.key, op: op.op, status: "succeeded", data: { task: this.createAck(task2) } };
    }
    if (op.op === "list") {
      const filtered = this.state.tasks.filter((t) => (!op.subject || t.subject.toLowerCase().includes(op.subject.toLowerCase())) && (op.category === void 0 || t.category === op.category) && (op.status === void 0 || t.status === op.status) && (op.active === void 0 || t.active === op.active));
      const offset = op.offset ?? 0, limit = op.limit ?? 50;
      return { key: op.key, op: op.op, status: "succeeded", data: { tasks: filtered.slice(offset, offset + limit).map((t) => this.summary(t)), pagination: { total: filtered.length, offset, limit, more: offset + limit < filtered.length } } };
    }
    const id = op.taskId === void 0 ? local[op.key] ?? this.state.keys[op.key] ?? fail2("reference_failed", `operation key ${op.key} is not available`) : target2(op.taskId);
    if (typeof id !== "string") return { key: op.key, op: op.op, status: "failed", error: id };
    const task = this.find(id);
    if (!task) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `task ${id} not found`) };
    if (op.op === "get") return { key: op.key, op: op.op, status: "succeeded", data: { task: this.outputTask(task, op.include_audit) } };
    const questionIds = new Set((op.questions ?? task.questions ?? []).map((q2) => q2.id));
    for (const answer of op.answers ?? []) if (!questionIds.has(answer.question))
      return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `unknown question id: ${answer.question}`) };
    const completionError = this.completionError(task, op);
    if (completionError) return { key: op.key, op: op.op, status: "failed", error: completionError };
    if (op.active === true && op.status === void 0 && task.status !== "in_progress")
      return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot focus task ${id}: active task must be in_progress`) };
    if (op.status === "deleted") {
      if (this.state.tasks.some((t) => t.parentTaskId === id))
        return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot delete task ${id}: child task still exists`) };
      if (this.state.tasks.some((t) => t.id !== id && t.dependsOn.includes(id)))
        return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot delete task ${id}: another task depends on it`) };
      this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
      for (const key of Object.keys(this.state.keys)) if (this.state.keys[key] === id) delete this.state.keys[key];
      for (const key of Object.keys(local)) if (local[key] === id) delete local[key];
      return { key: op.key, op: op.op, status: "succeeded", data: {} };
    }
    const deps = [...task.dependsOn];
    for (const r of op.addBlockedBy ?? []) {
      const d = target2(r);
      if (typeof d !== "string") return { key: op.key, op: op.op, status: "failed", error: d };
      if (!this.find(d)) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `dependency task ${d} not found`) };
      if (d === id || this.reaches(d, id)) return { key: op.key, op: op.op, status: "failed", error: fail2("cycle", `dependency would create a cycle`) };
      if (!deps.includes(d)) deps.push(d);
    }
    const resultingStatus = op.status ?? task.status;
    if ((op.status === "in_progress" || op.active === true) && !(op.questions ?? task.questions)?.length)
      return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `task ${id} is a legacy questionless task; repair it with task-specific questions before resuming`) };
    if (resultingStatus === "in_progress") {
      for (const dependency of deps) {
        const dependencyTask = this.find(dependency);
        if (dependencyTask?.status !== "completed")
          return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot set task ${id} to in_progress: dependency ${dependency} is not completed`) };
      }
    }
    for (const r of op.addBlocks ?? []) {
      const d = target2(r);
      if (typeof d !== "string") return { key: op.key, op: op.op, status: "failed", error: d };
      const other = this.find(d);
      if (!other) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `task ${d} not found`) };
      if (d === id || this.reaches(id, d)) return { key: op.key, op: op.op, status: "failed", error: fail2("cycle", "dependency would create a cycle") };
      if (!other.dependsOn.includes(id)) other.dependsOn.push(id);
    }
    if (op.parentTaskId !== void 0) {
      const p = target2(op.parentTaskId);
      if (typeof p !== "string") return { key: op.key, op: op.op, status: "failed", error: p };
      if (p !== "") {
        if (!this.find(p)) return { key: op.key, op: op.op, status: "failed", error: fail2("not_found", `parent task ${p} not found`) };
        if (p === id || this.parentReaches(p, id)) return { key: op.key, op: op.op, status: "failed", error: fail2("cycle", "parent would create a cycle") };
      }
    }
    if (op.status === "completed") {
      const child = this.state.tasks.find((t) => t.parentTaskId === id && t.status !== "completed");
      if (child) return { key: op.key, op: op.op, status: "failed", error: fail2("validation_failed", `cannot complete task ${id}: child task ${child.id} is not completed`) };
    }
    const mergedMetadata = op.metadata === void 0 ? task.metadata : { ...task.metadata ?? {}, ...clone(op.metadata) };
    if (op.metadata) {
      for (const [key, value] of Object.entries(op.metadata)) if (value === null) delete mergedMetadata[key];
    }
    const parentTaskId = op.parentTaskId === void 0 ? task.parentTaskId : target2(op.parentTaskId) || void 0;
    const merged = this.mergeAnswers(task, op);
    const answers = merged.length ? merged : void 0;
    Object.assign(task, { subject: op.subject?.trim() || task.subject, description: op.description ?? task.description, activeForm: op.activeForm ?? task.activeForm, category: op.category ?? task.category, priority: op.priority ?? task.priority, metadata: mergedMetadata, questions: op.questions ? clone(op.questions) : task.questions, answers, status: op.status ?? task.status, active: op.active ?? task.active, parentTaskId, dependsOn: deps, updatedAt: goNow() });
    if (op.status === "in_progress") {
      for (const other of this.state.tasks) other.active = other.id === id;
      if (op.active === false) task.active = false;
    } else if (op.status !== void 0) {
      task.active = false;
    } else if (op.active === true) {
      for (const other of this.state.tasks) other.active = other.id === id;
    }
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (op.addNote) {
      task.notes.push(op.addNote);
      if (op.noteType !== void 0) (task.typed_notes ??= []).push({ text: op.addNote, type: op.noteType, at: updatedAt });
    }
    (task.audit_events ??= []).push({ action: "updated", at: updatedAt });
    task.updatedAt = updatedAt;
    return { key: op.key, op: op.op, status: "succeeded", data: { task: this.updateAck(op, task) } };
  }
  createAck(task) {
    return { id: task.id, subject: task.subject, status: task.status, active: task.active, parent_id: task.parentTaskId ?? "", ...task.questions?.length ? { questions: clone(task.questions) } : {}, ...task.answers?.length ? { answers: clone(task.answers) } : {} };
  }
  updateAck(op, task) {
    const ack = { ...this.createAck(task) };
    if (op.description !== void 0) ack.description = task.description;
    if (op.activeForm !== void 0) ack.active_form = task.activeForm;
    if (op.category !== void 0) ack.category = task.category;
    if (op.priority !== void 0) ack.priority = task.priority;
    if (op.metadata !== void 0) ack.metadata = task.metadata;
    if ((op.addBlocks?.length ?? 0) > 0) ack.blocks = this.blockedBy(task.id);
    if ((op.addBlockedBy?.length ?? 0) > 0) ack.depends_on = [...task.dependsOn];
    if (op.addNote) ack.note_added = true;
    return ack;
  }
  summary(task) {
    const result = { ...this.createAck(task) };
    if (task.activeForm) result.active_form = task.activeForm;
    if (task.category) result.category = task.category;
    if (task.priority) result.priority = task.priority;
    if (task.dependsOn.length) result.depends_on = [...task.dependsOn];
    const blocks = this.blockedBy(task.id);
    if (blocks.length) result.blocks = blocks;
    if (task.owner_id) result.owner_id = task.owner_id;
    return result;
  }
  blockedBy(id) {
    return this.state.tasks.filter((t) => t.dependsOn.includes(id)).map((t) => t.id);
  }
  outputTask(task, includeAudit = false) {
    const result = {
      id: task.id,
      content: task.subject,
      status: task.status,
      priority: task.priority,
      ...task.active ? { active: true } : {},
      ...task.description !== void 0 ? { description: task.description } : {},
      ...task.activeForm !== void 0 ? { active_form: task.activeForm } : {},
      ...task.metadata !== void 0 ? { metadata: clone(task.metadata) } : {},
      ...task.category !== void 0 ? { category: task.category } : {},
      ...task.dependsOn.length ? { depends_on: [...task.dependsOn] } : {},
      ...this.blockedBy(task.id).length ? { blocks: this.blockedBy(task.id) } : {},
      ...task.owner_id !== void 0 ? { owner_id: task.owner_id } : {},
      ...task.questions?.length ? { questions: clone(task.questions) } : {},
      ...task.answers?.length ? { answers: clone(task.answers) } : {},
      ...task.sequence ? { sequence: task.sequence } : {},
      ...task.parentTaskId !== void 0 ? { parent_id: task.parentTaskId } : {},
      ...task.notes.length ? { notes: [...task.notes] } : {},
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      // TodoItem.LastSeen is a time.Time: omitempty never elides a struct, so
      // the zero value is always rendered (taskstore sync sets it elsewhere).
      last_seen: "0001-01-01T00:00:00Z"
    };
    if (includeAudit) {
      if (task.audit_events) result.audit_events = task.audit_events.map((event) => ({
        type: event.action,
        timestamp: event.at,
        ...event.actor !== void 0 ? { actor: event.actor } : {},
        ...event.summary !== void 0 ? { summary: event.summary } : {},
        ...event.tool !== void 0 ? { tool: event.tool } : {},
        ...event.toolCallId !== void 0 ? { tool_call_id: event.toolCallId } : {},
        ...event.outcome !== void 0 ? { outcome: event.outcome } : {}
      }));
      if (task.typed_notes) result.typed_notes = task.typed_notes.map((note) => ({
        type: note.type,
        content: note.text,
        created_at: note.at
      }));
    }
    return result;
  }
  reaches(from, to, visited = /* @__PURE__ */ new Set()) {
    if (visited.has(from)) return false;
    visited.add(from);
    const t = this.find(from);
    return !!t && (t.dependsOn.includes(to) || t.dependsOn.some((d) => this.reaches(d, to, visited)));
  }
  parentReaches(from, to, visited = /* @__PURE__ */ new Set()) {
    if (from === to) return true;
    if (visited.has(from)) return false;
    visited.add(from);
    const parent = this.find(from)?.parentTaskId;
    return !!parent && this.parentReaches(parent, to, visited);
  }
};
function sessionResultNames(session) {
  if (!session) return [];
  const entries = session.getBranch?.() ?? session.getEntries();
  return entries.flatMap((entry) => {
    if (!isObj2(entry) || entry.type !== "message" || !isObj2(entry.message)) return [];
    return entry.message.role === "toolResult" && typeof entry.message.toolName === "string" ? [entry.message.toolName] : [];
  });
}
function resolveToolEvidence(reference, sessionManager, aliases = {}) {
  const match = /^tool:([A-Za-z0-9_-]+)(?:#(\d+))?$/i.exec(reference.trim());
  if (!match || !sessionManager) return false;
  let name = match[1];
  const names = sessionResultNames(sessionManager);
  if (!names.includes(name) && aliases[name]) {
    const targets2 = [...new Set(aliases[name])];
    if (targets2.length !== 1) return false;
    name = targets2[0];
  }
  const count = names.filter((value) => value === name).length;
  if (!match[2]) return count > 0;
  const index = Number(match[2]);
  return index >= 1 && index <= count;
}
function registerTaskManage(pi, presentation = taskManageRenderers, options = {}) {
  options = { ...options };
  const manager = new TaskManager(
    (entry) => pi.appendEntry(entry.type, entry.data),
    (event) => pi.appendEntry(event.type, event.data),
    options
  );
  let ui;
  let sessionManager;
  const refreshWidget = (ctx) => {
    ui = ctx?.ui ?? ui;
    if (!ui) return;
    const tasks = manager.snapshot().tasks.filter((task) => task.status !== "deleted");
    const visible = tasks.some((task) => task.status === "pending" || task.status === "in_progress");
    ui.setWidget("swarm-tasks", visible ? ((_tui, theme) => taskWidgetRenderer(tasks, theme)) : void 0);
  };
  const bindSession = (_event, ctx) => {
    sessionManager = ctx.sessionManager;
    manager.rehydrate(ctx.sessionManager?.getBranch?.() ?? ctx.sessionManager?.getEntries() ?? []);
    refreshWidget(ctx);
  };
  pi.on("session_start", bindSession);
  pi.on("session_switch", bindSession);
  options.sessionEvidenceHints ??= () => {
    const counts = /* @__PURE__ */ new Map();
    for (const name of sessionResultNames(sessionManager)) {
      if (/^[A-Za-z0-9_-]{1,64}$/.test(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts.size ? `; available: ${[...counts].slice(0, 8).map(([name, count]) => `tool:${name}#${count}`).join(", ")}` : "; no tool results on the current branch";
  };
  options.canonicalizeToolEvidence ??= (reference) => {
    const match = /^tool:([A-Za-z0-9_-]+)(#\d+)?$/i.exec(reference.trim());
    if (!match || !sessionManager) return reference;
    if (resolveToolEvidence(reference, sessionManager)) return reference;
    const targets2 = [...new Set(options.toolAliases?.[match[1]] ?? [])];
    if (targets2.length !== 1 || !resolveToolEvidence(reference, sessionManager, options.toolAliases)) return reference;
    return `tool:${targets2[0]}${match[2] ?? ""}`;
  };
  options.resolveSessionEvidence ??= (reference) => resolveToolEvidence(reference, sessionManager);
  pi.registerTool({
    name: "TaskManage",
    label: "Manage tasks",
    description: "Manage ordered tasks. Optional compact questions {id,text}; Saved answers for unchanged questions are reused; supply missing or replacement {question,answer,evidence} answers. Completion revalidates all evidence. Evidence uses workspace file#heading, file#Lx-Ly, or tool:<ToolName>[#<n>] for a live tool result from this session. Keep detail in files. sequential commits the successful prefix; atomic commits all or rolls back.",
    parameters: taskManageSchema,
    renderShell: "self",
    promptSnippet: "TaskManage: register each user request and its deliverables as durable, evidence-checked tasks.",
    promptGuidelines: [`Use TaskManage for every user request that changes files or state (not only long work): create the task before acting, one child task per separate deliverable; keep exactly one active task when working sequentially; before starting work set the selected task status="in_progress" and active=true; after verifying a task's acceptance criteria, explicitly update it with status="completed" and activate the next unblocked task; before ending a reply, complete finished tasks or add a note saying what is left.`],
    renderCall: presentation.renderCall,
    renderResult: presentation.renderResult,
    execute: async (_id, params, signal, _onUpdate, ctx) => {
      if (ctx?.cwd) options.workspaceRoot = ctx.cwd;
      const normalizedParams = normalizeTaskManageParams(params);
      const invalid = swarmValidateTaskManageParams(normalizedParams);
      if (invalid !== void 0) {
        const offending = /^operation "([^"]+)"/.exec(invalid)?.[1] ?? /^duplicate operation key "([^"]+)"/.exec(invalid)?.[1];
        const error = new Error(`Error executing TaskManage: validation failed for TaskManage: ${invalid} (error_id=err_${randomBytes(10).toString("hex")})`);
        const operations = normalizedParams?.operations;
        Object.assign(error, { details: { batch: { status: "failed", results: (Array.isArray(operations) ? operations : []).map((operation, index) => {
          const key = typeof operation?.key === "string" ? operation.key : String(index);
          const isOffender = offending === void 0 ? index === 0 : key === offending;
          return { key, op: operation?.op, status: isOffender ? "failed" : "skipped", ...isOffender ? { error: { code: "validation_failed", message: invalid, retryable: false } } : {} };
        }) ?? [] } } });
        throw error;
      }
      const batch = manager.execute(normalizedParams, signal);
      refreshWidget(ctx);
      const ordered = goMapOrdered(batch);
      return {
        content: [{ type: "text", text: JSON.stringify(ordered) }],
        details: { batch: ordered },
        isError: batch.status !== "succeeded"
      };
    }
  });
  return manager;
}

// vendor/trebol/packages/tools/taskmanage/src/task-hooks.ts
function registerHook(pi, group, event, handler) {
  const globalRegister = globalThis.__piSwarmRegisterHook;
  if (typeof globalRegister === "function") return globalRegister(pi, group, event, handler);
  pi.on(event, handler);
}
var TASK_TOOLS = /* @__PURE__ */ new Set(["taskmanage", "taskcreate", "taskupdate", "tasklist", "taskget", "todowrite", "todoread", "todo"]);
var PLAN_TOOLS = /* @__PURE__ */ new Set(["enterplanmode", "exitplanmode", "plan", "planmode"]);
var SKILL_TOOLS = /* @__PURE__ */ new Set(["skill", "skillmanage", "skillreview", "patchskill"]);
var READ_TOOLS = /* @__PURE__ */ new Set(["read", "readfile", "grep", "glob", "find", "ls", "listdir", "lstat", "readdir", "readbackgroundcommand", "historysearch", "historyget", "recall", "lsp", "lspsymbols"]);
var INTERACTION_TOOLS = /* @__PURE__ */ new Set(["askuserquestion", "question", "userquestion", "pushagentupdate", "annoyed"]);
var RESEARCH_TOOLS = /* @__PURE__ */ new Set(["websearch", "search", "webfetch", "web", "browser", "xsearch", "xaiwebsearch", "fetch"]);
var IGNORED_AUDIT = /* @__PURE__ */ new Set([...TASK_TOOLS, ...PLAN_TOOLS, ...SKILL_TOOLS, ...INTERACTION_TOOLS]);
var secretName = String.raw`(?:token|password|passwd|secret|credential|authorization|cookie|api(?:[_-]?key)|private(?:[_-]?key)|access(?:[_-]?(?:key|token)))`;
var secret = new RegExp(secretName, "i");
var normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
var toolName = (e) => e.toolName ?? e.tool_name ?? "";
var input = (e) => e.input ?? e.params ?? {};
var failed = (e) => e.isError === true || e.error != null || e.result?.isError === true || e.result?.error != null || typeof e.toolOutput === "string" && /^error\b/i.test(e.toolOutput);
var text = (x) => typeof x === "string" ? x : "";
function readOnlyBash(command) {
  if (!command.trim()) return false;
  if (/[^\x20-\x7e]|["'`$;&|<>()[\]{}\\*?]/.test(command)) return false;
  const words = command.trim().split(/\s+/);
  const executable = words.shift().toLowerCase();
  const args = words;
  const safeArg = (arg) => /^[A-Za-z0-9_./:@%+=,-]+$/.test(arg);
  if (!args.every(safeArg)) return false;
  if (!/^(pwd|ls|find|grep|rg|git|cat|head|tail|wc|which|type|echo|printf)$/.test(executable)) return false;
  if (executable === "pwd" && args.length) return false;
  if ((executable === "which" || executable === "type") && args.length !== 1) return false;
  if (executable === "cat" && args.some((a) => a.startsWith("-"))) return false;
  if ((executable === "echo" || executable === "printf") && args.some((a) => a.startsWith("-"))) return false;
  if ((executable === "head" || executable === "tail") && args.some((a) => a.startsWith("-") && !/^(?:-[0-9]+|-[nmc][0-9]+|-[nmc]|-f)$/.test(a))) return false;
  if (executable === "ls" && args.some((a) => a.startsWith("-") && !/^(?:-[A-Za-z]+|--[a-z-]+)$/.test(a))) return false;
  if ((executable === "grep" || executable === "rg") && args.some((a) => a.startsWith("-") && !/^(?:-[A-Za-z]+|--[a-z-]+(?:=[A-Za-z0-9_.-]+)?)$/.test(a))) return false;
  if (executable === "find" && args.some((a) => a.startsWith("-") && !/^(?:-type|-[0-9]+|--maxdepth|--mindepth|-[a-z]+)$/i.test(a))) return false;
  if (executable === "find" && args.some((a) => /^(?:-?(?:delete|exec|execdir|ok|okdir|fls|fprint|fprint0|fprintf|d|i))(?:=|$)/i.test(a))) return false;
  if (executable === "git") {
    const subcommand = args.shift()?.toLowerCase();
    if (!subcommand || !/^(?:status|log|diff|show|branch)$/.test(subcommand)) return false;
    if (subcommand === "branch" && args.some((a) => a.startsWith("-"))) return false;
    if (subcommand === "diff" && args.some((a) => /^(?:--output(?:=|$)|--no-index$)/i.test(a))) return false;
  }
  return true;
}
function exempt(name, args) {
  const n = normalize(name);
  return TASK_TOOLS.has(n) || PLAN_TOOLS.has(n) || READ_TOOLS.has(n) || INTERACTION_TOOLS.has(n) || SKILL_TOOLS.has(n) || RESEARCH_TOOLS.has(n) || n === "bash" && readOnlyBash(text(args?.command));
}
function stateFrom(entries) {
  const found = [...entries].reverse().find((e) => e?.type === "pi-swarm-task-hooks");
  const d = found?.data;
  return d ? {
    turns: d.turns ?? 0,
    toolCalls: d.toolCalls ?? 0,
    lastNudgeTurn: d.lastNudgeTurn ?? 0,
    maintenanceAt: d.maintenanceAt ?? 0,
    maintenanceAtByTask: d.maintenanceAtByTask && typeof d.maintenanceAtByTask === "object" ? { ...d.maintenanceAtByTask } : {},
    maintenanceMessageCount: d.maintenanceMessageCount ?? 0,
    maintenanceMessageTaskId: typeof d.maintenanceMessageTaskId === "string" ? d.maintenanceMessageTaskId : void 0,
    hadError: !!d.hadError,
    skillCalls: d.skillCalls ?? 0,
    lastSkillReview: d.lastSkillReview ?? 0,
    audit: Array.isArray(d.audit) ? d.audit.slice(-200) : [],
    focusTaskId: typeof d.focusTaskId === "string" ? d.focusTaskId : void 0,
    completedCalls: Array.isArray(d.completedCalls) ? d.completedCalls.slice(-500) : [],
    nudgeBudget: typeof d.nudgeBudget === "number" ? Math.max(0, d.nudgeBudget) : 1
  } : { turns: 0, toolCalls: 0, lastNudgeTurn: 0, maintenanceAt: 0, maintenanceAtByTask: {}, maintenanceMessageCount: 0, hadError: false, skillCalls: 0, lastSkillReview: 0, audit: [], completedCalls: [], nudgeBudget: 1 };
}
function summary(name, args) {
  if (!args || typeof args !== "object") return name;
  for (const key of ["command", "file_path", "path", "pattern", "query", "url", "subject"]) {
    if (typeof args[key] === "string" && args[key]) return `${name}: ${sanitize(args[key])}`.slice(0, 160);
  }
  const parts = Object.keys(args).slice(0, 3).map((k) => secret.test(k) ? `${k}=[REDACTED]` : typeof args[k] === "string" ? `${k}=${sanitize(args[k])}` : k);
  return `${name}${parts.length ? `: ${parts.join(" ")}` : ""}`.slice(0, 160);
}
function sanitize(value) {
  const secretValue = `(?:"[^"]*"|'[^']*'|[^\\s,'"]+)`;
  return value.replace(new RegExp(`(Bearer\\s+|${secretName}\\s*[=:]\\s*)${secretValue}`, "ig"), "$1[REDACTED]").replace(new RegExp(`(--?${secretName}(?:[=\\s]+))${secretValue}`, "ig"), "$1[REDACTED]").replace(new RegExp(`([?&]${secretName}=)[^&#\\s]+`, "ig"), "$1[REDACTED]").replace(new RegExp(`(["']?${secretName}["']?\\s*:\\s*["']?)[^"',}\\s]+`, "ig"), "$1[REDACTED]").replace(/((?:https?:\/\/|file:\/\/)[^?\s]*\/)([^\/\s]*(?:token|secret|credential|private|password)[^\/\s]*)/ig, "$1[REDACTED]").replace(/\r?\n/g, " ").slice(0, 80);
}
var sharedByPi = /* @__PURE__ */ new WeakMap();
var sharedBySession = /* @__PURE__ */ new WeakMap();
var TaskHooksCoordinator = class {
  constructor(manager, pi, config = {}) {
    this.manager = manager;
    this.pi = pi;
    this.config = {
      enforcementMode: config.enforcementMode ?? "advise",
      nudgeInterval: config.nudgeInterval ?? 5,
      nudgeToolThreshold: config.nudgeToolThreshold ?? 2,
      maintenanceToolThreshold: config.maintenanceToolThreshold ?? 8
    };
    this.isSubagent = config.isSubagent;
    this.silent = config.silent === true;
    const owner = pi;
    this.shared = sharedByPi.get(owner) ?? { lastNudgeTurn: 0, budget: this.state.nudgeBudget };
    sharedByPi.set(owner, this.shared);
  }
  manager;
  pi;
  config;
  isSubagent;
  silent;
  state = stateFrom([]);
  prompt = "";
  shared;
  sessionOwner;
  pendingMessages = [];
  anonymousTerminals = [];
  persist() {
    this.pi.appendEntry("pi-swarm-task-hooks", this.state);
  }
  auditSnapshot() {
    return this.state.audit.map((x) => ({ ...x }));
  }
  message(message, hookName = "task-maintenance-reminder-hook") {
    return { message: `[TASK HOOK] ${message}`, hookName };
  }
  tasks() {
    return this.manager.snapshot().tasks.filter((t) => t.status !== "deleted");
  }
  focus() {
    return this.tasks().find((t) => t.status === "in_progress" && t.active);
  }
  taskOps(e) {
    const p = input(e);
    return Array.isArray(p?.operations) ? p.operations : [];
  }
  resultSucceeded(e) {
    const batch = this.batchResult(e);
    return !failed(e) && !!batch && batch.status === "succeeded";
  }
  batchResult(e) {
    const candidates = [e.result, e.toolResult, e.tool_output, e.content, e.details];
    const find = (value) => {
      if (!value) return void 0;
      if (typeof value === "string") {
        try {
          return find(JSON.parse(value));
        } catch {
          return void 0;
        }
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = find(item?.text ?? item);
          if (found) return found;
        }
        return void 0;
      }
      if (typeof value === "object") {
        if (typeof value.status === "string" && Array.isArray(value.results)) return value;
        return find(value.content) ?? find(value.details) ?? find(value.result);
      }
      return void 0;
    };
    return candidates.map(find).find(Boolean);
  }
  on(event, ctx = {}) {
    const decision = this.dispatch(event, ctx);
    if (this.silent) {
      this.pendingMessages = [];
      return void 0;
    }
    return decision;
  }
  dispatch(event, ctx = {}) {
    if (event.type === "session_start") {
      this.state = stateFrom(ctx.sessionManager?.getBranch?.() ?? ctx.sessionManager?.getEntries?.() ?? []);
      if (ctx.sessionManager && typeof ctx.sessionManager === "object") {
        this.sessionOwner = ctx.sessionManager;
        const existing = sharedBySession.get(this.sessionOwner);
        this.shared = existing ?? { lastNudgeTurn: this.state.lastNudgeTurn, budget: this.state.nudgeBudget };
        this.shared.budget = Math.min(this.shared.budget, this.state.nudgeBudget);
        sharedBySession.set(this.sessionOwner, this.shared);
      } else {
        this.shared = { lastNudgeTurn: this.state.lastNudgeTurn, budget: this.state.nudgeBudget };
      }
      this.prompt = "";
      return;
    }
    if (event.type === "shutdown" || event.type === "session_shutdown") {
      this.persist();
      return;
    }
    if (event.type === "input" || event.type === "before_agent_start") {
      this.prompt = text(event.text ?? event.prompt);
      if (event.type === "input") {
        const focus = this.focus();
        const pending = this.tasks().filter((task) => task.status === "pending");
        const taskId = focus?.id ?? (pending.length ? "pending" : void 0);
        if (taskId !== this.state.maintenanceMessageTaskId) {
          this.state.maintenanceMessageTaskId = taskId;
          this.state.maintenanceMessageCount = 0;
        }
        if (taskId && this.state.maintenanceMessageCount % 5 === 0) {
          this.state.maintenanceMessageCount++;
          this.persist();
          this.pendingMessages.push({
            message: focus ? `Task maintenance: you have an active task "${focus.subject}". Mark it completed when done and add tasks if scope expands.` : `Task maintenance: you have pending tasks but none is active. Use TaskManage to update an available task to status "in_progress" and active=true.`,
            hookName: "task-maintenance-reminder-hook"
          });
        } else if (taskId) {
          this.state.maintenanceMessageCount++;
        }
      }
      if (event.type === "before_agent_start" && this.pendingMessages.length) {
        const message = this.pendingMessages.map((item) => item.message).join("\n\n");
        this.pendingMessages = [];
        return { message, hookName: "task-guidance-hook" };
      }
      return;
    }
    if (event.type === "turn_start") {
      this.state.turns++;
      this.persist();
      return;
    }
    if (event.type === "tool_call") {
      const decision = this.gate(event, ctx);
      if (decision?.message && !decision.block) this.pendingMessages.push({ message: decision.message, hookName: decision.hookName ?? "task-enforcement-hook" });
      return decision;
    }
    if (event.type === "tool_execution_update") return;
    if (event.type === "tool_result" || event.type === "tool_execution_end") {
      const id = event.toolCallId ?? event.tool_call_id;
      if (id && this.state.completedCalls.includes(String(id))) return;
      if (!id) {
        const fingerprint = this.anonymousTerminalFingerprint(event);
        const inverse = event.type === "tool_result" ? "tool_execution_end" : "tool_result";
        const duplicate = this.anonymousTerminals.findIndex((x) => x.type === inverse && x.fingerprint === fingerprint);
        if (duplicate >= 0) {
          this.anonymousTerminals.splice(duplicate, 1);
          return;
        }
        this.anonymousTerminals.push({ fingerprint, type: event.type });
        this.anonymousTerminals = this.anonymousTerminals.slice(-20);
      }
      if (id) {
        this.state.completedCalls.push(String(id));
        this.state.completedCalls = this.state.completedCalls.slice(-500);
      }
      const decision = this.outcome(event, ctx);
      if (decision?.message) this.pendingMessages.push({ message: decision.message, hookName: decision.hookName ?? "task-guidance-hook" });
      return decision;
    }
    if (event.type === "turn_end") {
      const decision = this.endTurn(ctx);
      if (decision?.message) this.pendingMessages.push({ message: decision.message, hookName: decision.hookName ?? "task-maintenance-reminder-hook" });
      return decision;
    }
  }
  anonymousTerminalFingerprint(e) {
    const stable = (value) => {
      if (value === void 0) return "";
      if (value === null || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
      return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
    };
    return stable({ name: toolName(e), input: input(e), failed: failed(e), batch: this.batchResult(e) });
  }
  gate(e, ctx) {
    if (this.config.enforcementMode === "off" || process.env.PI_SWARM_SUBAGENT === "1" || this.isSubagent?.(ctx) || ctx?.isSubagent === true || ctx?.agentType === "subagent" || e.isSubagent === true) return;
    const name = toolName(e), n = normalize(name);
    if (!name || exempt(name, input(e))) return;
    if (this.focus()) return;
    const reason = 'No active task is focused; use TaskManage to create a task, then update it with status "in_progress" and active=true before acting.';
    if (this.config.enforcementMode === "block") return { block: true, reason, hookName: "task-enforcement-hook" };
    return this.message(reason, "task-enforcement-hook");
  }
  outcome(e, ctx) {
    const name = toolName(e), n = normalize(name);
    const batch = n === "taskmanage" ? this.batchResult(e) : void 0;
    const isFailure = failed(e) || !!batch && batch.status !== "succeeded";
    if (!TASK_TOOLS.has(n) && !PLAN_TOOLS.has(n)) this.state.toolCalls++;
    if (isFailure) this.state.hadError = true;
    const resolvedError = !isFailure && this.state.hadError;
    if (resolvedError) this.state.hadError = false;
    if (SKILL_TOOLS.has(n) && !isFailure) {
      this.state.skillCalls++;
      this.state.lastSkillReview = this.state.toolCalls;
    }
    const at = (/* @__PURE__ */ new Date()).toISOString();
    if (!IGNORED_AUDIT.has(n) || n === "taskmanage" && isFailure) {
      const record2 = { tool: name, outcome: isFailure ? "failure" : "success", summary: summary(name, input(e)), at };
      this.state.audit.push(record2);
      this.state.audit = this.state.audit.slice(-200);
      this.manager.appendActiveAuditEvent({
        actor: typeof ctx.agentId === "string" ? ctx.agentId : "main",
        summary: record2.summary,
        tool: name,
        toolCallId: typeof (e.toolCallId ?? e.tool_call_id) === "string" ? e.toolCallId ?? e.tool_call_id : void 0,
        outcome: record2.outcome,
        at
      });
    }
    this.persist();
    if (resolvedError) return this.message("An error was resolved; preserve any reusable learning in an existing skill.", "task-guidance-hook");
    if (n === "taskmanage" && this.resultSucceeded(e)) return this.guidance(this.taskOps(e), e);
    if ((n === "taskcreate" || n === "taskupdate" || n === "todowrite") && !isFailure) {
      const params = input(e);
      const status = typeof params?.status === "string" ? params.status : void 0;
      const taskId = typeof params?.taskId === "string" ? params.taskId : "?";
      if (status === "in_progress") return this.message(`Task #${taskId} is now ACTIVE. You can proceed with tools.`, "task-guidance-hook");
      if (status === "completed") return this.message(`Task #${taskId} completed. Activate the next pending task or create a new task if needed.`, "task-guidance-hook");
      if (n === "taskcreate" && !this.focus()) return this.message('Task created successfully. Update it with status: "in_progress" and active=true before proceeding with other tools.', "task-guidance-hook");
    }
    return;
  }
  guidance(ops, event) {
    const batch = event ? this.batchResult(event) : void 0;
    if (!batch || batch.status !== "succeeded") return;
    const successful = new Set((batch.results ?? []).filter((r) => r?.status === "succeeded").map((r) => r.key));
    const mutation = ops.filter((o) => (o.op === "create" || o.op === "update") && successful.has(o.key)).at(-1);
    if (!mutation) return;
    const snap = this.manager.snapshot();
    const row = (batch.results ?? []).find((r) => r?.key === mutation.key && r?.status === "succeeded");
    const returnedTask = row?.data?.task;
    let task = typeof returnedTask?.id === "string" ? snap.tasks.find((t) => t.id === returnedTask.id) : void 0;
    if (!task && mutation.op === "update" && typeof mutation.taskId === "string")
      task = snap.tasks.find((t) => t.id === mutation.taskId);
    if (mutation.op === "create") {
      if (mutation.status === "in_progress") {
        if (task?.status === "in_progress" && task.active === true)
          return this.message(`Task #${task.id} is now ACTIVE. You can proceed with tools.`, "task-guidance-hook");
        return this.message(`Task #${task?.id ?? "?"} is in progress but not focused. Set active=true before proceeding with other tools.`, "task-guidance-hook");
      }
      if (this.focus()) return;
      return this.message('Task created successfully. Update it with status: "in_progress" and active=true before proceeding with other tools.', "task-guidance-hook");
    }
    if (mutation.status === "in_progress") return this.message(`Task #${task?.id ?? "?"} is now ACTIVE. You can proceed with tools.`, "task-guidance-hook");
    if (mutation.status === "completed") {
      const active = snap.tasks.find((t) => t.status === "in_progress" && t.active);
      const pending = snap.tasks.filter((t) => t.status === "pending");
      return this.message(`Task #${task?.id ?? "?"} completed. ${active ? `Continue with task #${active.id}: ${active.subject}` : pending.length ? `${pending.length} pending task(s) remain; activate the next one.` : "All tasks done; create a task for your next objective."}`);
    }
  }
  endTurn(ctx) {
    const focus = this.focus();
    const focusId = focus?.id;
    if (focusId !== this.state.focusTaskId) {
      if (this.state.focusTaskId) this.state.maintenanceAtByTask[this.state.focusTaskId] = this.state.maintenanceAt;
      this.state.focusTaskId = focusId;
      this.state.maintenanceAt = focusId ? this.state.maintenanceAtByTask[focusId] ?? this.state.toolCalls : this.state.toolCalls;
      this.persist();
    }
    if (this.tasks().length === 0 && this.state.toolCalls >= this.config.nudgeToolThreshold && this.state.turns > 1 && this.state.turns - this.state.lastNudgeTurn >= this.config.nudgeInterval && this.state.turns - this.shared.lastNudgeTurn >= this.config.nudgeInterval && this.shared.budget > 0 && !/^(continue|keep going|go ahead|proceed|resume|run |just run |show |cat |ls |check |build |test )/i.test(this.prompt.trim())) {
      this.state.lastNudgeTurn = this.state.turns;
      this.shared.lastNudgeTurn = this.state.turns;
      this.shared.budget--;
      this.state.nudgeBudget = this.shared.budget;
      this.persist();
      return this.message("Multi-step work detected with no tasks; consider TaskManage.");
    }
    if (focus && this.state.toolCalls - this.state.maintenanceAt >= this.config.maintenanceToolThreshold) {
      this.state.maintenanceAt = this.state.toolCalls;
      this.state.maintenanceAtByTask[focus.id] = this.state.maintenanceAt;
      this.persist();
      const open = this.tasks().filter((t) => t.status === "pending" && t.dependsOn.some((id) => this.tasks().some((d) => d.id === id && d.status !== "completed"))).slice(0, 3);
      const blockers = open.length ? ` Open blockers: ${open.map((t) => `#${t.id} ${t.subject}`).join(", ")}.` : "";
      return this.message(`You've used ${this.state.toolCalls} tools on ${focus.subject}. Check whether scope expanded and mark it completed when done.${blockers}`);
    }
    if (this.state.skillCalls > 0 && this.state.toolCalls - this.state.lastSkillReview >= 10) {
      this.state.lastSkillReview = this.state.toolCalls;
      this.persist();
      return this.message("Review reusable learning: patch an existing skill or record a no-mutation review.");
    }
  }
};
function registerTaskHooks(pi, manager, config) {
  const coordinator = new TaskHooksCoordinator(manager, pi, config);
  for (const event of ["session_start", "shutdown", "session_shutdown", "input", "before_agent_start", "turn_start", "tool_call", "tool_execution_update", "tool_result", "tool_execution_end", "turn_end"])
    registerHook(pi, "taskmanage", event, (e, ctx) => coordinator.on({ ...e, type: event }, ctx));
  return coordinator;
}

// vendor/trebol/.pi/lib/runtime/mode-footer.ts
var KEY = /* @__PURE__ */ Symbol.for("pi-swarm-footer-segments");
function modeFooter(name, enabled) {
  const segments = () => globalThis[KEY] ??= /* @__PURE__ */ new Map();
  const key = `${name}-mode`;
  const provider = () => enabled() ? `${name}:on` : void 0;
  return {
    refresh(ctx) {
      segments().set(key, provider);
      ctx?.ui?.requestRender?.();
    },
    clear(ctx) {
      if (segments().get(key) === provider) segments().delete(key);
      ctx?.ui?.requestRender?.();
    }
  };
}

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
var HojaRequestError = class extends Error {
  ambiguous;
  constructor(message, ambiguous = false) {
    super(message);
    this.ambiguous = ambiguous;
  }
};
var HojaProjectError = class extends Error {
};
var HojaClient = class {
  catalog;
  url;
  token;
  fetchImpl;
  timeoutMs;
  constructor(options = {}) {
    this.url = options.url ?? resolveHojaUrl(process.env);
    this.token = options.token ?? resolveHojaToken(process.env);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15e3;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("Invalid Hoja timeout");
  }
  async gql(query, variables = {}) {
    if (!this.token) throw new HojaRequestError(MISSING_HOJA_TOKEN);
    if (!this.url) throw new HojaRequestError(HOJA_ENDPOINT_HINT);
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new HojaRequestError("Hoja request timed out; outcome unknown for writes. Read state before retrying.", true));
        controller.abort();
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const res = await this.fetchImpl(this.url, {
          method: "POST",
          signal: controller.signal,
          redirect: "error",
          headers: { Authorization: this.token, "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables })
        });
        if (res.status !== 200) throw new HojaRequestError(`Hoja HTTP ${Number(res.status)}`, true);
        const body = await res.text();
        const parsed = JSON.parse(body);
        if (parsed.errors?.length && !parsed.data) throw new HojaRequestError("Hoja GraphQL request failed; no result accepted.");
        if (parsed.errors?.length) throw new HojaRequestError("Hoja GraphQL returned errors with data; outcome unknown.", true);
        if (!parsed.data || typeof parsed.data !== "object") throw new HojaRequestError("Hoja returned no valid data.", true);
        return parsed.data;
      })()]);
    } catch (error) {
      if (error instanceof HojaRequestError) throw error;
      throw new HojaRequestError("Hoja request failed; check connectivity and configuration. No server details exposed.", true);
    } finally {
      clearTimeout(timer);
    }
  }
  invalidateCatalog() {
    this.catalog = void 0;
  }
  load() {
    this.catalog ??= this.gql(`{ viewer { id name email }
			projects(first: 200) { nodes { id name teams { nodes { id key } } } }
			teams { nodes { id key states { nodes { id name } } members { nodes { id name email } } } } }`).then((d) => ({ viewer: d.viewer, projects: d.projects.nodes, teams: d.teams.nodes })).catch((e) => {
      this.catalog = void 0;
      throw e;
    });
    return this.catalog;
  }
  /** project: exact name, case-insensitive. assignee: undefined or "me" = the token's user; else exact email or name substring. */
  async resolve(project, assignee) {
    const c = await this.load();
    const p = c.projects.find((x) => x.name.toLowerCase() === project.trim().toLowerCase());
    if (!p) throw new HojaProjectError(`Hoja project "${project}" not found. Projects: ${c.projects.map((x) => x.name).join(", ")}`);
    if (p.teams.nodes.length !== 1) throw new HojaProjectError(`Hoja project "${p.name}" belongs to ${p.teams.nodes.length} teams; expected exactly 1`);
    const team = c.teams.find((t) => t.id === p.teams.nodes[0].id);
    if (!team) throw new HojaProjectError(`team of project "${p.name}" is not visible to this token`);
    const members = team.members.nodes;
    let who;
    const want = (assignee ?? "me").trim().toLowerCase();
    if (want === "me") who = members.find((m) => m.id === c.viewer.id);
    else {
      const byEmail = members.filter((m) => m.email?.toLowerCase() === want);
      const byName = members.filter((m) => m.name.toLowerCase().includes(want));
      const exact = members.filter((m) => m.name.toLowerCase() === want);
      const hits = byEmail.length ? byEmail : exact.length ? exact : byName;
      if (hits.length > 1) throw new Error(`assignee "${assignee}" is ambiguous in ${team.key}: ${hits.map((m) => m.name).join(", ")}`);
      who = hits[0];
    }
    if (!who) throw new Error(`assignee "${assignee ?? "me"}" is not a member of team ${team.key}. Members: ${members.map((m) => m.name).join(", ")}`);
    return {
      teamId: team.id,
      teamKey: team.key,
      projectId: p.id,
      project: p.name,
      assigneeId: who.id,
      assignee: who.name,
      states: Object.fromEntries(team.states.nodes.map((s) => [s.name.toLowerCase(), s.id]))
    };
  }
  stateId(r, name) {
    const id = r.states[name.toLowerCase()];
    if (!id) throw new Error(`team ${r.teamKey} has no state "${name}"`);
    return id;
  }
  async createIssue(r, title, description, state = "In Progress", options = {}) {
    const d = await this.gql(`mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier } } }`, {
      input: {
        title: title.slice(0, 250),
        description,
        teamId: r.teamId,
        projectId: r.projectId,
        assigneeId: r.assigneeId,
        stateId: this.stateId(r, state),
        // Only send a parent that an existing issue provided; a caller can never guess an id.
        ...options.parentId ? { parentId: options.parentId } : {},
        ...Number.isInteger(options.priority) && options.priority >= 0 && options.priority <= 4 ? { priority: options.priority } : {}
      }
    });
    if (!d.issueCreate?.success || !d.issueCreate.issue) throw new Error("Hoja issueCreate did not succeed");
    return d.issueCreate.issue;
  }
  /** Read-back used after every write; the caller compares the fields it cares about. */
  async readIssue(issueId) {
    const d = await this.gql(`query($id: String!) { issue(id: $id) { id identifier title description state { name } team { id } project { id } assignee { id }
			parent { id identifier }
			comments(first: 100) { nodes { body } } } }`, { id: issueId });
    const i = d.issue;
    if (!i) throw new Error(`Hoja issue ${issueId} not found on read-back`);
    return {
      id: i.id,
      identifier: i.identifier,
      title: i.title ?? "",
      description: i.description ?? "",
      state: i.state?.name ?? "",
      teamId: i.team?.id ?? "",
      projectId: i.project?.id ?? "",
      assigneeId: i.assignee?.id ?? "",
      ...i.parent ? { parentId: i.parent.id ?? "", parentIdentifier: i.parent.identifier ?? "" } : {},
      comments: (i.comments?.nodes ?? []).map((c) => c.body)
    };
  }
  /** Adopt an issue the caller named, server-side and by exact identifier. A reused issue is never written to. */
  async findIssueByIdentifier(identifier) {
    const d = await this.gql(
      `query ($first: Int!, $filter: IssueFilter) { issues(first: $first, filter: $filter) { nodes { id identifier } } }`,
      { first: 2, filter: { identifier: { eq: identifier } } }
    );
    const hit = (d.issues?.nodes ?? []).find((n) => n.identifier?.toUpperCase() === identifier.toUpperCase());
    return hit ? { id: hit.id, identifier: hit.identifier } : void 0;
  }
  /** Reconciliation after a crash: an issue already created for this run carries its marker in the description.
   *  Uses the server-side description filter, so the lookup is exact and not limited to a page of recent issues. */
  async findIssueByMarker(marker) {
    const d = await this.gql(`{ issues(first: 50, filter: { description: { contains: ${JSON.stringify(marker)} } }) { nodes { id identifier description } } }`);
    const hit = (d.issues?.nodes ?? []).find((n) => n.description?.includes(marker));
    return hit ? { id: hit.id, identifier: hit.identifier } : void 0;
  }
  /** Reconciliation without any text in the issue: issues with exactly this title in this project created since
   *  `since`, with their bodies so the caller can match the exact description it sent. */
  async findIssuesByTitle(title, projectId, since) {
    const filter = { title: { eq: title.slice(0, 250) }, project: { id: { eq: projectId } }, createdAt: { gte: since } };
    const d = await this.gql(`query($filter: IssueFilter) { issues(first: 20, filter: $filter) { nodes { id identifier description } } }`, { filter });
    return (d.issues?.nodes ?? []).map((n) => ({ id: n.id, identifier: n.identifier, description: n.description ?? "" }));
  }
  async comment(issueId, body) {
    const d = await this.gql(`mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`, { input: { issueId, body: body.slice(0, 2e4) } });
    if (!d.commentCreate?.success) throw new Error("Hoja commentCreate did not succeed");
  }
  async updateIssue(issueId, input2) {
    const d = await this.gql(`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, { id: issueId, input: input2 });
    if (!d.issueUpdate?.success) throw new Error("Hoja issueUpdate did not succeed");
  }
  async setState(r, issueId, state) {
    await this.updateIssue(issueId, { stateId: this.stateId(r, state) });
  }
  /** Writes the whole description. Callers merge the managed block themselves, so human text is never dropped. */
  async setDescription(issueId, description) {
    await this.updateIssue(issueId, { description });
  }
};

// vendor/trebol/extensions/hoja-mode/projects.ts
var PROJECT_CATALOG = `{ projects(first: 201) { nodes { id name description teams { nodes { id key } } } } teams { nodes { id key name } } }`;
function projectTool(client, state) {
  return {
    name: "hoja_project",
    label: "Hoja filing project",
    description: "Discover Hoja projects and teams, including empty projects and their descriptions (action=list). action=select remembers an existing exact project for this chat and retries tasks that were queued as unfiled; pass remember:true only when the user explicitly agrees to persist it for the whole repository (host confirmation required). action=create creates a project in the exact team key after host confirmation. Resolve ownership from evidence (project descriptions, this repository) and ask the user only when genuinely ambiguous or a new project is needed; never pick by order or name similarity.",
    parameters: { type: "object", additionalProperties: false, required: ["action"], properties: {
      action: { type: "string", enum: ["list", "select", "create"] },
      name: { type: "string", description: "Exact project name." },
      team: { type: "string", description: "Exact team key for creation or disambiguation." },
      remember: { type: "boolean", description: "Persist this project for the whole repository. Requires the user's explicit agreement and a host confirmation; without it the choice applies to this chat only." }
    } },
    async execute(_id, params, _signal, _update, ctx) {
      const result = (value, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: {}, ...isError ? { isError: true } : {} });
      const epoch = state.epoch();
      const active = () => state.enabled() && state.epoch() === epoch;
      try {
        const catalog = await client.gql(PROJECT_CATALOG);
        if (params.action === "list") return result({ ...catalog, selectedProject: state.current(), truncated: catalog.projects.nodes.length > 200 });
        if (!active()) return result({ error: "Hoja mode is off or the session changed; no filing change made." }, true);
        const name = params.name?.trim();
        if (!name || name.length > 250) return result({ error: "Supply a project name of 1\u2013250 characters." }, true);
        const team = params.team ? catalog.teams.nodes.find((t) => t.key.toLowerCase() === params.team.trim().toLowerCase()) : void 0;
        if (params.team && !team) return result({ error: "Team not found; use a key from action=list." }, true);
        const hits = catalog.projects.nodes.filter((p) => p.name.toLowerCase() === name.toLowerCase() && (!team || p.teams.nodes.some((t) => t.id === team.id)));
        if (hits.length > 1) return result({ error: "Ambiguous project name; specify its team." }, true);
        let project = hits[0];
        if (!project && params.action === "select") return result({ error: "Project not found. Ask the user where to file this work and offer action=create." }, true);
        if (!project) {
          if (params.action !== "create" || !team) return result({ error: "Creation requires action=create and an exact team key." }, true);
          if (catalog.projects.nodes.length > 200) return result({ error: "Catalog is incomplete; cannot safely rule out an existing project." }, true);
          if (state.pending(name, team.id)) return result({ error: "Earlier project creation is unconfirmed. Do not repeat it; inspect Hoja or select the committed project." }, true);
          if (!ctx?.hasUI || !ctx.ui?.confirm) return result({ error: "Interactive confirmation is required to create a project. Ask the user where to file the work; no project created." }, true);
          if (!await ctx.ui.confirm("Create Hoja project?", `Create \u201C${name}\u201D in team ${team.key} and file this chat's work there?`)) return result({ error: "Project creation declined; ask where to file the work." }, true);
          if (!active()) return result({ error: "Session changed; no project created." }, true);
          state.attempt(name, team.id);
          const created = await client.gql(`mutation($input: ProjectCreateInput!) { projectCreate(input:$input) { success project { id } } }`, { input: { name, teamIds: [team.id] } });
          if (!created.projectCreate?.success || !created.projectCreate.project?.id) throw new HojaRequestError("Project creation unconfirmed; inspect Hoja before retrying.", true);
          const readback = await client.gql(PROJECT_CATALOG);
          project = readback.projects.nodes.find((p) => p.id === created.projectCreate.project.id && p.name === name && p.teams.nodes.some((t) => t.id === team.id));
          if (!project) throw new HojaRequestError("Project read-back did not confirm name and team; inspect Hoja before retrying.", true);
        }
        if (!active()) return result({ error: "Session changed; inspect Hoja for any project already created." }, true);
        let remembered = false;
        let persistenceNote;
        if (params.remember === true) {
          if (!ctx?.hasUI || !ctx.ui?.confirm)
            persistenceNote = "Session selection applied. Remembering it for this repository needs interactive confirmation; nothing was written.";
          else if (!await ctx.ui.confirm("Remember Hoja project?", `File this repository's future work in \u201C${project.name}\u201D?`))
            persistenceNote = "Session selection applied; repository persistence declined.";
          else if (!active()) return result({ error: "Session changed; no repository mapping written." }, true);
          else {
            const persisted = await state.persist?.(project.name);
            remembered = persisted === true || !!persisted && typeof persisted === "object" && persisted.ok === true;
            if (!remembered) {
              const reason = persisted && typeof persisted === "object" && persisted.reason ? ` (${persisted.reason})` : "";
              persistenceNote = `Session selection applied; the repository mapping was not written${reason}.`;
            }
          }
        }
        const recovered = await state.select(project.name);
        return result({
          project: project.name,
          id: project.id,
          teams: project.teams.nodes,
          selected: true,
          remembered,
          ...persistenceNote ? { note: persistenceNote } : {},
          ...recovered ? { recovered } : {},
          next: "Tasks that were queued as unfiled are retried automatically; a plain TaskManage update also retries them."
        });
      } catch (error) {
        return result({ error: error instanceof HojaRequestError ? error.message : "Hoja project operation failed. Inspect the catalog before retrying; no raw server errors exposed." }, true);
      }
    }
  };
}

// vendor/trebol/extensions/hoja-mode/lifecycle.ts
var CRITERIA_HEADING = "## Acceptance criteria";
var MANAGED_START = "<!-- hoja-managed:start -->";
var MANAGED_END = "<!-- hoja-managed:end -->";
var DONE_STATE = "Done";
function lifecycleWriterOf(writer) {
  const candidate = writer;
  const methods = ["resolve", "readIssue", "createIssue", "comment", "setState", "setDescription"];
  return candidate && methods.every((method) => typeof candidate[method] === "function") ? candidate : void 0;
}
var trimmed = (value) => typeof value === "string" && value.trim() ? value.trim() : void 0;
function taskFacts(task) {
  const answers = Array.isArray(task?.answers) ? task.answers : [];
  const answerFor = (id) => answers.find((entry) => entry && entry.question === id);
  const questions = [];
  for (const question of Array.isArray(task?.questions) ? task.questions : []) {
    if (!question || typeof question.id !== "string") continue;
    const answer = answerFor(question.id);
    questions.push({
      id: question.id,
      text: typeof question.text === "string" ? question.text : "",
      ...trimmed(answer?.answer) ?? trimmed(question.answer) ? { answer: trimmed(answer?.answer) ?? trimmed(question.answer) } : {},
      ...trimmed(answer?.evidence) ?? trimmed(question.evidence) ? { evidence: trimmed(answer?.evidence) ?? trimmed(question.evidence) } : {}
    });
  }
  return {
    taskId: String(task?.id ?? ""),
    subject: String(task?.subject ?? "").trim(),
    status: String(task?.status ?? "pending"),
    ...trimmed(task?.description) ? { description: trimmed(task?.description) } : {},
    questions
  };
}
function acceptedCompletion(facts) {
  return facts.status === "completed" && facts.questions.every((question) => !!question.answer);
}
function managedSection(facts) {
  if (!facts.questions.length) return "";
  return [CRITERIA_HEADING, "", ...facts.questions.map((question) => `- [${question.answer ? "x" : " "}] ${oneLine(question.text) || question.id}`)].join("\n");
}
var CHECKLIST_ITEM = /^\s*[-*] \[[ xX]\] /;
function managedRange(text3) {
  const start = text3.indexOf(MANAGED_START);
  const end = text3.indexOf(MANAGED_END);
  if (start !== -1 && end > start) return { start, end: end + MANAGED_END.length };
  const lines = text3.split("\n");
  let heading = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim() === CRITERIA_HEADING) {
    heading = i;
    break;
  }
  if (heading === -1) return void 0;
  let last = heading;
  for (let i = heading + 1; i < lines.length; i++) {
    if (CHECKLIST_ITEM.test(lines[i])) last = i;
    else if (lines[i].trim() !== "" || last > heading) break;
  }
  const offset = (line) => lines.slice(0, line).reduce((sum, value) => sum + value.length + 1, 0);
  return { start: offset(heading), end: offset(last) + lines[last].length };
}
function stripLegacyTrail(text3, marker) {
  const own = /* @__PURE__ */ new Set([`Link marker: ${marker}`, hiddenMarker(marker)]);
  const lines = text3.split("\n");
  const kept = lines.filter((line) => !own.has(line.trim()) && !/^Tracked by TaskManage task #[A-Za-z0-9_-]+( in session [A-Za-z0-9_-]+)?\.$/.test(line.trim()));
  if (kept.length === lines.length) return text3;
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}
function mergeManagedDescription(existing, section, marker) {
  const text3 = marker ? stripLegacyTrail(existing, marker) : existing;
  const range = managedRange(text3);
  if (range) {
    const before = text3.slice(0, range.start);
    const after = text3.slice(range.end);
    if (section) return `${before}${section}${after}`;
    const head = before.replace(/\s+$/, "");
    const tail = after.replace(/^\s+/, "");
    return head && tail ? `${head}

${tail}` : head || tail;
  }
  if (!section) return text3;
  if (!text3) return section;
  const separator = text3.endsWith("\n\n") ? "" : text3.endsWith("\n") ? "\n" : "\n\n";
  return `${text3}${separator}${section}`;
}
function hasMarkerLine(text3, label, marker) {
  if (!marker) return false;
  const wanted = /* @__PURE__ */ new Set([hiddenMarker(marker), `${label}: ${marker}`]);
  return String(text3 ?? "").split(/\r?\n/).some((line) => wanted.has(line.trim()));
}
var hiddenMarker = (marker) => `<!-- ${marker} -->`;
var oneLine = (value) => value.replace(/\s*\r?\n\s*/g, " ").trim();
var hasLinkMarker = (description, marker) => hasMarkerLine(description, "Link marker", marker);
var hasAnswerMarker = (comment, marker) => hasMarkerLine(comment, "Answer marker", marker);
function answerRevision(facts) {
  const canonical = facts.questions.map((question) => [question.id, question.text, question.answer ?? "", question.evidence ?? ""].join("")).join("");
  let hash = 2166136261;
  for (const char of canonical) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function answerMarker(sessionKey, taskId, revision) {
  const session = String(sessionKey ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "session";
  const task = String(taskId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "task";
  return `hoja-answer:${session}:${task}:${revision}`;
}
function evidenceText(evidence) {
  const refs = evidence.split(";").map((ref) => oneLine(ref)).filter(Boolean);
  return refs.map((ref) => ref.includes("`") ? ref : `\`${ref}\``).join(", ");
}
function completionComment(facts) {
  const count = facts.questions.length;
  const lines = [count ? `**Done.** ${count === 1 ? "The acceptance criterion is" : `All ${count} acceptance criteria are`} answered below.` : "**Done.**"];
  facts.questions.forEach((question, index) => {
    const bullet = `${index + 1}. `;
    const indent = " ".repeat(bullet.length);
    lines.push("", `${bullet}**${oneLine(question.text) || question.id}**`, "");
    const answer = (question.answer ?? "(unanswered)").trim().split(/\r?\n/).map((line) => line.trimEnd());
    for (const line of answer) lines.push(line ? `${indent}${line}` : "");
    if (question.evidence) lines.push("", `${indent}Evidence: ${evidenceText(question.evidence)}`);
  });
  return lines.join("\n");
}
function commentDigest(body) {
  const canonical = String(body ?? "").replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
  let hash = 2166136261;
  for (const char of canonical) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16).padStart(8, "0")}:${canonical.length}`;
}
var stateFor = (facts) => facts.status === "in_progress" ? "In Progress" : "Todo";
function subissueDescription(facts) {
  return [facts.description, managedSection(facts)].filter(Boolean).join("\n\n");
}
async function syncTask(args) {
  const { writer, facts, active, journal, at } = args;
  let record2 = args.record;
  let writes = 0;
  let error;
  const current = () => record2.lifecycle ?? { scope: "owned" };
  const save = (next, extra = {}) => {
    record2 = { ...record2, ...extra, lifecycle: { ...next, at: at() } };
    journal(record2);
    return record2;
  };
  const fail3 = (reason) => {
    error = reason;
    save({ ...current(), error: reason });
    return { record: record2, stopped: false, writes, error };
  };
  if (!record2.issueId) return { record: record2, stopped: false, writes };
  if (facts.status === "deleted") return { record: record2, stopped: false, writes };
  if (!active()) return { record: record2, stopped: true, writes };
  let view;
  try {
    view = await writer.readIssue(record2.issueId);
  } catch {
    return fail3("sync_read_failed");
  }
  let lifecycle = current();
  const createdHere = record2.origin === "created" && record2.issueId === view.id;
  let owned = createdHere && lifecycle.scope !== "adopted" || hasLinkMarker(view.description, args.marker);
  if (owned && !createdHere) {
    save({ ...lifecycle, scope: "owned" }, { origin: "created" });
    lifecycle = current();
  }
  if (!owned && lifecycle.scope === "adopted") {
    if (lifecycle.subissue === "pending" || lifecycle.subissue === "unconfirmed")
      return fail3(lifecycle.subissue === "pending" ? "subissue_pending" : "subissue_unconfirmed");
    const project = record2.project ?? args.project;
    if (!project) return fail3("shared_unowned");
    if (!active()) return { record: record2, stopped: true, writes };
    let resolved;
    try {
      resolved = await writer.resolve(project);
    } catch {
      return fail3("shared_project_unresolved");
    }
    if (resolved.teamId !== view.teamId) return fail3("shared_target_mismatch");
    save({ ...lifecycle, subissue: "pending", umbrellaIdentifier: view.identifier });
    if (!active()) return { record: record2, stopped: true, writes };
    let child;
    try {
      child = await writer.createIssue(resolved, facts.subject, subissueDescription(facts), stateFor(facts), { parentId: view.id });
    } catch (failure) {
      if (failure instanceof HojaRequestError && failure.ambiguous) {
        error = "subissue_ambiguous";
        save({ ...current(), subissue: "unconfirmed", error });
        return { record: record2, stopped: false, writes, error };
      }
      return fail3("subissue_failed");
    }
    writes += 1;
    if (!active()) return { record: record2, stopped: true, writes };
    let readback;
    try {
      readback = await writer.readIssue(child.id);
    } catch {
      error = "subissue_unverified";
      save({ ...current(), subissue: "unconfirmed", error });
      return { record: record2, stopped: false, writes, error };
    }
    if (readback.id !== child.id || (readback.parentId || "") !== view.id) {
      error = "subissue_unverified";
      save({ ...current(), subissue: "unconfirmed", error });
      return { record: record2, stopped: false, writes, error };
    }
    save({ ...lifecycle, scope: "owned", subissue: void 0, umbrellaIdentifier: view.identifier }, {
      origin: "created",
      issueId: readback.id,
      identifier: readback.identifier,
      parentIdentifier: view.identifier ?? record2.parentIdentifier
    });
    lifecycle = current();
    view = readback;
    owned = true;
  }
  if (!owned) return fail3("shared_unowned");
  const section = managedSection(facts);
  let changed = false;
  const desired = mergeManagedDescription(view.description, section, args.marker);
  if (desired !== view.description) {
    if (!active()) return { record: record2, stopped: true, writes };
    try {
      await writer.setDescription(view.id, desired);
    } catch (failure) {
      return fail3(failure instanceof HojaRequestError && failure.ambiguous ? "description_ambiguous" : "description_failed");
    }
    writes += 1;
    if (!active()) return { record: record2, stopped: true, writes };
    let check;
    try {
      check = await writer.readIssue(view.id);
    } catch {
      return fail3("description_unverified");
    }
    if (check.description !== desired || !check.description.includes(section)) return fail3("description_unverified");
    view = check;
    changed = true;
  }
  let stateChanged = false;
  const applyState = async (target2) => {
    if (view.state.trim().toLowerCase() === target2.toLowerCase()) return void 0;
    const project = record2.project ?? args.project;
    if (!project) return fail3("state_project_unknown");
    if (!active()) return { record: record2, stopped: true, writes };
    let resolved;
    try {
      resolved = await writer.resolve(project);
    } catch {
      return fail3("state_unresolved");
    }
    if (resolved.teamId !== view.teamId || resolved.projectId !== view.projectId) return fail3("state_target_mismatch");
    if (!active()) return { record: record2, stopped: true, writes };
    try {
      await writer.setState(resolved, view.id, target2);
    } catch (failure) {
      return fail3(failure instanceof HojaRequestError && failure.ambiguous ? "state_ambiguous" : "state_failed");
    }
    writes += 1;
    if (!active()) return { record: record2, stopped: true, writes };
    let after;
    try {
      after = await writer.readIssue(view.id);
    } catch {
      return fail3("state_unverified");
    }
    if (after.state.trim().toLowerCase() !== target2.toLowerCase()) return fail3("state_unverified");
    view = after;
    stateChanged = true;
    return void 0;
  };
  const revision = answerRevision(facts);
  const commentMarker = answerMarker(args.sessionKey, facts.taskId, revision);
  const body = completionComment(facts);
  const digest = commentDigest(body);
  const isOurs = (comment, key, bodyDigest) => !!bodyDigest && commentDigest(comment) === bodyDigest || !!key && hasAnswerMarker(comment, key);
  const previousMarker = lifecycle.commentMarker;
  const previousDigest = lifecycle.commentDigest;
  const unresolved = lifecycle.comment === "pending" || lifecycle.comment === "unconfirmed";
  if (unresolved) {
    const earlierFound = view.comments.some((comment) => isOurs(comment, previousMarker, previousDigest));
    if (!earlierFound) return fail3(lifecycle.comment === "pending" ? "comment_pending" : "comment_unconfirmed");
    lifecycle = { ...lifecycle, comment: "posted", commentMarker: previousMarker, commentDigest: previousDigest };
    save({ ...lifecycle, error: void 0 });
  }
  const alreadyPosted = view.comments.some((comment) => isOurs(comment, commentMarker, digest));
  if (!acceptedCompletion(facts)) {
    if (facts.status === "completed") {
      save({ ...lifecycle, error: "completion_unaccepted" });
      return { record: record2, stopped: false, writes, error: "completion_unaccepted" };
    }
    const stateStop2 = await applyState(stateFor(facts));
    if (stateStop2) return stateStop2;
    const reopened = lifecycle.closed === true;
    if (changed || stateChanged || reopened) save({ ...lifecycle, closed: false, error: void 0 });
    return { record: record2, stopped: false, writes };
  }
  if (!alreadyPosted) {
    save({ ...lifecycle, comment: "pending", commentMarker, commentDigest: digest });
    if (!active()) return { record: record2, stopped: true, writes };
    try {
      await writer.comment(view.id, body);
    } catch (failure) {
      if (failure instanceof HojaRequestError && failure.ambiguous) {
        error = "comment_ambiguous";
        save({ ...current(), comment: "unconfirmed", error });
        return { record: record2, stopped: false, writes, error };
      }
      save({ ...current(), comment: "failed", error: "comment_failed" });
      return { record: record2, stopped: false, writes, error: "comment_failed" };
    }
    writes += 1;
    if (!active()) return { record: record2, stopped: true, writes };
    let check;
    try {
      check = await writer.readIssue(view.id);
    } catch {
      error = "comment_unverified";
      save({ ...current(), comment: "unconfirmed", error });
      return { record: record2, stopped: false, writes, error };
    }
    if (!check.comments.some((comment) => isOurs(comment, commentMarker, digest))) {
      error = "comment_unverified";
      save({ ...current(), comment: "unconfirmed", error });
      return { record: record2, stopped: false, writes, error };
    }
    view = check;
    lifecycle = { ...lifecycle, comment: "posted", commentMarker, commentDigest: digest };
    save({ ...lifecycle, error: void 0 });
  }
  const stateStop = await applyState(DONE_STATE);
  if (stateStop) return stateStop;
  const alreadyClosed = lifecycle.closed === true && lifecycle.comment === "posted" && lifecycle.commentMarker === commentMarker;
  if (!changed && !stateChanged && alreadyClosed) return { record: record2, stopped: false, writes };
  save({ ...lifecycle, comment: "posted", commentMarker, commentDigest: digest, closed: true, error: void 0 });
  return { record: record2, stopped: false, writes };
}

// vendor/trebol/extensions/hoja-mode/project.ts
import { lstatSync, mkdirSync, readFileSync as readFileSync2, realpathSync as realpathSync2, statSync as statSync2, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
var HOJA_CONFIG_PATH = ".pi/config/hoja.json";
function parseHojaConfig(text3) {
  if (typeof text3 !== "string" || !text3.trim()) return {};
  let value;
  try {
    value = JSON.parse(text3);
  } catch {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record2 = value;
  const text_ = (key) => {
    const raw = record2[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : void 0;
  };
  const project = text_("project");
  const assignee = text_("assignee");
  return { ...project ? { project } : {}, ...assignee ? { assignee } : {} };
}
function findHojaRepositoryRoot(start = process.cwd()) {
  let current;
  try {
    const absolute = resolve(start);
    current = statSync2(absolute).isDirectory() ? absolute : dirname(absolute);
    current = realpathSync2(current);
  } catch {
    return void 0;
  }
  for (; ; ) {
    try {
      const stat = lstatSync(join(current, ".git"));
      if (stat.isDirectory() || stat.isFile()) return current;
    } catch {
    }
    const parent = dirname(current);
    if (parent === current) return void 0;
    current = parent;
  }
}
function readHojaConfig(root = process.cwd()) {
  try {
    return parseHojaConfig(readFileSync2(join(root, HOJA_CONFIG_PATH), "utf8"));
  } catch {
    return {};
  }
}
function readHojaConfigForRepository(start = process.cwd()) {
  const root = findHojaRepositoryRoot(start);
  return readHojaConfig(root ?? start);
}
function writeHojaProjectMapping(name, start = process.cwd()) {
  const project = name.trim();
  if (!project) return { ok: false, reason: "empty_name" };
  const root = findHojaRepositoryRoot(start);
  if (!root) return { ok: false, reason: "no_repository" };
  const realRoot = realpathSync2(root);
  const configDir = join(realRoot, ".pi", "config");
  const path = join(realRoot, HOJA_CONFIG_PATH);
  for (const candidate of [join(realRoot, ".pi"), configDir, path]) {
    try {
      if (lstatSync(candidate).isSymbolicLink()) return { ok: false, reason: "symlinked" };
    } catch {
    }
  }
  let document = {};
  let text3 = "";
  try {
    text3 = readFileSync2(path, "utf8");
  } catch {
  }
  if (text3.trim()) {
    try {
      const parsed = JSON.parse(text3);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "invalid_existing" };
      document = parsed;
    } catch {
      return { ok: false, reason: "invalid_existing" };
    }
  }
  try {
    mkdirSync(configDir, { recursive: true });
    const realDir = realpathSync2(configDir);
    if (realDir !== realRoot && !realDir.startsWith(`${realRoot}${sep}`)) return { ok: false, reason: "outside_repository" };
    writeFileSync(path, `${JSON.stringify({ ...document, project }, null, 2)}
`, "utf8");
    return { ok: true, path };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}

// vendor/trebol/.pi/lib/runtime/session-mode-entry.ts
function latestSessionModeEntry(ctx, customType) {
  const entries = ctx?.sessionManager?.getBranch?.() ?? [];
  const last = [...entries].reverse().find((entry) => entry?.type === "custom" && entry.customType === customType);
  return last?.data;
}

// vendor/trebol/.pi/lib/tools/swarm-hoja.contract.ts
var HOJA_LIST_CONTRACT = {
  description: 'List Hoja work items with server-side filters, returning identifier, title, state, priority, assignee, project, createdAt and updatedAt for each. Defaults to open issues; state "closed" lists Done and Canceled items (for example what finished yesterday) and state "open"/"all" widen it. Also filters by assignee, project, team, and by updatedSince/updatedBefore/createdSince/createdBefore (ISO date, a bare YYYY-MM-DD meaning UTC midnight). Returns issues, returnedCount, truncated and the appliedFilter. When truncated is true, returnedCount is NOT the total board size: narrow the filters or raise limit. Read-only; this tool cannot change Hoja.',
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      state: { type: "string", description: '"open" (default: not Done or Canceled), "closed" (Done and Canceled), "all", a workflow state type (backlog, unstarted, started, completed, canceled) or an exact state name such as "In Review".' },
      assignee: { type: "string", description: 'Assignee name, case-insensitive substring (for example "Luis").' },
      project: { type: "string", description: "Project name, case-insensitive exact match." },
      team: { type: "string", description: "Team key, for example TREBOL." },
      updatedSince: { type: "string", description: "Only issues updated at or after this instant. ISO date (YYYY-MM-DD = UTC midnight) or ISO timestamp." },
      updatedBefore: { type: "string", description: "Only issues updated before this instant. Pair with updatedSince to isolate one day." },
      createdSince: { type: "string", description: "Only issues created at or after this instant." },
      createdBefore: { type: "string", description: "Only issues created before this instant." },
      limit: { type: "integer", minimum: 1, maximum: 200, description: "Maximum issues to return (default 100, max 200). One extra row is read to report truncation honestly." }
    }
  }
};
var HOJA_GET_CONTRACT = {
  description: "Get one Hoja issue by identifier, for example TREBOL-237, looked up server-side so any issue is reachable no matter how old it is. Returns title, description, priority, createdAt, updatedAt, url, state (name and type), team, assignee, project and the most recent comments with author, date and body (long bodies truncated). Read-only; this tool cannot change Hoja.",
  parameters: {
    type: "object",
    required: ["identifier"],
    additionalProperties: false,
    properties: {
      identifier: { type: "string", description: "Hoja issue identifier, for example TREBOL-237." },
      comments: { type: "integer", minimum: 1, maximum: 50, description: "How many recent comments to return (default 10, max 50)." }
    }
  }
};

// vendor/trebol/extensions/hoja-mode/publish.ts
var HOJA_TASK_ENTRY = "hoja-task-link";
var PUBLISH_VALUES = ["publish", "local"];
var DEFAULT_STATE_PENDING = "Todo";
var DEFAULT_STATE_ACTIVE = "In Progress";
var IDENTIFIER_PATTERN = /^[A-Z0-9]+-\d+$/;
var isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function taskMarker(sessionKey, taskId) {
  const session = String(sessionKey ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "session";
  const task = String(taskId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "task";
  return `hoja-task:${session}:${task}`;
}
function issueDescription(input2) {
  return [(input2.description ?? "").trim(), input2.managed ?? ""].filter(Boolean).join("\n\n");
}
var PRIORITY_VALUES = { urgent: 1, high: 2, medium: 3, low: 4 };
var priorityValue = (priority) => typeof priority === "string" ? PRIORITY_VALUES[priority.trim().toLowerCase()] : void 0;
function replayHojaRecords(entries) {
  const records = {};
  for (const entry of entries) {
    if (!isObject(entry) || entry.type !== "custom" || entry.customType !== HOJA_TASK_ENTRY) continue;
    const data = entry.data;
    if (!isObject(data) || typeof data.taskId !== "string" || !data.taskId) continue;
    if (!["linked", "reconciling", "skipped", "failed"].includes(String(data.state))) continue;
    records[data.taskId] = data;
  }
  return records;
}
function metadataOf(op) {
  return isObject(op?.metadata) ? op.metadata : void 0;
}
function candidateFor(result, op, task, records, publishing = /* @__PURE__ */ new Set()) {
  const metadata = metadataOf(op);
  const flag = metadata?.hoja ?? void 0;
  if (flag !== void 0 && !PUBLISH_VALUES.includes(flag))
    return { rejected: "invalid_hoja_metadata" };
  if (flag === "local") return {};
  const namesIssue = metadata?.hojaIssue != null;
  const touchesHoja = !!metadata && ["hoja", "hojaIssue", "hojaProject", "hojaAssignee"].some((key) => metadata[key] != null);
  if (result.op === "update" && !touchesHoja) {
    const existing = records[String(task.id)];
    if (existing?.state === "linked" && existing.issueId) return {
      candidate: {
        taskId: String(task.id),
        subject: String(task.subject ?? op.subject ?? "").trim(),
        parentTaskId: typeof task.parent_id === "string" && task.parent_id ? task.parent_id : void 0,
        status: String(task.status ?? "pending"),
        op,
        kind: "sync",
        facts: taskFacts(task)
      }
    };
    return {};
  }
  const parentTaskId = typeof task.parent_id === "string" && task.parent_id ? task.parent_id : void 0;
  const parent = parentTaskId ? records[parentTaskId] : void 0;
  const parentFiled = !!parentTaskId && (publishing.has(parentTaskId) || parent?.state === "linked" && !!parent.issueId && parent.lifecycle?.scope !== "adopted");
  const major = flag === "publish" || flag === void 0 && (!parentTaskId || parentFiled);
  if (!major && !namesIssue) return {};
  return {
    candidate: {
      taskId: String(task.id),
      subject: String(task.subject ?? op.subject ?? "").trim(),
      description: typeof op.description === "string" ? op.description : typeof task.description === "string" ? task.description : void 0,
      priority: priorityValue(task.priority ?? op.priority),
      parentTaskId,
      status: String(task.status ?? "pending"),
      op,
      kind: "publish",
      facts: taskFacts(task)
    }
  };
}
function publishCandidates(params, batch, records = {}) {
  const results = isObject(batch) && Array.isArray(batch.results) ? batch.results : [];
  const operations = isObject(params) && Array.isArray(params.operations) ? params.operations : [];
  const byKey = /* @__PURE__ */ new Map();
  for (const op of operations) if (isObject(op) && typeof op.key === "string") byKey.set(op.key, op);
  const candidates = [];
  const rejected = [];
  const publishing = /* @__PURE__ */ new Set();
  for (const result of results) {
    if (!isObject(result) || result.status !== "succeeded" || !isObject(result.data)) continue;
    if (result.op !== "create" && result.op !== "update") continue;
    const task = result.data.task;
    if (!isObject(task) || typeof task.id !== "string" || !task.id) continue;
    const op = byKey.get(String(result.key)) ?? { key: result.key, op: result.op, metadata: void 0 };
    const { candidate, rejected: reason } = candidateFor(result, op, task, records, publishing);
    if (reason) rejected.push({ taskId: task.id, reason });
    else if (candidate) {
      candidates.push(candidate);
      if (candidate.kind === "publish" && metadataOf(candidate.op)?.hojaIssue == null) publishing.add(candidate.taskId);
    }
  }
  return { candidates, rejected };
}
var record = (taskId, state, at, extra = {}) => ({ taskId, state, at, ...extra });
function linkRecord(candidate, issue, project, at, parentIdentifier, substitutedFrom, scope = "owned") {
  return record(candidate.taskId, "linked", at, {
    issueId: issue.id,
    identifier: issue.identifier,
    project,
    ...scope === "owned" ? { origin: "created" } : {},
    ...parentIdentifier ? { parentIdentifier } : {},
    ...substitutedFrom ? { substitutedFrom } : {},
    lifecycle: { scope }
  });
}
function readbackMismatch(view, expected) {
  if (expected.marker && !hasLinkMarker(view.description, expected.marker)) return "marker_missing";
  if (expected.bodyDigest && commentDigest(view.description) !== expected.bodyDigest) return "body_mismatch";
  if (expected.projectId && view.projectId !== expected.projectId) return "project_mismatch";
  if ((expected.parentIssueId || void 0) !== (view.parentId || void 0)) return "parent_mismatch";
  return void 0;
}
var RECONCILE_SKEW_MS = 15 * 6e4;
async function findByFingerprint(writer, previous, applied) {
  if (!writer.findIssuesByTitle || !previous.title || !previous.projectId) return void 0;
  const since = new Date(Date.parse(previous.at) - RECONCILE_SKEW_MS);
  if (Number.isNaN(since.getTime())) return void 0;
  const taken = new Set(Object.values(applied).filter((r) => r.taskId !== previous.taskId && r.issueId).map((r) => r.issueId));
  const hits = (await writer.findIssuesByTitle(previous.title, previous.projectId, since.toISOString())).filter((hit) => !taken.has(hit.id) && commentDigest(hit.description) === previous.bodyDigest);
  return hits.length === 1 ? { id: hits[0].id, identifier: hits[0].identifier } : void 0;
}
async function publishBatch(params, batch, context2) {
  const at = context2.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  const applied = { ...context2.records };
  const changed = [];
  const blocked = [];
  const writer = context2.writer;
  if (!context2.enabled || !writer) return { records: [], applied, blocked: [], stopped: false };
  const active = () => context2.isActive?.() !== false;
  const stopped = () => ({ records: changed, applied, blocked, stopped: true });
  const set = (next) => {
    applied[next.taskId] = next;
    changed.push(next);
    context2.journal?.(next);
  };
  const commit = (next) => {
    applied[next.taskId] = next;
    changed.push(next);
  };
  const block = (previous) => {
    if (!blocked.some((entry) => entry.taskId === previous.taskId)) blocked.push(previous);
  };
  if (!active()) return stopped();
  const live = lifecycleWriterOf(writer);
  const sync = async (linked, facts) => live ? syncTask({
    writer: live,
    record: linked,
    facts,
    marker: taskMarker(context2.sessionKey, facts.taskId),
    sessionKey: context2.sessionKey,
    project: linked.project ?? context2.project,
    active,
    journal: (entry) => context2.journal?.(entry),
    at
  }) : void 0;
  for (const previous of Object.values(context2.records)) {
    if (previous.state !== "reconciling" || !(previous.bodyDigest || previous.marker)) continue;
    if (!active()) return stopped();
    let hit;
    try {
      hit = previous.bodyDigest ? await findByFingerprint(writer, previous, applied) : await writer.findIssueByMarker(previous.marker);
    } catch {
      block(previous);
      continue;
    }
    if (!hit) {
      block(previous);
      continue;
    }
    if (!active()) return stopped();
    let view;
    try {
      view = await writer.readIssue(hit.id);
    } catch {
      block(previous);
      continue;
    }
    const proof = previous.bodyDigest ? { bodyDigest: previous.bodyDigest } : { marker: previous.marker };
    if (readbackMismatch(view, { ...proof, projectId: previous.projectId, parentIssueId: previous.expectedParentIssueId })) {
      block(previous);
      continue;
    }
    set(record(previous.taskId, "linked", at(), {
      issueId: view.id,
      identifier: view.identifier,
      project: previous.project,
      marker: previous.marker,
      origin: "created",
      ...previous.projectId ? { projectId: previous.projectId } : {},
      ...view.parentIdentifier ? { parentIdentifier: view.parentIdentifier } : {},
      lifecycle: { scope: "owned" }
    }));
  }
  const { candidates, rejected } = publishCandidates(params, batch, applied);
  if (!active()) return stopped();
  for (const entry of rejected) set(record(entry.taskId, "skipped", at(), { reason: entry.reason }));
  for (const candidate of candidates) {
    if (!active()) return stopped();
    const previous = applied[candidate.taskId];
    if (candidate.kind === "sync") {
      if (previous?.state !== "linked" || !previous.issueId) continue;
      const synced2 = await sync(previous, candidate.facts);
      if (synced2?.stopped) return stopped();
      if (synced2 && synced2.record !== previous) commit(synced2.record);
      continue;
    }
    if (previous?.state === "linked") {
      const synced2 = await sync(previous, candidate.facts);
      if (synced2?.stopped) return stopped();
      if (synced2 && synced2.record !== previous) commit(synced2.record);
      continue;
    }
    const metadata = metadataOf(candidate.op) ?? {};
    if (metadata.hojaIssue != null) {
      const wanted = String(metadata.hojaIssue).trim().toUpperCase();
      if (!IDENTIFIER_PATTERN.test(wanted)) {
        set(record(candidate.taskId, "skipped", at(), { reason: "invalid_hoja_issue" }));
        continue;
      }
      let hit;
      try {
        hit = await writer.findIssueByIdentifier(wanted);
      } catch {
        set(record(candidate.taskId, "failed", at(), { reason: "lookup_failed", identifier: wanted }));
        continue;
      }
      if (!hit) {
        set(record(candidate.taskId, "failed", at(), { reason: "issue_not_found", identifier: wanted }));
        continue;
      }
      if (hit.identifier.toUpperCase() !== wanted) {
        set(record(candidate.taskId, "failed", at(), { reason: "identifier_mismatch", identifier: wanted }));
        continue;
      }
      const adopted = record(candidate.taskId, "linked", at(), {
        issueId: hit.id,
        identifier: hit.identifier,
        project: typeof metadata.hojaProject === "string" ? metadata.hojaProject : void 0,
        lifecycle: { scope: "adopted" }
      });
      set(adopted);
      const syncedAdopted = await sync(adopted, candidate.facts);
      if (syncedAdopted?.stopped) return stopped();
      if (syncedAdopted) commit(syncedAdopted.record);
      continue;
    }
    if (previous?.state === "reconciling") {
      block(previous);
      continue;
    }
    const named = typeof metadata.hojaProject === "string" && metadata.hojaProject.trim() ? metadata.hojaProject.trim() : void 0;
    const projects = [...new Set([named, context2.project, context2.fallbackProject].map((value) => value?.trim()).filter((value) => !!value))];
    if (!projects.length) {
      set(record(candidate.taskId, "skipped", at(), { reason: "no_project" }));
      continue;
    }
    const assignee = typeof metadata.hojaAssignee === "string" && metadata.hojaAssignee.trim() ? metadata.hojaAssignee.trim() : context2.fallbackAssignee;
    let resolved;
    for (const project of projects) {
      try {
        resolved = await writer.resolve(project, assignee);
        break;
      } catch (error) {
        if (!(error instanceof HojaProjectError)) break;
        if (!active()) return stopped();
      }
    }
    if (!resolved) {
      set(record(candidate.taskId, "failed", at(), { reason: "project_unresolved", project: projects[0], ...named && projects[1] ? { substitutedFrom: named } : {} }));
      continue;
    }
    const substitutedFrom = named && resolved.project.trim().toLowerCase() !== named.toLowerCase() ? named : void 0;
    const state = candidate.status === "in_progress" ? DEFAULT_STATE_ACTIVE : DEFAULT_STATE_PENDING;
    if (!resolved.states[state.toLowerCase()]) {
      set(record(candidate.taskId, "skipped", at(), { reason: "state_unavailable", project: resolved.project }));
      continue;
    }
    const parent = candidate.parentTaskId ? applied[candidate.parentTaskId] : void 0;
    if (candidate.parentTaskId && (parent?.state !== "linked" || !parent.issueId)) {
      set(record(candidate.taskId, "skipped", at(), { reason: "parent_unpublished", project: resolved.project }));
      continue;
    }
    const parentIssueId = parent?.state === "linked" ? parent.issueId : void 0;
    const marker = taskMarker(context2.sessionKey, candidate.taskId);
    const description = issueDescription({ description: candidate.description, managed: managedSection(candidate.facts) });
    const title = candidate.subject.slice(0, 250);
    const fingerprint = {
      marker,
      title,
      bodyDigest: commentDigest(description),
      project: resolved.project,
      projectId: resolved.projectId,
      ...parentIssueId ? { expectedParentIssueId: parentIssueId } : {}
    };
    set(record(candidate.taskId, "reconciling", at(), { reason: "write_in_flight", ...fingerprint }));
    if (!active()) return stopped();
    let created;
    try {
      created = await writer.createIssue(resolved, title, description, state, {
        ...parentIssueId ? { parentId: parentIssueId } : {},
        ...candidate.priority !== void 0 ? { priority: candidate.priority } : {}
      });
    } catch (error) {
      if (error instanceof HojaRequestError && error.ambiguous)
        set(record(candidate.taskId, "reconciling", at(), { reason: "ambiguous_write", ...fingerprint }));
      else set(record(candidate.taskId, "failed", at(), { reason: "create_failed", project: resolved.project }));
      continue;
    }
    if (!active()) return stopped();
    let view;
    try {
      view = await writer.readIssue(created.id);
    } catch {
      set(record(candidate.taskId, "reconciling", at(), {
        reason: "readback_unverified",
        issueId: created.id,
        identifier: created.identifier,
        ...fingerprint
      }));
      continue;
    }
    const mismatch = view.id !== created.id ? "id_mismatch" : readbackMismatch(view, { projectId: resolved.projectId, parentIssueId });
    if (mismatch) {
      set(record(candidate.taskId, "reconciling", at(), {
        reason: "readback_mismatch",
        issueId: created.id,
        identifier: created.identifier,
        ...fingerprint
      }));
      continue;
    }
    const linked = linkRecord(candidate, view, resolved.project, at(), view.parentIdentifier ?? parent?.identifier, substitutedFrom);
    set(linked);
    const synced = await sync(linked, candidate.facts);
    if (synced?.stopped) return stopped();
    if (synced && synced.record !== linked) commit(synced.record);
  }
  return { records: changed, applied, blocked, stopped: false };
}
function finalRecords(records) {
  const latest = /* @__PURE__ */ new Map();
  for (const record2 of records) latest.set(record2.taskId, record2);
  return [...latest.values()];
}
function publicationSummary(outcome) {
  const records = finalRecords(outcome.records);
  const linked = records.filter((r) => r.state === "linked" && r.identifier);
  const closed = linked.filter((r) => r.lifecycle?.closed);
  const failed2 = records.filter((r) => r.state === "failed" || r.state === "reconciling");
  const skipped = records.filter((r) => r.state === "skipped");
  const parts = [];
  if (linked.length) parts.push(`Hoja: ${linked.map((r) => `${r.identifier} for task #${r.taskId}`).join(", ")}`);
  if (closed.length) parts.push(`Hoja closed ${closed.map((r) => r.identifier).join(", ")}`);
  if (failed2.length) parts.push(`Hoja not confirmed for task(s) ${failed2.map((r) => `#${r.taskId}`).join(", ")}`);
  if (skipped.length) parts.push(`Hoja skipped task(s) ${skipped.map((r) => `#${r.taskId} (${r.reason})`).join(", ")}`);
  const unresolved = outcome.blocked.filter((r) => !records.some((c) => c.taskId === r.taskId && c.state === "linked"));
  if (unresolved.length) parts.push(`Hoja unresolved for task(s) ${unresolved.map((r) => `#${r.taskId} (${r.reason ?? r.state})`).join(", ")}`);
  return parts.length ? parts.join("; ") : void 0;
}
var REASON_GUIDANCE = {
  no_project: 'no Hoja project is configured for this repository, so nothing was created. Add .pi/config/hoja.json with {"project":"<exact name>"} so every chat in this checkout files there, or call hoja_project action=list, then ask_user_question where to file the work; offer to create a project if none matches. Use hoja_project action=select or action=create for the user-chosen destination, then retry this task with metadata.hojaProject. The work is not blocked: bounded discovery already ran and its note lists the existing projects.',
  project_unresolved: "no declared Hoja project could be resolved (not found, hidden from this token, or its team did not resolve). Fix .pi/config/hoja.json, or call hoja_project action=list (hoja_list only lists issues), then ask_user_question where to file the work and offer a new project. Select/create the user-chosen destination and retry this same task with metadata.hojaProject. The work is not blocked; discovery ran and reports the existing projects.",
  state_unavailable: "the project's team has no Todo/In Progress workflow state, so nothing was created. Publication is skipped for this team.",
  invalid_hoja_metadata: 'metadata.hoja must be "publish" or "local".',
  invalid_hoja_issue: "metadata.hojaIssue must look like TEAM-123.",
  issue_not_found: "the named issue does not exist or is not visible to this token. Check it with hoja_get, then fix or drop metadata.hojaIssue.",
  identifier_mismatch: "the lookup returned a different identifier than the one named, so nothing was linked. Re-check the identifier with hoja_get.",
  lookup_failed: "the issue lookup failed. A later TaskManage batch for this task retries it.",
  create_failed: "Hoja rejected the create, so nothing was created. A later TaskManage batch for this task retries it.",
  parent_unpublished: 'its parent task has no Hoja issue in this chat, so it was NOT filed as a root issue. Publish the parent (metadata {"hoja":"publish"}) or link this task to an existing issue with metadata {"hojaIssue":"TEAM-123"}.'
};
var UNCONFIRMED_REASONS = /* @__PURE__ */ new Set(["write_in_flight", "ambiguous_write", "readback_unverified", "readback_mismatch"]);
var UNCONFIRMED = 'an earlier Hoja create for this task is unconfirmed, so no second issue was created. Find it with hoja_list/hoja_get and link it explicitly with metadata {"hojaIssue":"TEAM-123"}; publication stays blocked on this task until then.';
var LIFECYCLE_GUIDANCE = {
  sync_read_failed: "the linked issue could not be read back, so its questions, progress and status were not synchronized. A later TaskManage batch retries.",
  description_failed: "Hoja rejected the questions/progress update; the issue keeps its previous description. A later batch retries.",
  description_ambiguous: "the questions/progress update was ambiguous; it is idempotent (the managed block is recomputed from the live description), so a later batch safely retries it.",
  description_unverified: "the questions/progress write could not be proved by read-back (block missing, or human text changed), so nothing further was written. Check the issue with hoja_get.",
  completion_unaccepted: "the task is marked completed but at least one acceptance question has no answer, so the issue was NOT closed. Answer the question with evidence on the task, then complete it again.",
  comment_failed: "Hoja rejected the completion comment, so the issue was left open. A later batch retries it.",
  comment_ambiguous: "the completion comment may or may not have been posted. The issue was left open and the comment is never repeated automatically; check it with hoja_get.",
  comment_unverified: "the completion comment could not be read back after writing, so the issue was left open. Check it with hoja_get; the next batch reconciles by the comment text.",
  comment_unconfirmed: "an earlier completion comment is unconfirmed. No second comment was posted and the issue stays open; read its comments with hoja_get before deciding.",
  comment_pending: "an earlier completion comment was journaled but its outcome is unknown (the chat stopped mid-write). No second comment was posted; read the issue's comments with hoja_get before deciding.",
  state_failed: "Hoja rejected the workflow transition; the issue keeps its current state. A later batch retries.",
  state_ambiguous: "the workflow transition was ambiguous. Check the issue's state with hoja_get before retrying.",
  state_unverified: "the workflow transition could not be verified by read-back. Check the issue's state with hoja_get.",
  state_project_unknown: "the issue has no project to resolve workflow states from, so its state was left unchanged.",
  state_unresolved: "the project or team workflow states could not be resolved, so the issue's state was left unchanged.",
  state_target_mismatch: "the resolved project/team is not the issue's own team and project, so no state id was written.",
  shared_unowned: "this issue was not created by this session for this task, so nothing was written to it. Set metadata.hojaProject and let publication create a session issue, or link an issue this session owns.",
  shared_target_mismatch: "the shared issue's team differs from the resolved project's team, so no session sub-issue was created and nothing was written.",
  shared_project_unresolved: "a session sub-issue under the shared issue could not be created because the project did not resolve; the shared issue was left untouched.",
  subissue_failed: "the session sub-issue under the shared issue was rejected, so no lifecycle write was made to either issue.",
  subissue_ambiguous: "a session sub-issue under the shared issue may have been created but is unconfirmed; it is never repeated automatically. Find it with hoja_list and link it explicitly with metadata.hojaIssue.",
  subissue_unverified: "the session sub-issue could not be read back, so the shared issue was left untouched and no lifecycle write continues from here.",
  subissue_unconfirmed: "an earlier session sub-issue creation is unconfirmed; nothing was written to the shared issue and no second sub-issue was created. Find it with hoja_list and link it explicitly.",
  subissue_pending: "an earlier session sub-issue creation was journaled but its outcome is unknown (the chat stopped mid-write), so it is treated as ambiguous and never retried. Find it with hoja_list; do not expect an automatic retry."
};
function publicationNote(outcome) {
  const records = finalRecords(outcome.records);
  const linked = records.filter((r) => r.state === "linked" && r.identifier);
  const lines = [];
  if (linked.length)
    lines.push(`Hoja publication: linked ${linked.map((r) => `${r.identifier} (task #${r.taskId}${r.parentIdentifier ? `, child of ${r.parentIdentifier}` : ""})`).join(", ")}.`);
  for (const record2 of linked) {
    if (record2.substitutedFrom)
      lines.push(`Hoja publication: ${record2.identifier} was filed in project "${record2.project}" because "${record2.substitutedFrom}" does not exist; the repository project was used (.pi/config/hoja.json).`);
  }
  for (const record2 of records) {
    const reason = record2.lifecycle?.error;
    if (!reason) continue;
    const where = record2.identifier ? `${record2.identifier} (task #${record2.taskId})` : `task #${record2.taskId}`;
    lines.push(`Hoja lifecycle: ${where} \u2014 ${LIFECYCLE_GUIDANCE[reason] ?? `reason: ${reason}.`}`);
  }
  for (const record2 of linked) {
    if (!record2.lifecycle?.closed) continue;
    lines.push(`Hoja lifecycle: ${record2.identifier} is Done \u2014 questions, progress and the evidence comment are written.`);
  }
  for (const record2 of records) {
    if (record2.state === "linked") continue;
    if (UNCONFIRMED_REASONS.has(record2.reason ?? "")) {
      lines.push(`Hoja publication: task #${record2.taskId} \u2014 ${UNCONFIRMED}`);
      continue;
    }
    const guidance = REASON_GUIDANCE[record2.reason ?? ""] ?? (record2.reason ? `reason: ${record2.reason}.` : void 0);
    lines.push(`Hoja publication: nothing was created for task #${record2.taskId} \u2014 ${guidance ?? "the attempt did not complete."}`);
  }
  const reported = new Set(records.map((r) => r.taskId));
  for (const record2 of outcome.blocked) {
    if (reported.has(record2.taskId) || record2.state === "linked") continue;
    lines.push(`Hoja publication: task #${record2.taskId} \u2014 ${UNCONFIRMED}`);
  }
  if (!lines.length) return void 0;
  if (outcome.stopped)
    lines.push("Hoja publication stopped early because Hoja mode was turned off or the chat changed; no further writes were attempted.");
  return lines.join("\n");
}

// vendor/trebol/extensions/hoja-mode/extension.ts
var HOJA_RULE = `Hoja mode: TaskManage tasks are this chat's Hoja issues. Register work without being asked. (1) Every user request that needs more than read-only lookups gets a task before you act: create it with status "in_progress" and active=true. A root task (no parentTaskId) files one Hoja issue. (2) A request with several deliverables gets one root task plus one child task per deliverable (parentTaskId = the root, in the same batch); children of a filed task are filed as its sub-issues. Mark only mechanical steps (run tests, commit, push) metadata {"hoja":"local"}; never mark a user request local. (3) A new user message that asks for something outside the active task gets a new root task (or a child, if it serves the same goal); never fold a new request into an unrelated task. (4) Before you end a reply, complete each finished task with answers and evidence, or add a note (addNote) saying what is left. For any question about work, status, priority or what to do next, call hoja_list (or hoja_get for one identifier) before answering. Before creating, check whether an issue already exists (hoja_list); reuse it with metadata {"hojaIssue":"TEAM-123"}: your work becomes a sub-issue beneath it, and the shared issue itself is never moved, closed or commented on; for any other change to a shared issue, state it and ask the user to confirm in this conversation. File in another project with metadata {"hojaProject":"<exact project name>"}. The project is otherwise resolved for you: this chat's hoja_project selection, else the repository\u2019s .pi/config/hoja.json, else the configured default project. Publication is automatic, so read its outcome in the TaskManage result: a no_project skip files nothing and lists candidate projects; select the owner with hoja_project and the queued tasks are filed automatically. An owned issue tracks the task's questions and progress (acceptance questions live in the issue description, never as separate issues); an accepted completion (every acceptance question answered with evidence) posts one evidence comment and moves the owned issue to Done. Missing filing never blocks your work, and an unconfirmed create or completion comment is never repeated automatically. /hoja off disables publication and this guidance for the chat; hoja_list and hoja_get stay read-only.`;
var HOJA_ENTRY = "hoja-mode";
var HOJA_RECOVERY_ENTRY = "hoja-recovery";
var MAX_RECOVERY_ATTEMPTS = 2;
var MAX_RECOVERY_CANDIDATES = 12;
var MAX_PENDING_TASKS = 10;
var MAX_PROJECT_DESCRIPTION = 160;
function unresolvedProjectRecords(outcome) {
  const latest = /* @__PURE__ */ new Map();
  for (const record2 of outcome.records) latest.set(record2.taskId, record2);
  return [...latest.values()].filter((record2) => record2.state !== "linked" && (record2.reason === "no_project" || record2.reason === "project_unresolved"));
}
function batchTaskUpdates(params, batch) {
  const operations = Array.isArray(params?.operations) ? params.operations : [];
  const byKey = /* @__PURE__ */ new Map();
  for (const operation of operations) if (operation && typeof operation.key === "string") byKey.set(operation.key, operation);
  const updates = /* @__PURE__ */ new Map();
  const results = batch?.results;
  for (const result of Array.isArray(results) ? results : []) {
    const entry = result;
    if (entry?.status !== "succeeded" || entry.op !== "create" && entry.op !== "update") continue;
    const task = entry?.data?.task;
    if (!task || typeof task.id !== "string" || !task.id) continue;
    const metadata = byKey.get(String(entry.key))?.metadata;
    if (metadata?.hoja === "local" || String(task.status ?? "") === "deleted") {
      updates.set(task.id, { drop: true });
      continue;
    }
    const facts = taskFacts(task);
    updates.set(task.id, {
      drop: false,
      snapshot: {
        taskId: facts.taskId,
        subject: facts.subject,
        ...facts.description ? { description: facts.description } : {},
        ...typeof task.parent_id === "string" && task.parent_id ? { parentTaskId: task.parent_id } : {},
        status: facts.status,
        questions: facts.questions.map((question) => ({
          id: question.id,
          text: question.text,
          ...question.answer ? { answer: question.answer } : {},
          ...question.evidence ? { evidence: question.evidence } : {}
        }))
      }
    });
  }
  return updates;
}
function pendingFromBatch(batch, taskIds, params) {
  const wanted = new Set(taskIds.map(String));
  return [...batchTaskUpdates(params, batch).entries()].filter(([taskId, update]) => wanted.has(taskId) && !update.drop).map(([, update]) => update.snapshot);
}
function refreshPending(existing, batch, params) {
  const updates = batchTaskUpdates(params, batch);
  const kept = [];
  for (const task of existing) {
    const update = updates.get(task.taskId);
    if (update?.drop) continue;
    kept.push(update && !update.drop ? update.snapshot : task);
  }
  return { pending: kept.slice(-MAX_PENDING_TASKS), overflow: Math.max(0, kept.length - MAX_PENDING_TASKS) };
}
function mergePending(existing, incoming) {
  const byTask = /* @__PURE__ */ new Map();
  for (const task of existing) byTask.set(task.taskId, task);
  for (const task of incoming) byTask.set(task.taskId, task);
  const all = [...byTask.values()];
  return { pending: all.slice(-MAX_PENDING_TASKS), overflow: Math.max(0, all.length - MAX_PENDING_TASKS) };
}
function candidateLine(project) {
  const teams = project.teams.length ? ` (${project.teams.join(", ")})` : "";
  const description = project.description?.replace(/\s+/g, " ").trim().slice(0, MAX_PROJECT_DESCRIPTION);
  return `${project.name}${teams}${description ? ` \u2014 ${description}` : ""}`;
}
function recoveryNote(discovery, taskIds) {
  const tasks = taskIds.map((id) => `#${id}`).join(", ");
  if ("error" in discovery)
    return `Hoja recovery: project discovery is unavailable right now (${discovery.error}), so filing could not be repaired automatically. ${tasks || "The task"} stays queued and is retried after the next TaskManage result; your work is not blocked.`;
  const candidates = discovery.projects.slice(0, MAX_RECOVERY_CANDIDATES).map(candidateLine);
  if (!candidates.length)
    return `Hoja recovery: no project is mapped for this chat or repository and none exist yet, so ${tasks || "the task"} is queued. Ask the user where this work belongs and offer hoja_project action=create (host confirmation required). Work continues; nothing is blocked.`;
  return [
    `Hoja recovery: no project is mapped for this chat or repository, so ${tasks || "the task"} was queued rather than filed.`,
    "Resolve ownership from evidence first \u2014 the project descriptions below, this repository's docs/remote, and mappings already confirmed in this chat. Do not pick by position or name similarity.",
    `Candidates: ${candidates.join(" \xB7 ")}.`,
    "If exactly one project clearly owns this work, call hoja_project action=select with that exact name; queued tasks are retried automatically. Pass remember:true only when the user explicitly agrees to persist it for the repository. Ask the user only when the evidence is genuinely ambiguous or a new project is needed. Work continues; nothing is blocked."
  ].join("\n");
}
var HOJA_QUERIES = {
  list: `query ($first: Int!, $filter: IssueFilter) { issues(first: $first, filter: $filter) { nodes { identifier title priority createdAt updatedAt state { name } assignee { name } project { name } } } }`,
  // One issue by identifier or id. This is the resolver that consults the alias
  // ledger, so a retired flat identifier (HOJA-8) answers with the issue under
  // its current recursive identifier. Asking the *list* filter instead meant a
  // second lookup path with different semantics: the two diverged, and every
  // renumbered issue read as missing through this tool (HOJA-523, trebol#457).
  get: `query ($id: String!, $comments: Int!) { task(id: $id) { identifier title description priority createdAt updatedAt url state { name type } team { key } assignee { name } project { name } comments(first: $comments) { nodes { body createdAt user { name } } } } }`
};
var IDENTIFIER_PATTERN2 = /^[A-Za-z][A-Za-z0-9_]*-[0-9]+(?:-[A-Za-z]+-[0-9]+)*$/;
function normalizeIdentifier(raw) {
  const shown = String(raw ?? "").trim();
  if (!IDENTIFIER_PATTERN2.test(shown)) {
    throw new Error(`identifier must look like TEAM-123 or TEAM-123-A-1, for example TREBOL-237 (got "${shown}")`);
  }
  const [team, ...rest] = shown.split("-");
  const canonical = rest.map((segment, index) => {
    if (index < 1 || index % 2 === 0) return segment;
    const slot = (index + 1) / 2;
    return slot % 2 === 1 ? segment.toUpperCase() : segment.toLowerCase();
  });
  return [team.toUpperCase(), ...canonical].join("-");
}
var CLOSED_STATE_TYPES = ["completed", "canceled"];
var STATE_TYPES = ["backlog", "unstarted", "started", "completed", "canceled"];
var DEFAULT_LIMIT = 100;
var MAX_LIMIT = 200;
var DEFAULT_COMMENTS = 10;
var MAX_COMMENTS = 50;
var COMMENT_BODY_LIMIT = 1200;
var text2 = (value, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: {}, ...isError ? { isError: true } : {} });
function instant(value, field) {
  const raw = value.trim();
  const ms2 = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  if (!Number.isFinite(ms2)) throw new Error(`${field} must be an ISO date (YYYY-MM-DD) or an ISO timestamp`);
  return new Date(ms2).toISOString();
}
function integer2(raw, name, fallback, min, max) {
  if (raw === void 0 || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}
function buildIssueFilter(params = {}) {
  const clauses = [];
  const state = params.state?.trim();
  const lowered = state?.toLowerCase();
  if (!state || lowered === "open") clauses.push({ state: { type: { nin: [...CLOSED_STATE_TYPES] } } });
  else if (lowered === "all") {
  } else if (lowered === "closed") clauses.push({ state: { type: { in: [...CLOSED_STATE_TYPES] } } });
  else if (STATE_TYPES.includes(lowered)) clauses.push({ state: { type: { eq: lowered } } });
  else clauses.push({ state: { name: { eqIgnoreCase: state } } });
  if (params.assignee?.trim()) clauses.push({ assignee: { name: { containsIgnoreCase: params.assignee.trim() } } });
  if (params.project?.trim()) clauses.push({ project: { name: { eqIgnoreCase: params.project.trim() } } });
  if (params.team?.trim()) clauses.push({ team: { key: { eq: params.team.trim().toUpperCase() } } });
  if (params.updatedSince) clauses.push({ updatedAt: { gte: instant(params.updatedSince, "updatedSince") } });
  if (params.updatedBefore) clauses.push({ updatedAt: { lt: instant(params.updatedBefore, "updatedBefore") } });
  if (params.createdSince) clauses.push({ createdAt: { gte: instant(params.createdSince, "createdSince") } });
  if (params.createdBefore) clauses.push({ createdAt: { lt: instant(params.createdBefore, "createdBefore") } });
  return clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { and: clauses };
}
var clip = (value, limit) => {
  const body = value ?? "";
  return body.length <= limit ? body : `${body.slice(0, limit)}\u2026 [truncated: ${body.length - limit} more characters]`;
};
function hojaTools(client) {
  const error = (e) => text2({ error: e instanceof HojaRequestError ? e.message : "Hoja lookup failed; no raw error details exposed." }, true);
  return [
    {
      name: "hoja_list",
      label: "Hoja list",
      ...HOJA_LIST_CONTRACT,
      async execute(_id, params = {}) {
        try {
          const limit = integer2(params.limit, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
          const filter = buildIssueFilter(params);
          const nodes = (await client.gql(HOJA_QUERIES.list, { first: limit + 1, filter })).issues.nodes;
          const issues = nodes.slice(0, limit);
          const truncated = nodes.length > limit;
          return text2({
            issues,
            returnedCount: issues.length,
            truncated,
            appliedFilter: filter,
            note: truncated ? `Partial list: more than ${limit} issues match these filters. Narrow them or raise limit (max ${MAX_LIMIT}); returnedCount is not the total.` : issues.length === 0 ? "No issues match these filters. project and state names match exactly (case-insensitive) and assignee is a substring; check appliedFilter." : "Complete list for these filters."
          });
        } catch (e) {
          return error(e);
        }
      }
    },
    {
      name: "hoja_get",
      label: "Hoja get",
      ...HOJA_GET_CONTRACT,
      async execute(_id, params) {
        let wanted;
        try {
          wanted = normalizeIdentifier(params.identifier);
        } catch (e) {
          return text2({ error: e instanceof Error ? e.message : String(e) }, true);
        }
        try {
          const requested = integer2(params.comments, "comments", DEFAULT_COMMENTS, 1, MAX_COMMENTS);
          const detail = (await client.gql(HOJA_QUERIES.get, {
            id: wanted,
            comments: requested
          })).task ?? null;
          if (!detail) return text2({ error: `issue ${wanted} not found. Check the identifier (TEAM-NUMBER).` }, true);
          const { comments: rawComments, ...issue } = detail;
          const comments = (rawComments?.nodes ?? []).map((c) => ({ author: c.user?.name ?? "unknown", createdAt: c.createdAt, body: clip(c.body, COMMENT_BODY_LIMIT) }));
          return text2({
            ...issue,
            comments,
            commentsReturned: comments.length,
            commentsRequested: requested,
            ...comments.length === requested ? { commentsNote: `Only the ${requested} most recent comments were requested; older ones may exist.` } : {}
          });
        } catch (e) {
          return error(e);
        }
      }
    }
  ];
}
var asWriter = (client) => {
  const candidate = client;
  const methods = ["resolve", "createIssue", "readIssue", "findIssueByMarker", "findIssueByIdentifier"];
  return candidate && methods.every((method) => typeof candidate[method] === "function") ? candidate : void 0;
};
function registerHojaMode(pi, client = new HojaClient(), options = {}) {
  let enabled = true;
  let selectedProject;
  let projectAttempts = [];
  let records = {};
  let recovery = { attempts: 0, reported: [], pending: [], overflow: 0 };
  let generation = 0;
  let queue = Promise.resolve();
  const footer = modeFooter("hoja", () => enabled);
  const writer = asWriter(client);
  const config = options.config ?? (() => readHojaConfigForRepository());
  const persistMapping = options.persist ?? ((name) => writeHojaProjectMapping(name));
  let sessionKey = "session";
  const project = () => selectedProject ?? (options.project?.trim() || void 0) ?? config().project ?? (process.env.HOJA_PROJECT?.trim() || void 0);
  const setEnabled = (next) => {
    enabled = next;
    generation += 1;
    pi.appendEntry?.(HOJA_ENTRY, { enabled });
  };
  const retryQueued = async (projectName, scopedGeneration, ctx) => {
    if (!writer || !recovery.pending.length) return { linked: [], outcome: void 0 };
    const queued = recovery.pending.slice(0, MAX_PENDING_TASKS);
    const operations = queued.map((task) => ({
      key: `queued-${task.taskId}`,
      op: "update",
      metadata: { hojaProject: projectName },
      ...task.description ? { description: task.description } : {}
    }));
    const results = queued.map((task) => ({
      key: `queued-${task.taskId}`,
      op: "update",
      status: "succeeded",
      data: { task: { id: task.taskId, subject: task.subject, status: task.status, parent_id: task.parentTaskId ?? "", questions: task.questions } }
    }));
    let outcome;
    try {
      outcome = await publishBatch({ operations }, { results }, {
        enabled: true,
        sessionKey,
        project: projectName,
        writer,
        records,
        fallbackProject: config().project,
        fallbackAssignee: config().assignee,
        journal: (entry) => {
          if (scopedGeneration === generation) pi.appendEntry?.(HOJA_TASK_ENTRY, entry);
        },
        isActive: () => scopedGeneration === generation
      });
    } catch {
      return { linked: [], outcome: void 0 };
    }
    if (scopedGeneration !== generation) return { linked: [], outcome: void 0 };
    records = outcome.applied;
    const linked = outcome.records.filter((record2) => record2.state === "linked" && record2.identifier).map((record2) => String(record2.identifier));
    const linkedIds = new Set(outcome.records.filter((record2) => record2.state === "linked").map((record2) => record2.taskId));
    recovery = { ...recovery, pending: recovery.pending.filter((task) => !linkedIds.has(task.taskId)) };
    pi.appendEntry?.(HOJA_RECOVERY_ENTRY, recovery);
    if (linked.length) ctx?.ui?.notify?.(`Hoja: queued task(s) filed as ${linked.join(", ")}.`, "info");
    return { linked, outcome };
  };
  for (const tool of hojaTools(client)) pi.registerTool(tool);
  pi.registerTool(projectTool(client, {
    enabled: () => enabled,
    current: project,
    epoch: () => generation,
    select: async (name) => {
      const scoped = generation;
      pi.appendEntry("hoja-project", { name });
      selectedProject = name;
      client.invalidateCatalog?.();
      const job = queue.then(() => retryQueued(name, scoped, void 0), () => retryQueued(name, scoped, void 0));
      queue = job.then(() => void 0, () => void 0);
      const retried = await job;
      if (scoped !== generation) return void 0;
      return retried.linked.length ? { linked: retried.linked } : void 0;
    },
    persist: (name) => {
      try {
        return persistMapping(name);
      } catch {
        return false;
      }
    },
    attempt: (name, teamId) => {
      pi.appendEntry("hoja-project-attempt", { name, teamId });
      projectAttempts.push({ name, teamId });
    },
    pending: (name, teamId) => projectAttempts.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.teamId === teamId)
  }));
  pi.registerCommand("hoja", {
    description: "Hoja work mode: /hoja on|off|status (publishes coarse tasks; session-local)",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "status";
      if (action === "on") setEnabled(true);
      else if (action === "off") setEnabled(false);
      else if (action !== "status") {
        ctx.ui?.notify?.("Usage: /hoja on|off|status", "warning");
        return;
      }
      footer.refresh(ctx);
      ctx.ui?.notify?.(`Hoja mode ${enabled ? "on" : "off"}. ${enabled ? `Work questions check Hoja first; coarse TaskManage tasks publish to ${project() ?? `no project (set ${HOJA_CONFIG_PATH})`}.` : "Automatic publication and Hoja-first guidance disabled; read tools remain available."} An owned issue keeps current questions and progress and closes only after an accepted completion; a reused or shared issue is never written to. Saved per chat; kept across /reload, resume and fork.`, "info");
    }
  });
  pi.on("session_start", (_event, ctx) => {
    generation += 1;
    enabled = latestSessionModeEntry(ctx, HOJA_ENTRY)?.enabled !== false;
    records = replayHojaRecords(ctx?.sessionManager?.getBranch?.() ?? ctx?.sessionManager?.getEntries?.() ?? []);
    selectedProject = latestSessionModeEntry(ctx, "hoja-project")?.name;
    projectAttempts = (ctx?.sessionManager?.getBranch?.() ?? ctx?.sessionManager?.getEntries?.() ?? []).filter((e) => e.type === "custom" && e.customType === "hoja-project-attempt" && typeof e.data?.name === "string" && typeof e.data?.teamId === "string").map((e) => e.data);
    sessionKey = String(ctx?.sessionManager?.getSessionId?.() ?? sessionKey);
    const saved = latestSessionModeEntry(ctx, HOJA_RECOVERY_ENTRY);
    recovery = {
      attempts: typeof saved?.attempts === "number" && Number.isFinite(saved.attempts) ? saved.attempts : 0,
      reported: Array.isArray(saved?.reported) ? saved.reported.filter((id) => typeof id === "string") : [],
      // The queue survives reload: a task filed nowhere is never silently forgotten.
      pending: Array.isArray(saved?.pending) ? saved.pending.filter((task) => !!task && typeof task.taskId === "string" && typeof task.subject === "string" && typeof task.status === "string" && Array.isArray(task.questions)).slice(-MAX_PENDING_TASKS) : [],
      overflow: typeof saved?.overflow === "number" && Number.isFinite(saved.overflow) ? Math.max(0, saved.overflow) : 0
    };
    footer.refresh(ctx);
  });
  pi.on("session_shutdown", (_event, ctx) => {
    generation += 1;
    footer.clear(ctx);
  });
  pi.on("tool_result", (event, ctx) => {
    if (!enabled || event?.toolName !== "TaskManage" || !writer) return;
    const batch = event?.details?.batch ?? event?.details;
    if (!batch || !Array.isArray(batch.results)) return;
    const startGeneration = generation;
    sessionKey = String(ctx?.sessionManager?.getSessionId?.() ?? sessionKey);
    const attempt = (recordsForAttempt) => publishBatch(event.input, batch, {
      enabled: true,
      sessionKey,
      project: project(),
      writer,
      records: recordsForAttempt,
      // An agent that names a project which does not exist falls back to the repository's project instead of
      // failing the registration, and the note tells it the name it used was not the one that landed.
      fallbackProject: config().project,
      fallbackAssignee: config().assignee,
      // The intent is journaled before the create request, so a crash mid-write leaves a durable trail.
      journal: (entry) => {
        if (startGeneration === generation) pi.appendEntry?.(HOJA_TASK_ENTRY, entry);
      },
      isActive: () => startGeneration === generation
    });
    const discover = async () => {
      const catalog = await client.gql(PROJECT_CATALOG);
      client.invalidateCatalog?.();
      return {
        projects: catalog.projects.nodes.map((project2) => ({
          name: project2.name,
          ...typeof project2.description === "string" && project2.description.trim() ? { description: project2.description.trim() } : {},
          teams: project2.teams.nodes.map((team) => team.key)
        }))
      };
    };
    const work = async () => {
      let outcome;
      try {
        outcome = await attempt(records);
      } catch {
        if (startGeneration === generation) ctx?.ui?.notify?.("Hoja publication did not run; task state is unaffected.", "warning");
        return void 0;
      }
      if (startGeneration !== generation) return void 0;
      records = outcome.applied;
      const previousOverflow = recovery.overflow ?? 0;
      const refreshed = refreshPending(recovery.pending, batch, event.input);
      let overflow = refreshed.overflow;
      const unfiledIds = Object.values(records).filter((record2) => record2.state !== "linked" && (record2.reason === "no_project" || record2.reason === "project_unresolved")).map((record2) => record2.taskId);
      const requeued = mergePending(refreshed.pending, pendingFromBatch(batch, unfiledIds, event.input));
      overflow = Math.max(overflow, requeued.overflow);
      recovery = { ...recovery, pending: requeued.pending, overflow };
      pi.appendEntry?.(HOJA_RECOVERY_ENTRY, recovery);
      const declared = project();
      if (declared && recovery.pending.length && startGeneration === generation) {
        const retried = await retryQueued(declared, startGeneration, ctx);
        if (startGeneration !== generation) return void 0;
        if (retried.outcome) {
          outcome = { ...retried.outcome, records: [...outcome.records, ...retried.outcome.records] };
        }
      }
      let unresolved = unresolvedProjectRecords(outcome);
      let discovery;
      if (unresolved.length && recovery.attempts < MAX_RECOVERY_ATTEMPTS && startGeneration === generation) {
        recovery = { ...recovery, attempts: recovery.attempts + 1 };
        pi.appendEntry?.(HOJA_RECOVERY_ENTRY, recovery);
        try {
          discovery = await discover();
        } catch (error) {
          discovery = { error: error instanceof HojaRequestError ? error.message : "Hoja request failed" };
        }
        if (startGeneration !== generation) return void 0;
        if (!("error" in discovery) && declared && unresolved.some((record2) => record2.reason === "project_unresolved")) {
          try {
            outcome = await attempt(outcome.applied);
            if (startGeneration !== generation) return void 0;
            unresolved = unresolvedProjectRecords(outcome);
          } catch {
          }
        }
      }
      const linked = new Set(outcome.records.filter((record2) => record2.state === "linked").map((record2) => record2.taskId));
      if (linked.size) {
        recovery = { ...recovery, pending: recovery.pending.filter((task) => !linked.has(task.taskId)) };
        pi.appendEntry?.(HOJA_RECOVERY_ENTRY, recovery);
      }
      records = outcome.applied;
      const summary2 = publicationSummary(outcome);
      if (summary2) ctx?.ui?.notify?.(summary2, outcome.records.every((r) => r.state === "linked") && !outcome.blocked.length ? "info" : "warning");
      const parts = [publicationNote(outcome) ?? ""];
      if (overflow > previousOverflow)
        parts.push(`Hoja recovery: the queue holds ${MAX_PENDING_TASKS} unfiled task(s) and ${overflow} more are not queued. Each is re-queued from its authoritative task on its next successful update; none is treated as filed.`);
      const fresh = unresolved.filter((record2) => !recovery.reported.includes(record2.taskId));
      if (discovery && fresh.length) {
        parts.push(recoveryNote(discovery, fresh.map((record2) => record2.taskId)));
        recovery = { ...recovery, reported: [...recovery.reported, ...fresh.map((record2) => record2.taskId)] };
        pi.appendEntry?.(HOJA_RECOVERY_ENTRY, recovery);
      }
      const note = parts.filter(Boolean).join("\n");
      if (!note) return void 0;
      const content = Array.isArray(event.content) ? event.content : typeof event.content === "string" ? [{ type: "text", text: event.content }] : [];
      return { content: [...content, { type: "text", text: note }] };
    };
    const queued = queue.then(work, work);
    queue = queued.then(() => void 0, () => void 0);
    return queued;
  });
  pi.on("before_agent_start", (event) => enabled ? { systemPrompt: String(event.systemPrompt ?? "") + "\n" + HOJA_RULE + "\nUse hoja_project action=list to discover real projects including empty ones; hoja_list is NOT a project catalog. Resolve ownership from evidence first: the candidate descriptions reported in the TaskManage result, this repository's docs/remote, and mappings already confirmed in this chat. Call hoja_project action=select with the one project that clearly owns the work; queued tasks are then retried automatically, and plain TaskManage updates retry them too. Pass remember:true only when the user explicitly agrees to persist it for the whole repository (host confirmation required). Ask the user with ask_user_question only when the evidence is genuinely ambiguous or a new project is needed, and use hoja_project action=create after confirmation. Never pick by position or name similarity, and never make a replacement task. A missing filing never blocks work and is reported honestly at completion." } : void 0);
}

// src/transcript.ts
import { readFileSync as readFileSync3, statSync as statSync3 } from "node:fs";
var PI_API_PREFIX = "mcp__hoja__";
var ownToolPrefix = (name) => profile().ownToolPrefixes.find((prefix) => name.startsWith(prefix));
var isOwnTool = (name) => ownToolPrefix(name) !== void 0;
var canonicalToolName = (name) => {
  const { apiToolPrefixes, bashAliases } = profile();
  const own = ownToolPrefix(name);
  if (own) return name.slice(own.length);
  const api = apiToolPrefixes.find((prefix) => name.startsWith(prefix));
  if (api) return PI_API_PREFIX + name.slice(api.length);
  return bashAliases.includes(name) ? "Bash" : name;
};
var STOP = { end_turn: "stop", stop_sequence: "stop", tool_use: "toolUse", max_tokens: "length", pause_turn: "pause" };
var textParts = (content) => {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => block?.type === "text" && typeof block.text === "string" ? [{ type: "text", text: block.text }] : []);
};
function parseTranscript(text3) {
  const first = text3.slice(0, text3.indexOf("\n") === -1 ? text3.length : text3.indexOf("\n"));
  if (/"type"\s*:\s*"(session_meta|response_item|event_msg|turn_context)"/.test(first)) return parseCodexRollout(text3);
  if (isAgyTranscriptLine(first)) return parseAgyTranscript(text3);
  return parseClaudeTranscript(text3);
}
var isAgyTranscriptLine = (line) => /"step_index"\s*:/.test(line) && /"type"\s*:\s*"(USER_INPUT|PLANNER_RESPONSE|GENERIC|SYSTEM_MESSAGE)"/.test(line);
var agyUserRequest = (content) => /<USER_REQUEST>\n?([\s\S]*?)\n?<\/USER_REQUEST>/.exec(content)?.[1] ?? content;
var agyResultText = (content) => content.replace(/^(?:(?:Created|Completed) At: [^\n]*\n)+/, "");
function agyToolName(call) {
  const name = String(call?.name ?? "tool");
  if (name === "call_mcp_tool") return canonicalToolName(`mcp__${call.args?.ServerName ?? ""}__${call.args?.ToolName ?? ""}`);
  const map = { run_command: "Bash", read_file: "Read", view_file: "Read", write_file: "Write", edit_file: "Edit", replace_file_content: "Edit", multi_replace_file_content: "MultiEdit", apply_patch: "Edit", list_dir: "LS", list_directory: "LS", grep_search: "Grep", find_by_name: "Glob", search_web: "WebSearch", read_url_content: "WebFetch", tool_search: "ToolSearch" };
  return map[name] ?? name;
}
function parseAgyTranscript(text3) {
  const out = [];
  let pending = [];
  for (const line of text3.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e?.type === "USER_INPUT" && typeof e.content === "string") {
      pending = [];
      out.push({ role: "user", content: [{ type: "text", text: agyUserRequest(e.content) }] });
    } else if (e?.type === "PLANNER_RESPONSE") {
      const parts = [];
      if (typeof e.content === "string" && e.content) parts.push({ type: "text", text: e.content });
      const calls2 = Array.isArray(e.tool_calls) ? e.tool_calls : [];
      pending = calls2.map((call, i) => ({ id: `agy-${e.step_index}-${i}`, name: agyToolName(call) }));
      for (const p of pending) parts.push({ type: "toolCall", id: p.id, name: p.name });
      out.push({ role: "assistant", content: parts, stopReason: calls2.length ? "toolUse" : "stop" });
    } else if (e?.type === "GENERIC" && pending.length) {
      const call = pending.shift();
      let body = agyResultText(typeof e.content === "string" ? e.content : "");
      const denied = typeof e.error === "string" ? /denied by (?:a )?pre-tool hook:\s*([\s\S]*)$/.exec(e.error) : null;
      if (denied) body = `blocked by hook: ${denied[1]}`;
      const exit = /Command exited with code (\d+)/.exec(body);
      out.push({ role: "toolResult", toolCallId: call.id, toolName: call.name, content: body ? [{ type: "text", text: body }] : [], isError: e.status === "ERROR" || !!exit && exit[1] !== "0" });
    }
  }
  return out;
}
var ROLLOUT_INJECTED = /^\s*<(environment_context|user_instructions|permissions instructions|skills_instructions|turn_aborted|subagent_notification)\b/;
var rolloutText = (content) => Array.isArray(content) ? content.flatMap((part) => (part?.type === "input_text" || part?.type === "output_text" || part?.type === "text") && typeof part.text === "string" && part.text ? [{ type: "text", text: part.text }] : []) : textParts(content);
var rolloutOutput = (output) => {
  if (typeof output === "string") return { parts: output ? [{ type: "text", text: output }] : [], isError: false };
  const o = output;
  if (o && typeof o === "object" && !Array.isArray(o) && "content" in o)
    return { parts: typeof o.content === "string" ? o.content ? [{ type: "text", text: o.content }] : [] : rolloutText(o.content), isError: o.success === false };
  return { parts: rolloutText(output), isError: false };
};
function parseCodexRollout(text3) {
  const out = [];
  const names = /* @__PURE__ */ new Map();
  let assistant;
  const openAssistant = () => {
    if (!assistant) {
      assistant = { role: "assistant", content: [], stopReason: "stop" };
      out.push(assistant);
    }
    return assistant;
  };
  for (const line of text3.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "response_item") continue;
    const item = entry.payload;
    if (!item || typeof item !== "object") continue;
    if (item.type === "message") {
      if (item.role === "assistant") {
        const a = openAssistant();
        if (a.content.some((p) => p.type === "toolCall")) {
          assistant = void 0;
          openAssistant().content.push(...rolloutText(item.content));
        } else a.content.push(...rolloutText(item.content));
      } else if (item.role === "user") {
        const parts = rolloutText(item.content).filter((p) => p.type === "text" && !ROLLOUT_INJECTED.test(p.text));
        if (parts.length) {
          assistant = void 0;
          out.push({ role: "user", content: parts });
        }
      }
      continue;
    }
    if ((item.type === "function_call" || item.type === "custom_tool_call" || item.type === "local_shell_call") && typeof item.call_id === "string") {
      const raw = item.type === "local_shell_call" ? "local_shell" : typeof item.namespace === "string" && item.namespace ? `${item.namespace}__${item.name}` : String(item.name ?? "");
      const name = canonicalToolName(raw);
      names.set(item.call_id, name);
      const a = openAssistant();
      a.content.push({ type: "toolCall", id: item.call_id, name });
      a.stopReason = "toolUse";
      continue;
    }
    if ((item.type === "function_call_output" || item.type === "custom_tool_call_output") && typeof item.call_id === "string") {
      assistant = void 0;
      const { parts, isError } = rolloutOutput(item.output);
      out.push({ role: "toolResult", toolCallId: item.call_id, toolName: names.get(item.call_id) ?? "tool", content: parts, isError });
    }
  }
  return out;
}
function parseClaudeTranscript(text3) {
  const out = [];
  const names = /* @__PURE__ */ new Map();
  let lastAssistantId;
  for (const line of text3.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    if (!message || typeof message !== "object") continue;
    if (entry.type === "assistant" && message.role === "assistant") {
      const parts = [];
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block?.type === "text" && typeof block.text === "string") parts.push({ type: "text", text: block.text });
        else if (block?.type === "tool_use" && typeof block.id === "string") {
          const name = canonicalToolName(String(block.name ?? ""));
          names.set(block.id, name);
          parts.push({ type: "toolCall", id: block.id, name });
        }
      }
      const stopReason = typeof message.stop_reason === "string" ? STOP[message.stop_reason] ?? message.stop_reason : void 0;
      const previous = out.at(-1);
      if (previous?.role === "assistant" && message.id && message.id === lastAssistantId) {
        previous.content.push(...parts);
        if (stopReason) previous.stopReason = stopReason;
      } else out.push({ role: "assistant", content: parts, ...stopReason ? { stopReason } : {} });
      lastAssistantId = message.id;
      continue;
    }
    if (entry.type === "user" && message.role === "user") {
      lastAssistantId = void 0;
      if (typeof message.content === "string") {
        out.push({ role: "user", content: textParts(message.content) });
        continue;
      }
      const blocks = Array.isArray(message.content) ? message.content : [];
      const plain2 = [];
      for (const block of blocks) {
        if (block?.type === "tool_result" && typeof block.tool_use_id === "string") {
          out.push({ role: "toolResult", toolCallId: block.tool_use_id, toolName: names.get(block.tool_use_id) ?? "tool", content: textParts(block.content), isError: block.is_error === true });
        } else if (block?.type === "text" && typeof block.text === "string") plain2.push({ type: "text", text: block.text });
      }
      if (plain2.length) out.push({ role: "user", content: plain2 });
    }
  }
  return out;
}
var TranscriptReader = class {
  path;
  cache;
  setPath(path) {
    if (path && path !== this.path) {
      this.path = path;
      this.cache = void 0;
    }
  }
  messages() {
    if (!this.path) return [];
    try {
      const stat = statSync3(this.path);
      if (this.cache && this.cache.size === stat.size && this.cache.mtime === stat.mtimeMs) return this.cache.messages;
      const messages = parseTranscript(readFileSync3(this.path, "utf8"));
      this.cache = { size: stat.size, mtime: stat.mtimeMs, messages };
      return messages;
    } catch {
      return [];
    }
  }
  /** Pi session entries for evidence: every tool result, in order, under its canonical tool name. */
  toolResultEntries() {
    return this.messages().filter((m) => m.role === "toolResult").map((m) => ({ type: "message", message: { role: "toolResult", toolName: m.toolName } }));
  }
};

// src/pi-shim.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync6 } from "node:fs";
import { join as join4 } from "node:path";

// src/trace/touched.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync5, renameSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";

// src/trace/recorder.ts
import { appendFileSync, existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync4 } from "node:fs";
import { join as join2 } from "node:path";

// src/trace/redact.ts
var PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b(?:hoja|lin)_(?:api|oauth)_[A-Za-z0-9]{16,}/g
];
var ASSIGNMENTS = /((?:authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|client[_-]?secret)["']?\s*[:=]\s*["']?(?:bearer\s+)?)([^\s"',;&]{8,})/gi;
var SECRET_ENV = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|CREDENTIAL)/i;
var Redactor = class {
  literals;
  constructor(env = process.env) {
    this.literals = Object.entries(env).filter(([name, value]) => SECRET_ENV.test(name) && typeof value === "string" && value.trim().length >= 8).map(([, value]) => value.trim()).sort((a, b) => b.length - a.length);
  }
  scrub(text3) {
    let out = text3;
    for (const literal of this.literals) if (out.includes(literal)) out = out.split(literal).join("[redacted]");
    for (const pattern of PATTERNS) out = out.replace(pattern, "[redacted]");
    return out.replace(ASSIGNMENTS, "$1[redacted]");
  }
};
var FIELD_CAP = 256e3;
function clipMiddle(text3, max) {
  if (text3.length <= max) return text3;
  const head = Math.ceil(max * 0.6), tail = max - head;
  const omitted = text3.length - head - tail;
  return `${text3.slice(0, head).replace(/[\uD800-\uDBFF]$/, "")}
\u2026 [${omitted} chars omitted] \u2026
${text3.slice(text3.length - tail).replace(/^[\uDC00-\uDFFF]/, "")}`;
}
function clip2(text3, max, counted = true) {
  if (text3.length <= max) return text3;
  const head = text3.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
  return counted ? `${head}\u2026 [+${text3.length - head.length} chars]` : `${head.trimEnd()}\u2026`;
}
function taskOps(ops) {
  return ops.map((op) => op?.op === "create" ? `create ${op.subject ?? ""}`.trim() : op?.op === "update" ? `#${op.taskId ?? "?"}${op.status ? ` \u2192 ${op.status}` : op.active ? " focus" : " update"}` : String(op?.op ?? "")).filter(Boolean).join(", ");
}
function inputPreview(tool, input2) {
  if (input2 == null) return "";
  if (typeof input2 === "string") return input2;
  const i = input2;
  const pick = (...keys) => keys.map((k) => i[k]).find((v) => typeof v === "string" && v);
  const lead = tool === "Bash" ? pick("command") : /^(Read|Write|Edit|MultiEdit|NotebookEdit)$/.test(tool) ? pick("file_path", "notebook_path") : /^(Grep|Glob)$/.test(tool) ? [pick("pattern"), pick("path")].filter(Boolean).join("  in ") : /^(WebFetch|WebSearch)$/.test(tool) ? pick("url", "query") : tool === "Agent" || tool === "Task" ? pick("description", "prompt") : tool === "TaskManage" && Array.isArray(i.operations) ? taskOps(i.operations) : pick("action", "query", "identifier", "issue", "subject", "description", "url", "name", "command", "path");
  if (lead) return lead;
  const pairs = Object.entries(i).filter(([, v]) => v !== null && ["string", "number", "boolean"].includes(typeof v)).map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`);
  if (pairs.length) return pairs.join(" ");
  try {
    return JSON.stringify(input2);
  } catch {
    return String(input2);
  }
}
function toolLabel(tool, input2) {
  const preview = inputPreview(tool, input2).split("\n")[0];
  return preview && preview !== "{}" ? `${tool} \xB7 ${clip2(preview, 100, false)}` : tool;
}

// src/trace/recorder.ts
var SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;
var tracesDir = (dataDir2) => join2(dataDir2, "traces");
var eventsPath = (dataDir2, sessionId) => join2(tracesDir(dataDir2), `${SAFE_ID.test(sessionId) ? sessionId : "invalid-session"}.events.jsonl`);
var tracePath = (dataDir2, sessionId) => join2(tracesDir(dataDir2), `${SAFE_ID.test(sessionId) ? sessionId : "invalid-session"}.trace.json`);
var num = (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : void 0;
};
var str = (v) => typeof v === "string" && v ? v : void 0;
var TraceRecorder = class {
  constructor(options) {
    this.options = options;
    this.redactor = options.redactor ?? new Redactor();
    this.full = (options.detail ?? "full") === "full";
  }
  options;
  redactor;
  full;
  lastTranscript;
  text(value, max) {
    if (!this.full) return void 0;
    const s = typeof value === "string" ? value : value == null ? "" : (() => {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })();
    return s ? clip2(this.redactor.scrub(s), max) : void 0;
  }
  /** Whole content (scrubbed), for hooks-only traces: prompts, tool inputs, outputs and errors. */
  content(value) {
    if (!this.full) return void 0;
    const s = typeof value === "string" ? value : value == null ? "" : (() => {
      try {
        return JSON.stringify(value, null, 1);
      } catch {
        return String(value);
      }
    })();
    return s ? clipMiddle(this.redactor.scrub(s), FIELD_CAP) : void 0;
  }
  /** Shape one hook payload (already placeholder-filtered by the bridge) plus the bridge's own decision. */
  shape(event, payload, output = {}, outputText) {
    const at = (this.options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
    const tool = str(payload.tool_name);
    const hso = output?.hookSpecificOutput ?? {};
    const record2 = {
      at,
      event,
      agentId: str(payload.agent_id),
      agentType: str(payload.agent_type),
      tool,
      toolUseId: str(payload.tool_use_id),
      durationMs: num(payload.duration_ms),
      permissionMode: str(payload.permission_mode),
      model: typeof payload.model === "string" ? payload.model : str(payload.model?.id),
      stepIdx: num(payload.step_idx),
      invocationNum: num(payload.invocation_num)
    };
    if (event === "PreToolUse") {
      if (hso.permissionDecision === "deny") {
        record2.decision = "deny";
        record2.reason = this.content(hso.permissionDecisionReason) ?? "blocked";
      } else if (hso.additionalContext) record2.context = this.content(hso.additionalContext);
      record2.label = this.text(inputPreview(tool ?? "", payload.tool_input).split("\n")[0], 200);
      record2.input = this.content(payload.tool_input && typeof payload.tool_input === "object" && !Object.keys(payload.tool_input).length ? "" : tool === "Bash" ? inputPreview(tool, payload.tool_input) : payload.tool_input);
    }
    if (event === "PostToolUse") {
      record2.output = this.content(outputText);
      const touched = tool ? extractTouchedIssuesFromTool(tool, payload.tool_input, outputText) : [];
      if (touched.length) record2.touchedIssues = touched;
    }
    if (event === "PostToolUseFailure") {
      record2.error = this.content(outputText ?? payload.error) ?? "failed";
      if (payload.is_interrupt === true || payload.is_interrupt === "true") record2.interrupted = true;
    }
    if (event === "UserPromptSubmit") record2.prompt = this.content(payload.prompt);
    if (event === "SessionStart") record2.source = str(payload.source);
    const transcript = str(payload.transcript_path);
    if (transcript && !payload.agent_id && this.lastTranscript !== transcript) {
      record2.transcriptPath = transcript;
      this.lastTranscript = transcript;
    }
    if (event === "SessionEnd") record2.reason = str(payload.reason);
    if (event === "PreCompact" || event === "PostCompact") record2.trigger = str(payload.trigger);
    if (event === "Notification") {
      record2.message = this.text(payload.message, 300);
      record2.notificationType = str(payload.notification_type);
    }
    if (event === "StopFailure") record2.error = this.content(payload.error) ?? "turn failed";
    if (event === "PermissionDenied") record2.reason = this.text(payload.reason, 300);
    if (event === "SubagentStop") record2.agentTranscriptPath = str(payload.agent_transcript_path);
    return Object.fromEntries(Object.entries(record2).filter(([, v]) => v !== void 0));
  }
  record(sessionId, event, payload, output, outputText) {
    if (!sessionId) return;
    try {
      const shaped = this.shape(event, payload, output, outputText);
      if (shaped.touchedIssues?.length) appendTouchedIssues(this.options.dataDir, sessionId, shaped.touchedIssues);
      const line = JSON.stringify(shaped);
      mkdirSync2(tracesDir(this.options.dataDir), { recursive: true, mode: 448 });
      appendFileSync(eventsPath(this.options.dataDir, sessionId), line + "\n", { mode: 384 });
    } catch (error) {
      this.options.log?.(`trace record failed: ${error.message}`);
    }
  }
};
function readHookRecords(dataDir2, sessionId) {
  const path = eventsPath(dataDir2, sessionId);
  if (!existsSync2(path)) return [];
  return readFileSync4(path, "utf8").split("\n").flatMap((line) => {
    try {
      return line.trim() ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

// src/trace/touched.ts
var SAFE_ID2 = /^[A-Za-z0-9._-]{1,128}$/;
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
function safePath(dir, file) {
  mkdirSync3(dir, { recursive: true, mode: 448 });
  return join3(dir, file);
}
function writeAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync2(tmp, JSON.stringify(value), { mode: 384 });
  renameSync(tmp, path);
}
function recordActiveSession(dataDir2, sessionId, ppid = process.ppid) {
  if (!dataDir2 || !SAFE_ID2.test(sessionId)) return;
  try {
    const dir = tracesDir(dataDir2);
    const payload = { sessionId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (ppid > 1) writeAtomic(safePath(dir, `.active-${ppid}.json`), payload);
    writeAtomic(safePath(dir, ".active.json"), payload);
  } catch {
  }
}
function readActiveSession(dataDir2, ppid = process.ppid, maxAgeMs = 24 * 60 * 60 * 1e3) {
  if (!dataDir2) return void 0;
  const dir = tracesDir(dataDir2);
  for (const name of [...ppid > 1 ? [`.active-${ppid}.json`] : [], ".active.json"]) {
    const file = join3(dir, name);
    if (!existsSync3(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync5(file, "utf8"));
      const sid = typeof parsed?.sessionId === "string" ? parsed.sessionId : "";
      const age = Date.now() - Date.parse(String(parsed?.updatedAt ?? ""));
      if (SAFE_ID2.test(sid) && (!Number.isFinite(age) || age <= maxAgeMs)) return sid;
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
var touchedPath = (dataDir2, sessionId) => join3(tracesDir(dataDir2), `${SAFE_ID2.test(sessionId) ? sessionId : "invalid-session"}.issues.json`);
function readTouchedIssues(dataDir2, sessionId) {
  if (!dataDir2 || !SAFE_ID2.test(sessionId)) return [];
  const path = touchedPath(dataDir2, sessionId);
  if (!existsSync3(path)) return [];
  try {
    const v = JSON.parse(readFileSync5(path, "utf8"));
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && !!x) : [];
  } catch {
    return [];
  }
}
function appendTouchedIssues(dataDir2, sessionId, issues) {
  if (!dataDir2 || !SAFE_ID2.test(sessionId) || !issues.length) return [];
  try {
    const merged = [.../* @__PURE__ */ new Set([...readTouchedIssues(dataDir2, sessionId), ...issues.filter(Boolean)])];
    const path = touchedPath(dataDir2, sessionId);
    mkdirSync3(tracesDir(dataDir2), { recursive: true, mode: 448 });
    writeAtomic(path, merged);
    return merged;
  } catch {
    return [];
  }
}

// src/pi-shim.ts
var SAFE_ID3 = /^[A-Za-z0-9._-]{1,128}$/;
var PiShim = class {
  constructor(options) {
    this.options = options;
    this.cwd = options.cwd;
    const project = process.env.CLAUDE_PROJECT_DIR?.trim();
    if (project) this.evidenceRoots.push(project);
  }
  options;
  tools = /* @__PURE__ */ new Map();
  commands = /* @__PURE__ */ new Map();
  handlers = /* @__PURE__ */ new Map();
  entries = [];
  seq = 0;
  transcript = new TranscriptReader();
  sessionId;
  cwd;
  /** Messages extensions sent to `ctx.ui.notify`; the hook bridge surfaces them where Claude Code can show them. */
  notifications = [];
  /**
   * Stable evidence roots for TaskManage: the directory the session started in (and CLAUDE_PROJECT_DIR). `cwd`
   * follows every hook payload, i.e. wherever the agent's shell last `cd`-ed, and TaskManage resolves citations
   * against it; without these, valid workspace evidence was rejected as outside_allowed_roots after a `cd` (HOJA-757).
   * Mutated in place: registerTaskManage keeps this array by reference.
   */
  evidenceRoots = [];
  widgets = /* @__PURE__ */ new Map();
  /** The object handed to `registerTaskManage(pi, …)` and `registerHojaMode(pi, …)`. */
  api = {
    registerTool: (tool) => {
      if (this.tools.has(tool.name)) throw new Error(`duplicate tool ${tool.name}`);
      this.tools.set(tool.name, tool);
    },
    registerCommand: (name, spec) => {
      this.commands.set(name, spec);
    },
    registerShortcut: (_shortcut, _spec) => {
    },
    on: (event, handler) => {
      this.handlers.set(event, [...this.handlers.get(event) ?? [], handler]);
    },
    appendEntry: (customType, data) => this.appendEntry(customType, data),
    sendMessage: (_message, _options) => {
    }
  };
  journalPath(sessionId) {
    return join4(this.options.dataDir, "sessions", `${SAFE_ID3.test(sessionId) ? sessionId : "invalid-session"}.jsonl`);
  }
  appendEntry(customType, data) {
    const entry = { type: "custom", customType, data: data === void 0 ? void 0 : structuredClone(data), id: `${Date.now().toString(36)}-${(this.seq++).toString(36)}`, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
    this.entries.push(entry);
    if (!this.sessionId) return;
    try {
      mkdirSync4(join4(this.options.dataDir, "sessions"), { recursive: true, mode: 448 });
      appendFileSync2(this.journalPath(this.sessionId), JSON.stringify(entry) + "\n", { mode: 384 });
    } catch (error) {
      this.options.log?.(`journal write failed: ${error.message}`);
    }
  }
  /** Pi's branch: journaled custom entries, then the session's tool-result messages from the Claude transcript. */
  branch() {
    return [...this.entries, ...this.transcript.toolResultEntries()];
  }
  sessionManager = {
    getEntries: () => this.branch(),
    getBranch: () => this.branch(),
    getSessionId: () => this.sessionId
  };
  ctx(extra = {}) {
    const notify = (message, level = "info") => {
      this.notifications.push({ message: String(message), level });
      this.options.log?.(`[${level}] ${message}`);
    };
    return {
      cwd: this.cwd,
      hasUI: !!this.options.confirm,
      sessionManager: this.sessionManager,
      hasPendingMessages: () => false,
      ui: {
        notify,
        setWidget: (key, content) => {
          if (content === void 0) this.widgets.delete(key);
          else this.widgets.set(key, content);
        },
        setStatus: () => {
        },
        requestRender: () => {
        },
        ...this.options.confirm ? { confirm: this.options.confirm } : {}
      },
      ...extra
    };
  }
  async emit(event, payload = {}, ctx = this.ctx()) {
    const results = [];
    for (const handler of this.handlers.get(event) ?? []) {
      try {
        results.push(await handler({ type: event, ...payload }, ctx));
      } catch (error) {
        this.options.log?.(`${event} handler failed: ${error.message}`);
      }
    }
    return results;
  }
  /** Pi's tool_result chain: each handler may replace `content`, and the next handler sees the replacement. */
  async emitToolResult(event) {
    let content = event.content;
    const ctx = this.ctx();
    for (const handler of this.handlers.get("tool_result") ?? []) {
      try {
        const result = await handler({ type: "tool_result", ...event, content }, ctx);
        if (result && Array.isArray(result.content)) content = result.content;
      } catch (error) {
        this.options.log?.(`tool_result handler failed: ${error.message}`);
      }
    }
    return content;
  }
  /** Bind to a Claude Code session: load its journal and replay Pi's session_start (after session_shutdown of the old one). */
  async bindSession(sessionId, transcriptPath, cwd) {
    if (cwd) this.cwd = cwd;
    this.transcript.setPath(transcriptPath);
    if (sessionId) recordActiveSession(this.options.dataDir, sessionId);
    if (sessionId === this.sessionId) return false;
    if (this.sessionId) await this.emit("session_shutdown");
    this.sessionId = sessionId;
    if (cwd && !this.evidenceRoots.includes(cwd)) this.evidenceRoots.push(cwd);
    this.entries = [];
    const path = this.journalPath(sessionId);
    if (existsSync4(path)) {
      for (const line of readFileSync6(path, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          this.entries.push(JSON.parse(line));
        } catch {
        }
      }
    }
    await this.emit("session_start");
    return true;
  }
};

// vendor/trebol/.pi/lib/policy/swarm-annoyance-nudge.ts
var MAX_FINGERPRINT_MATERIAL_BYTES = 8 << 10;
function wrapReminder(source, kind, seq, body) {
  source = source.trim() || "unknown";
  if (!["nudge", "block", "review", "context"].includes(kind)) kind = "context";
  if (seq < 1) seq = 1;
  const esc = source.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;");
  return `<system-reminder source="${esc}" kind="${kind}" seq="${seq}">${body.trim()}</system-reminder>`;
}
function reminderKind(source, content) {
  const lower = `${source} ${content}`.toLowerCase();
  if (lower.includes("skill review") || lower.includes("autogenskills")) return "review";
  if (lower.includes("block") || lower.includes("enforcement")) return "block";
  if (lower.includes("nudge") || lower.includes("reminder")) return "nudge";
  return "context";
}
function formatHookContext(hookName, content) {
  const trimmed2 = content.trim();
  if (trimmed2 === "") return "";
  if (trimmed2.startsWith("<system-reminder ") && trimmed2.includes(' source="') && trimmed2.includes(' kind="') && trimmed2.includes(' seq="')) return trimmed2;
  const name = hookName || "hook";
  return wrapReminder(name, reminderKind(name, trimmed2), nextReminderSeq(name), trimmed2);
}
var sequences = /* @__PURE__ */ new Map();
function nextReminderSeq(source) {
  const next = (sequences.get(source) ?? 0) + 1;
  sequences.set(source, next);
  return next;
}

// vendor/trebol/.pi/lib/runtime/swarm-toolclass.ts
var normalizeToolName = (name) => name.replace(/_/g, "").toLowerCase();
var isTaskManagementTool = (name) => ["taskcreate", "tasklist", "taskget", "taskupdate", "taskmanage", "todowrite", "todoread"].includes(normalizeToolName(name));
var isCodeModeTool = (name) => normalizeToolName(name) === "codemode";
var isSkillTool = (name) => ["skillmanage", "skillinvoke", "skillcall", "useskill", "skillexec", "skill"].includes(normalizeToolName(name));
var isPlanModeTool = (name) => ["enterplanmode", "exitplanmode"].includes(normalizeToolName(name));
var isUserInteractionTool = (name) => ["askuserquestion", "pushagentupdate", "annoyed"].includes(normalizeToolName(name));
var isReadOnlyExplorationTool = (name) => [
  "read",
  "readfile",
  "grep",
  "glob",
  "search",
  "websearch",
  "webfetch",
  "codesearch",
  "gitlog",
  "gitstatus",
  "gitdiff",
  "gitshow",
  "gitblame",
  "lsp",
  "lspdefinition",
  "lspreferences",
  "lsphover",
  "ls",
  "list",
  "listdir"
].includes(normalizeToolName(name));
var isReadOnlyMemoryCall = (name, params) => normalizeToolName(name) === "memoryhistory" && (params?.operation === "search" || params?.operation === "get");
var READ_ONLY_DOMAIN_TOOLS = [
  "hojalist",
  "hojaget",
  "contextsearch",
  "contextoutline",
  "contextread",
  "contextinspect",
  "historysearch",
  "historyget"
];
var isReadOnlyDomainTool = (name) => READ_ONLY_DOMAIN_TOOLS.includes(normalizeToolName(name));
var isReadOnlyVaultCall = (name, params) => normalizeToolName(name) === "vault" && (params?.action === "list" || params?.action === "get");
var isBashTool = (name) => ["bash", "shell", "execute"].includes(normalizeToolName(name));
function scanDoubleQuoted(command, start) {
  let value = "";
  for (let i = start + 1; i < command.length; i++) {
    const c = command[i];
    if (c === '"') return [i, value, true];
    if (c === "\\") {
      if (i + 1 >= command.length) return [0, "", false];
      i++;
      value += command[i];
      continue;
    }
    if (c === "`") {
      const [end, ok] = skipBackticks(command, i);
      if (!ok) return [0, "", false];
      value += "x";
      i = end;
      continue;
    }
    if (c === "$" && i + 1 < command.length && command[i + 1] === "(") {
      const [end, ok] = skipDollarSubstitution(command, i);
      if (!ok) return [0, "", false];
      value += "x";
      i = end;
      continue;
    }
    value += c;
  }
  return [0, "", false];
}
function skipBackticks(command, start) {
  for (let i = start + 1; i < command.length; i++) {
    if (command[i] === "\\") {
      i++;
      continue;
    }
    if (command[i] === "`") return [i, true];
  }
  return [0, false];
}
function skipDollarSubstitution(command, start) {
  let depth = 1;
  for (let i = start + 2; i < command.length; i++) {
    const c = command[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      if (end < 0) return [0, false];
      i = end;
      continue;
    }
    if (c === '"') {
      const [end, , ok] = scanDoubleQuoted(command, i);
      if (!ok) return [0, false];
      i = end;
      continue;
    }
    if (c === "`") {
      const [end, ok] = skipBackticks(command, i);
      if (!ok) return [0, false];
      i = end;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return [i, true];
    }
  }
  return [0, false];
}
function parseShellHeredoc(command, start) {
  let i = start + 2;
  const heredoc = { word: "", stripTabs: false };
  if (i < command.length && command[i] === "-") {
    heredoc.stripTabs = true;
    i++;
  }
  while (i < command.length && (command[i] === " " || command[i] === "	")) i++;
  if (i < command.length && command[i] === "\\") i++;
  if (i >= command.length) return [{ word: "", stripTabs: false }, 0, false];
  if (command[i] === "'" || command[i] === '"') {
    const quote2 = command[i];
    i++;
    const startWord2 = i;
    while (i < command.length && command[i] !== quote2) i++;
    if (i >= command.length || i === startWord2) return [{ word: "", stripTabs: false }, 0, false];
    heredoc.word = command.slice(startWord2, i);
    return [heredoc, i + 1, true];
  }
  const startWord = i;
  while (i < command.length && !" 	\r\n;|&<>".includes(command[i])) i++;
  if (i === startWord) return [{ word: "", stripTabs: false }, 0, false];
  heredoc.word = command.slice(startWord, i);
  return [heredoc, i, true];
}
function skipShellHeredocBodies(command, start, heredocs) {
  let pos = start;
  for (const heredoc of heredocs) {
    let found = false;
    while (pos <= command.length) {
      let end = command.indexOf("\n", pos);
      if (end < 0) end = command.length;
      let line = command.slice(pos, end).replace(/[ \t\r]+$/, "");
      if (heredoc.stripTabs) line = line.replace(/^\t+/, "");
      if (line === heredoc.word) {
        found = true;
        pos = end < command.length ? end + 1 : end;
        break;
      }
      if (end === command.length) break;
      pos = end + 1;
    }
    if (!found) return [0, false];
  }
  return [pos, true];
}
function parseShellCommands(command) {
  const commands = [];
  let fields = [];
  let word = "";
  let pendingHeredocs = [];
  const flushWord = () => {
    if (word.length === 0) return;
    fields.push(word);
    word = "";
  };
  const flushCommand = () => {
    flushWord();
    if (fields.length > 0) {
      commands.push(fields);
      fields = [];
    }
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    switch (c) {
      case "\\":
        if (i + 1 >= command.length) return [[], false];
        i++;
        if (command[i] !== "\n") word += command[i];
        break;
      case "'": {
        const end = command.indexOf("'", i + 1);
        if (end < 0) return [[], false];
        word += command.slice(i + 1, end);
        i = end;
        break;
      }
      case '"': {
        const [end, value, ok] = scanDoubleQuoted(command, i);
        if (!ok) return [[], false];
        word += value;
        i = end;
        break;
      }
      case "`": {
        const [end, ok] = skipBackticks(command, i);
        if (!ok) return [[], false];
        word += "x";
        i = end;
        break;
      }
      case "$":
        if (i + 1 < command.length && command[i + 1] === "(") {
          const [end, ok] = skipDollarSubstitution(command, i);
          if (!ok) return [[], false];
          word += "x";
          i = end;
          continue;
        }
        word += c;
        break;
      case "<":
        if (i + 1 < command.length && command[i + 1] === "<") {
          if (i + 2 < command.length && command[i + 2] === "<") {
            word += "<<<";
            i += 2;
            continue;
          }
          flushWord();
          const [heredoc, next, ok] = parseShellHeredoc(command, i);
          if (!ok) return [[], false];
          pendingHeredocs.push(heredoc);
          i = next - 1;
          continue;
        }
        word += c;
        break;
      case " ":
      case "	":
      case "\r":
        flushWord();
        break;
      case "\n":
        flushCommand();
        if (pendingHeredocs.length > 0) {
          const [next, ok] = skipShellHeredocBodies(command, i + 1, pendingHeredocs);
          if (!ok) return [[], false];
          pendingHeredocs = [];
          i = next - 1;
        }
        break;
      case ";":
      case "|":
      case "&":
        flushCommand();
        if (i + 1 < command.length && command[i + 1] === c) i++;
        break;
      default:
        word += c;
    }
  }
  flushCommand();
  return [commands, true];
}
function isShellAssignment(field) {
  const eq = field.indexOf("=");
  if (eq <= 0) return false;
  for (let i = 0; i < eq; i++) {
    const c = field[i];
    const alpha = c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
    const digit = c >= "0" && c <= "9";
    if (!alpha && (i === 0 || !digit)) return false;
  }
  return true;
}
function shellExecutableIndex(fields) {
  for (let i = 0; i < fields.length; i++) if (!isShellAssignment(fields[i])) return i;
  return -1;
}
var shellBase = (word) => {
  const slash = word.lastIndexOf("/");
  return slash >= 0 ? word.slice(slash + 1) : word;
};
var readOnlyBinaries = /* @__PURE__ */ new Set([
  "ls",
  "cat",
  "head",
  "tail",
  "find",
  "grep",
  "rg",
  "ag",
  "wc",
  "file",
  "stat",
  "which",
  "tree",
  "du",
  "df",
  "pwd",
  "echo",
  "printf",
  "date",
  "cd",
  "pushd",
  "popd"
]);
function isBashReadOnly(cmd) {
  const [commands, ok] = parseShellCommands(cmd);
  if (!ok || commands.length === 0) return false;
  for (const fields of commands) {
    const executable = shellExecutableIndex(fields);
    if (executable < 0) return false;
    const binary = shellBase(fields[executable]);
    if (readOnlyBinaries.has(binary)) continue;
    const args = fields.slice(executable + 1);
    if (binary === "git") {
      if (args.length === 0) return false;
      switch (args[0]) {
        case "status":
        case "log":
        case "diff":
        case "show":
        case "blame":
        case "branch":
        case "tag":
        case "remote":
        case "ls-files":
        case "ls-tree":
        case "rev-parse":
        case "describe":
        case "shortlog":
          continue;
        case "stash":
          if (args.length > 1 && args[1] === "list") continue;
      }
      return false;
    }
    if (binary === "go") {
      if (args.length > 0) switch (args[0]) {
        case "doc":
        case "list":
        case "version":
        case "env":
        case "vet":
          continue;
      }
      return false;
    }
    return false;
  }
  return true;
}

// vendor/trebol/.pi/lib/runtime/swarm-builtin-hooks.ts
var AUTOGEN_BUDGET_SOURCE = /* @__PURE__ */ Symbol.for("pi-swarm-autogen-budget-source");
var invocationTool = (name) => ["skill", "swarmskill", "skillinvoke", "skillcall", "useskill", "skillexec"].includes(normalizeToolName(name));
var META_NUDGE_TASK = 10;
var META_NUDGE_MAINTENANCE = 20;
var META_NUDGE_SKILL_REVIEW = 30;
var META_NUDGE_BLOCK = 40;
var DEFAULT_NUDGE_INTERVAL = 5;
var MetaNudgeBudget = class {
  constructor(interval = DEFAULT_NUDGE_INTERVAL) {
    this.interval = interval;
    if (this.interval === 0) this.interval = DEFAULT_NUDGE_INTERVAL;
  }
  interval;
  states = /* @__PURE__ */ new Map();
  state(session) {
    return this.states.get(session) ?? { turn: 0, lastAt: 0, lastSeq: 0, lastPriority: 0 };
  }
  recordUserTurn(session) {
    if (session.trim() === "") return 0;
    const s = this.state(session.trim());
    s.turn++;
    s.lastPriority = 0;
    this.states.set(session.trim(), s);
    return s.turn;
  }
  tryClaim(session, priority) {
    if (session.trim() === "") {
      const s2 = this.state("__unscoped__");
      s2.lastSeq++;
      this.states.set("__unscoped__", s2);
      return [s2.lastSeq, true];
    }
    const key = session.trim();
    const s = this.state(key);
    if (s.turn === 0) return [0, false];
    if (s.lastAt !== 0 && s.turn - s.lastAt < this.interval) return [0, false];
    s.lastAt = s.turn;
    s.lastSeq++;
    s.lastPriority = priority;
    this.states.set(key, s);
    return [s.lastSeq, true];
  }
};
var hasFocusedTask = (tasks) => tasks.some((t) => t.status === "in_progress" && t.active === true);
var CONTINUE = {};
var TASK_ENFORCEMENT_HOOK = "task-enforcement-hook";
var TASK_COMPLETION_HOOK = "task-completion-enforcement-hook";
var TASK_COMPLETION_TOOL_THRESHOLD = 8;
var TASK_COMPLETION_MAX_NUDGES = 3;
var HAS_PLAN_PHRASES = [
  "continue with the plan",
  "continue with plan",
  "follow the plan",
  "follow your plan",
  "stick to the plan",
  "as planned",
  "according to plan",
  "according to the plan",
  "like we planned",
  "like you planned",
  "per the plan",
  "per plan",
  "from the plan",
  "from your plan",
  "in the plan",
  "in your plan",
  "the plan is",
  "my plan is",
  "our plan is",
  "go ahead with the plan",
  "proceed with the plan",
  "execute the plan",
  "implement the plan",
  "do what you planned",
  "do what you said",
  "do what we discussed",
  "continue doing",
  "keep going",
  "carry on",
  "proceed",
  "resume"
];
var userIndicatesExistingPlan = (message) => {
  const lower = message.toLowerCase();
  return HAS_PLAN_PHRASES.some((p) => lower.includes(p));
};
var TaskEnforcementHook = class {
  constructor(mode = "advise") {
    this.mode = mode;
  }
  mode;
  name = TASK_ENFORCEMENT_HOOK;
  counter = 0;
  planModeUsed = false;
  userHasPlan = false;
  lastUserMessage = "";
  /** EventMessageAfterReceive with role user. */
  onUserMessage(content) {
    if (content === "") return;
    this.lastUserMessage = content;
    if (userIndicatesExistingPlan(content)) this.userHasPlan = true;
  }
  /** EventToolBeforeExecute. */
  onToolBefore(event, tasks, budget, session, isSubAgent = false) {
    if (this.mode === "off" || isSubAgent) return CONTINUE;
    const toolName2 = event.toolName;
    if (!toolName2) return CONTINUE;
    if (isPlanModeTool(toolName2)) this.planModeUsed = true;
    if (isTaskManagementTool(toolName2) || isPlanModeTool(toolName2) || isSkillTool(toolName2) || isUserInteractionTool(toolName2) || isCodeModeTool(toolName2)) return CONTINUE;
    if (isReadOnlyExplorationTool(toolName2) || isReadOnlyMemoryCall(toolName2, event.params) || isReadOnlyDomainTool(toolName2) || isReadOnlyVaultCall(toolName2, event.params)) return CONTINUE;
    if (normalizeToolName(toolName2) === "clawfinish" && tasks.some((t) => t.status === "completed")) return CONTINUE;
    if (isBashTool(toolName2)) {
      const cmd = event.params?.command;
      if (typeof cmd === "string" && isBashReadOnly(cmd)) return CONTINUE;
    }
    if (hasFocusedTask(tasks)) {
      this.counter = 0;
      return CONTINUE;
    }
    this.counter++;
    if (this.mode === "block") return { block: true, message: wrapReminder(this.name, "block", nextReminderSeq(this.name), this.enforcementMessageContextual()) };
    const [seq, ok] = budget.tryClaim(session, META_NUDGE_BLOCK);
    if (!ok) return CONTINUE;
    return { message: wrapReminder(this.name, "nudge", seq, "No active task is focused; consider a TaskManage create/update before multi-step work.") };
  }
  enforcementMessageContextual() {
    if (this.userHasPlan) return `[TASK ENFORCEMENT - BLOCKED]

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
              YOU CANNOT EXECUTE ANY TOOL WITHOUT A TASK
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The user indicated they have a plan, but you need to CREATE TASKS to track it.

                              NO TASK = NO EXECUTION

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
                        CREATE TASKS FROM THE PLAN:
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

   \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
   \u2551  Use TaskManage create operations to break the plan into tasks       \u2551
   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
                              EXAMPLE:
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  TaskManage create operation:
    subject: "Implement step 1 of the plan"
    category: "acting"
    description: "From the plan: ..."

After creating your task(s), ALL tools will be unlocked.`;
    return `[TASK ENFORCEMENT - BLOCKED] YOU CANNOT EXECUTE ANY TOOL WITHOUT A TASK

This is a HARD REQUIREMENT. RECOMMENDED WORKFLOW:
  1. enter_plan_mode()  \u2014 for complex work
  2. TaskManage create operation
  3. TaskManage update operation with status="in_progress"
  4. Execute your tools
  5. TaskManage update operation with status="completed"

Categories: researching | planning | acting | verifying | debugging | documenting`;
  }
};
var TaskCompletionEnforcementHook = class {
  name = TASK_COMPLETION_HOOK;
  taskID = "";
  toolCalls = 0;
  nudges = 0;
  toolThreshold;
  maxNudges;
  enabled;
  constructor(config = {}) {
    this.toolThreshold = Math.max(1, config.toolThreshold ?? TASK_COMPLETION_TOOL_THRESHOLD);
    this.maxNudges = Math.max(0, config.maxNudges ?? TASK_COMPLETION_MAX_NUDGES);
    this.enabled = config.enabled !== false;
  }
  reset(id = "") {
    this.taskID = id;
    this.toolCalls = 0;
    this.nudges = 0;
  }
  exempt(event) {
    if (isTaskManagementTool(event.toolName) || isPlanModeTool(event.toolName) || isSkillTool(event.toolName) || isUserInteractionTool(event.toolName) || isCodeModeTool(event.toolName) || isReadOnlyExplorationTool(event.toolName)) return true;
    if (isBashTool(event.toolName)) {
      const command = event.params?.command;
      if (typeof command === "string" && isBashReadOnly(command)) return true;
    }
    return false;
  }
  onToolBefore(event, tasks, budget, session) {
    if (!this.enabled) return CONTINUE;
    const focused = tasks.find((t) => t.status === "in_progress" && t.active === true && !t.owner);
    if (!focused) {
      this.reset();
      return CONTINUE;
    }
    if (focused.id !== this.taskID) this.reset(focused.id);
    if (!event.toolName || this.exempt(event)) return CONTINUE;
    if (this.toolCalls < this.toolThreshold) {
      this.toolCalls++;
      return CONTINUE;
    }
    if (this.nudges >= this.maxNudges) return { block: true, message: this.blockMessage(focused) };
    const [seq, ok] = budget.tryClaim(session, META_NUDGE_MAINTENANCE);
    if (!ok) return CONTINUE;
    this.nudges++;
    return { message: wrapReminder(this.name, "nudge", seq, this.nudgeMessage(focused)) };
  }
  nudgeMessage(task) {
    return `[TASK COMPLETION NUDGE \u2014 ${task.subject}]

You have continued acting on this focused task for ${this.toolCalls} tool calls. Pause and reconcile it with TaskManage before more implementation:
  - If the acceptance criteria are verified, update status="completed" and active=false.
  - If unfinished, update the description or add a blocker note and keep it active.
  - Do not claim completion merely because this reminder appeared.`;
  }
  blockMessage(task) {
    return `[TASK COMPLETION ENFORCEMENT \u2014 BLOCKED]

Further acting tools are paused for focused task #${task.id} (${task.subject}). Use TaskManage to reconcile the work first: mark it completed only after verification, or record the blocker/scope change and update its state. TaskManage, read-only tools, skills, and verification planning remain available.`;
  }
};
var TASK_MAINTENANCE_HOOK = "task-maintenance-reminder-hook";
var TOOL_EXECUTION_THRESHOLD = 8;
var USER_MESSAGE_REMINDER_STRIDE = 5;
var sessionTaskStatuses = (tasks) => {
  const pending = [], inProgress = [];
  for (const t of tasks) {
    if ((t.owner ?? "") !== "") continue;
    if (t.status === "pending") pending.push(t);
    else if (t.status === "in_progress") inProgress.push(t);
  }
  inProgress.sort((a, b) => Number(b.active === true) - Number(a.active === true));
  return { pending, inProgress };
};
var TaskMaintenanceReminderHook = class {
  name = TASK_MAINTENANCE_HOOK;
  count = 0;
  lastTaskID = "";
  remindedAt = 0;
  msgCount = 0;
  reset() {
    this.count = 0;
    this.remindedAt = 0;
    this.msgCount = 0;
  }
  setTaskID(id) {
    if (this.lastTaskID !== id) {
      this.lastTaskID = id;
      this.count = 0;
      this.remindedAt = 0;
      this.msgCount = 0;
    }
  }
  shouldRemindOnMessage() {
    const should = this.msgCount % USER_MESSAGE_REMINDER_STRIDE === 0;
    this.msgCount++;
    return should;
  }
  shouldRemind() {
    if (this.count - this.remindedAt >= TOOL_EXECUTION_THRESHOLD) {
      this.remindedAt = this.count;
      return true;
    }
    return false;
  }
  wrap(body, budget, session) {
    const [seq, ok] = budget.tryClaim(session, META_NUDGE_MAINTENANCE);
    return ok ? { message: wrapReminder(this.name, "nudge", seq, body) } : CONTINUE;
  }
  onUserMessage(tasks, budget, session) {
    const { pending, inProgress } = sessionTaskStatuses(tasks);
    if (inProgress.length > 0) {
      this.setTaskID(inProgress[0].id);
      if (!this.shouldRemindOnMessage()) return CONTINUE;
      return this.wrap(this.inProgressReminderMessage(inProgress, pending), budget, session);
    }
    if (pending.length > 0) {
      if (!this.shouldRemindOnMessage()) return CONTINUE;
      return this.wrap(this.startTaskReminderMessage(pending), budget, session);
    }
    return CONTINUE;
  }
  onToolAfter(event, tasks, budget, session) {
    if (!event.toolName) return CONTINUE;
    if (isTaskManagementTool(event.toolName) || isPlanModeTool(event.toolName)) return CONTINUE;
    const { pending, inProgress } = sessionTaskStatuses(tasks);
    if (inProgress.length === 0) {
      this.reset();
      return CONTINUE;
    }
    this.setTaskID(inProgress[0].id);
    const count = ++this.count;
    if (this.shouldRemind()) return this.wrap(this.expandedWorkReminderMessage(count, inProgress[0], pending), budget, session);
    return CONTINUE;
  }
  inProgressReminderMessage(inProgress, pending) {
    let sb = "[Task Maintenance Reminder]\n\n";
    if (inProgress.length === 1) sb += `You have 1 task in progress: ${inProgress[0].subject}
`;
    else {
      sb += `You have ${inProgress.length} tasks in progress.
`;
      for (const t of inProgress) sb += `  - ${t.subject}
`;
    }
    if (pending.length > 0) sb += `
${pending.length} task(s) pending after current work.
`;
    sb += "\nRemember to:\n  - Mark tasks completed when done (TaskManage update)\n  - Add new tasks if work expands\n  - Check tasks periodically with a TaskManage list operation";
    return sb;
  }
  startTaskReminderMessage(pending) {
    let sb = `[Task Reminder]

You have ${pending.length} pending task(s) but none in progress.

Available tasks:
`;
    pending.forEach((t, i) => {
      if (i >= 3) return;
      const statusByID = new Map(pending.map((p) => [p.id, p.status]));
      const blockers = (t.dependsOn ?? []).filter((dep) => statusByID.has(dep) && statusByID.get(dep) !== "completed");
      sb += blockers.length > 0 ? `  - ${t.subject} (blocked by: ${blockers.join(", ")})
` : `  - ${t.subject} [available]
`;
    });
    if (pending.length > 3) sb += `  ... and ${pending.length - 3} more
`;
    sb += "\nUse a TaskManage update operation to mark a task as 'in_progress' before working on it.";
    return sb;
  }
  expandedWorkReminderMessage(toolCount, current, pending) {
    let sb = `[Task Maintenance Reminder]

You've used ${toolCount} tools while working on: ${current.subject}

Has the work expanded beyond the original task?

Consider:
  - Creating new tasks for additional work discovered
  - Updating task descriptions if scope changed
  - Marking this task complete and starting follow-ups
`;
    sb += pending.length > 0 ? `
${pending.length} task(s) already pending. Add more if needed.` : "\nNo pending tasks - use a TaskManage create operation if new work emerged.";
    return sb;
  }
};
var POST_ACTING_HOOK = "post-acting-hook";
var DEFAULT_ACTING_THRESHOLD = 2;
var PostActingHook = class {
  constructor(threshold = DEFAULT_ACTING_THRESHOLD) {
    this.threshold = threshold;
  }
  threshold;
  name = POST_ACTING_HOOK;
  completedActing = /* @__PURE__ */ new Set();
  prompted = false;
  startSession(tasks) {
    this.completedActing = new Set(tasks.filter((task) => task.status === "completed" && task.category === "acting").map((task) => task.id));
    this.prompted = false;
  }
  onToolAfter(event, tasks) {
    if (event.failed || !isTaskManagementTool(event.toolName)) return CONTINUE;
    for (const task of tasks) {
      if (task.status === "completed" && task.category === "acting") this.completedActing.add(task.id);
    }
    if (this.completedActing.size < this.threshold) return CONTINUE;
    if (this.prompted || tasks.some((task) => task.status !== "deleted" && (task.category === "verifying" || task.category === "documenting"))) return CONTINUE;
    this.prompted = true;
    return { message: `[POST-ACTING WORKFLOW REMINDER]

You have completed ${this.threshold}+ acting (implementation) tasks.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
              THE WORK IS NOT DONE UNTIL IT IS VERIFIED AND DOCUMENTED
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The implementation you just completed needs follow-up work:

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  REQUIRED NEXT STEPS:                                                       \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502  1. Create VERIFYING tasks for the code you wrote:                          \u2502
\u2502     - Run the test suite                                                    \u2502
\u2502     - Verify edge cases                                                     \u2502
\u2502     - Check integration points                                              \u2502
\u2502                                                                             \u2502
\u2502  2. Create DOCUMENTING tasks for the changes:                              \u2502
\u2502     - Update relevant README sections                                       \u2502
\u2502     - Add/update code comments                                              \u2502
\u2502     - Update changelog if applicable                                        \u2502
\u2502     - Document any new APIs or configuration                                \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
                                WHY THIS MATTERS:
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  Creation \u2260 Verification. The agent made something \u2014 that's 50% of the job.
  The other 50% is proving it works and documenting it for future developers.

  Unverified code is broken code.
  Undocumented code is unmaintainable code.

If you have already created verifying/documenting tasks, this reminder can be ignored.
Otherwise, CREATE THEM NOW before proceeding with more acting tasks.` };
  }
};
var SWARM_TUI_AUTOGEN_TRIGGER = { toolCallBudget: 5, workingBudget: 90, maxNudgeIgnores: 3, nudgeInterval: 5, errorResolutionThreshold: 1 };
var AUTOGEN_LIFECYCLE_HOOK = "autogenskills";
var AUTOGEN_BUDGET_HOOK = "autogenskills-budget-enforcement";
var AutogenLifecycleHook = class {
  constructor(trigger = SWARM_TUI_AUTOGEN_TRIGGER) {
    this.trigger = trigger;
  }
  trigger;
  name = AUTOGEN_LIFECYCLE_HOOK;
  itersSinceSkill = 0;
  hadRecentError = false;
  lastNudgeAt = 0;
  onToolAfter(event, budget, session) {
    if (event.failed) {
      this.hadRecentError = true;
      return CONTINUE;
    }
    if (isSkillTool(event.toolName)) {
      this.itersSinceSkill = 0;
      this.lastNudgeAt = 0;
    } else this.itersSinceSkill++;
    this.hadRecentError = false;
    const iters = this.itersSinceSkill;
    const parts = [];
    if (iters > this.trigger.nudgeInterval && iters > this.lastNudgeAt) {
      parts.push(`[SKILL REVIEW] You've made ${iters} tool calls since the last skill review. Preserve useful learning without creating one-session clutter: first patch a loaded skill, then an existing class-level umbrella, then add a support file. Create a new class-level skill only if none fits. If there is genuinely nothing reusable, call SkillManage(action: "review", review_reason: "nothing reusable to save") so work can continue without manufacturing a skill.`);
      this.itersSinceSkill = 0;
      this.lastNudgeAt = 0;
    }
    if (parts.length === 0) return CONTINUE;
    const [seq, ok] = budget.tryClaim(session, META_NUDGE_SKILL_REVIEW);
    if (!ok) return CONTINUE;
    return { message: wrapReminder(this.name, "review", seq, parts.join("\n\n")) };
  }
};
var AutogenBudgetEnforcementHook = class {
  constructor(trigger = SWARM_TUI_AUTOGEN_TRIGGER) {
    this.trigger = trigger;
  }
  trigger;
  name = AUTOGEN_BUDGET_HOOK;
  toolCalls = 0;
  skilled = false;
  nudgeIgnores = 0;
  taskEverFocused = false;
  source() {
    return globalThis[AUTOGEN_BUDGET_SOURCE];
  }
  exempt(event) {
    const n = event.toolName;
    if (isSkillTool(n) || isTaskManagementTool(n) || isPlanModeTool(n) || isUserInteractionTool(n) || isCodeModeTool(n) || isReadOnlyExplorationTool(n)) return true;
    return false;
  }
  onToolBefore(event, tasks, budget, session) {
    const source = this.source();
    if (!event.toolName) return CONTINUE;
    if (source) {
      const decision = source.gateTool(event.toolName, event.params);
      if (!decision?.block) return CONTINUE;
      const state2 = source.budgetStatus();
      return { block: true, message: wrapReminder(this.name, "block", nextReminderSeq(this.name), this.blockMessage(state2.used, state2.budget, decision.reason)) };
    }
    if (this.exempt(event)) return CONTINUE;
    if (!this.taskEverFocused) {
      if (hasFocusedTask(tasks)) this.taskEverFocused = true;
      else return CONTINUE;
    }
    const state = source?.budgetStatus();
    const limit = state?.budget ?? (this.skilled ? this.trigger.workingBudget : this.trigger.toolCallBudget);
    const used = state?.used ?? this.toolCalls;
    if (used >= limit) return { block: true, message: wrapReminder(this.name, "block", nextReminderSeq(this.name), this.blockMessage(used, limit)) };
    if (!source) this.toolCalls++;
    return CONTINUE;
  }
  onToolAfter(event) {
    if (!invocationTool(event.toolName) || event.failed) return;
    this.toolCalls = 0;
    this.nudgeIgnores = 0;
    this.skilled = true;
  }
  blockMessage(used, limit, reason) {
    return `[SKILL BUDGET ENFORCEMENT \u2014 BLOCKED]

This tool did not run. ${used >= limit ? `Skill budget exhausted (${used}/${limit} non-exempt calls).` : `Skill review required (${used}/${limit} non-exempt calls).`}
${reason ? `Gate reason: ${reason}
` : ""}
Don't give up or stop the task because of this block. First call Skill with {"skill":"<relevant available skill>"} and follow its instructions; then retry the blocked work. Only a successful Skill invocation refills the budget.
SkillManage list/view/review/create/patch manages the library; it does not refill the budget. A no-mutation review satisfies a review reminder, not this block.
If you don't know which skill fits, inspect with SkillManage(action:"list"). If none fits but you have a genuinely reusable workflow, create it with SkillManage(action:"create", ...), then invoke the new skill with Skill and continue. Don't create filler just to bypass this gate; only if no legitimate reusable skill is possible should you explain the blocker and ask the user. Task, read, and interaction tools may remain available.`;
  }
};
var blockedByHookText = (toolName2, reason) => `Tool '${toolName2}' blocked by hook: ${reason}`;
function dedupeByLeadingLine(parts) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const p of parts) {
    const head = p.split("\n", 1)[0];
    if (seen.has(head)) continue;
    seen.add(head);
    out.push(p);
  }
  return out;
}
var PLAN_MODE_FIRST_TOOL_HOOK = "plan-mode-first-tool-hook";
var SIMULATION_HOOK = "simulation";
var TASK_NUDGE_TEXT = "[Task Nudge] Multi-step work detected with no active tasks \u2014 consider TaskManage.";
function promptSuggestsImmediateExecution(prompt) {
  const trimmed2 = prompt.trim();
  if (trimmed2 === "") return false;
  const lower = trimmed2.toLowerCase();
  for (const c of ["continue", "keep going", "go ahead", "proceed", "resume", "carry on"]) {
    if (lower === c || lower.startsWith(`${c} `) || lower.startsWith(`${c},`)) return true;
  }
  if (Buffer.byteLength(trimmed2) < 100) {
    const imperatives = [
      "run ",
      "just run ",
      "please run ",
      "go run ",
      "show ",
      "show me ",
      "print ",
      "cat ",
      "ls ",
      "echo ",
      "check ",
      "verify ",
      "confirm ",
      "merge ",
      "pull ",
      "push ",
      "commit ",
      "rebase ",
      "fetch ",
      "fix this ",
      "fix it",
      "undo ",
      "revert ",
      "open ",
      "build ",
      "test ",
      "deploy ",
      "restart "
    ];
    for (const im of imperatives) if (lower.startsWith(im)) return true;
  }
  return false;
}
var TaskNudgeBudget = class {
  interval;
  threshold;
  states = /* @__PURE__ */ new Map();
  constructor(config = {}) {
    this.interval = config.nudgeInterval || 5;
    this.threshold = config.toolCallThreshold || 2;
  }
  state(session) {
    let s = this.states.get(session);
    if (!s) {
      s = { turns: 0, toolCalls: 0, lastNudge: 0 };
      this.states.set(session, s);
    }
    return s;
  }
  /** HooksManager.EmitToolAfterExecute: every executed (not hook-blocked, not unknown) tool. */
  recordToolCall(session) {
    this.state(session).toolCalls++;
  }
  /** CheckTurn: advances the shared cadence clock, then maybe claims a nudge. */
  checkTurn(session, prompt, tasks, budget) {
    budget.recordUserTurn(session);
    const s = this.state(session);
    s.turns++;
    if (s.turns === 1 || s.toolCalls < this.threshold) return void 0;
    if (s.lastNudge !== 0 && s.turns - s.lastNudge < this.interval) return void 0;
    if (tasks.some((t) => !t.owner)) return void 0;
    if (promptSuggestsImmediateExecution(prompt)) return void 0;
    const [seq, ok] = budget.tryClaim(session, META_NUDGE_TASK);
    if (!ok) return void 0;
    s.lastNudge = s.turns;
    return wrapReminder("task-nudge", "nudge", seq, TASK_NUDGE_TEXT);
  }
};
var SwarmHookPipeline = class {
  constructor(options) {
    this.options = options;
    this.budget = options.budget ?? new MetaNudgeBudget();
    this.taskNudge = new TaskNudgeBudget(options.taskNudge);
  }
  options;
  budget;
  taskNudge;
  pendingToolMessages = [];
  turnParts = [];
  get session() {
    const s = this.options.session;
    return typeof s === "function" ? s() : s;
  }
  startSession(tasks) {
    this.hooks?.postActing?.startSession(tasks);
  }
  /**
   * EmitUserPromptSubmit: user hooks, then the built-in task-nudge
   * (CheckTurn advances the cadence clock once per prompt), then the pending
   * tool-time messages (last 3), deduped by leading line and "\n"-joined.
   * Headless `swarm -p` (cmd/swarmos/main.go) additionally emits
   * message.after_receive, whose executor advances the clock a second time;
   * the interactive TUI never emits that event.
   */
  onUserPrompt(options = {}) {
    if (options.messageAfterReceive !== false) this.budget.recordUserTurn(this.session);
    const parts = [];
    const nudge = this.taskNudge.checkTurn(this.session, options.prompt ?? "", this.options.tasks(), this.budget);
    if (nudge) parts.push(nudge);
    let pending = this.pendingToolMessages.splice(0);
    if (pending.length > 3) pending = pending.slice(pending.length - 3);
    const injected = dedupeByLeadingLine([...parts, ...pending]);
    return { injected: injected.join("\n") };
  }
  preTool(event) {
    const tasks = this.options.tasks();
    const parts = [];
    for (const hook of this.options.preHooks) {
      const result = hook.run(event, tasks, this.budget, this.session);
      if (result.block) return { block: blockedByHookText(event.toolName, result.message ?? ""), context: "" };
      if (result.message) {
        const wrapped = formatHookContext(hook.name, result.message);
        if (wrapped) {
          parts.push(wrapped);
          this.pendingToolMessages.push(result.message);
        }
      }
    }
    return { context: parts.join("\n\n") };
  }
  /** Returns the post-context for this call and remembers it for the turn message. */
  postTool(event) {
    const tasks = this.options.tasks();
    this.taskNudge.recordToolCall(this.session);
    const parts = [];
    for (const hook of this.options.postHooks) {
      const result = hook.run(event, tasks, this.budget, this.session);
      if (result.message) {
        const wrapped = formatHookContext(hook.name, result.message);
        if (wrapped) parts.push(wrapped);
      }
    }
    const context2 = parts.join("\n\n");
    if (context2) this.turnParts.push(context2);
    return context2;
  }
  /** agent_tools.go: one RoleUser message per assistant tool batch. */
  flushTurn() {
    const parts = this.turnParts.splice(0);
    return parts.join("\n\n");
  }
  /** agent_tools.go: prefix pre-context onto a successful result. */
  static applyPreContext(context2, output) {
    if (!context2) return output;
    return output !== "" ? `${context2}

---

${output}` : context2;
  }
};
function createSwarmBuiltinPipeline(options) {
  const enforcement = new TaskEnforcementHook(options.enforcementMode ?? "advise");
  const completion = new TaskCompletionEnforcementHook({
    ...options.completion,
    enabled: options.completion?.enabled !== false && options.enforcementMode !== "off"
  });
  const maintenance = new TaskMaintenanceReminderHook();
  const lifecycle = new AutogenLifecycleHook(options.trigger);
  const postActing = new PostActingHook();
  const budgetHook = new AutogenBudgetEnforcementHook(options.trigger);
  const isSub = options.isSubAgent ?? (() => false);
  const plan = options.planMode;
  const pre = [
    ...plan ? [{ name: PLAN_MODE_FIRST_TOOL_HOOK, run: (e) => {
      const m = plan.firstTool(e.toolName);
      return m ? { message: m } : CONTINUE;
    } }] : [],
    // 96
    { name: enforcement.name, run: (e, t, b, s) => enforcement.onToolBefore(e, t, b, s, isSub()) },
    // 95
    { name: completion.name, run: (e, t, b, s) => completion.onToolBefore(e, t, b, s) },
    // 94
    { name: budgetHook.name, run: (e, t, b, s) => budgetHook.onToolBefore(e, t, b, s) },
    // 90
    ...options.extraPre ?? []
    // 85, 84
  ];
  const post = [
    { name: lifecycle.name, run: (e, _t, b, s) => lifecycle.onToolAfter(e, b, s) },
    // 91
    { name: maintenance.name, run: (e, t, b, s) => maintenance.onToolAfter(e, t, b, s) },
    // 90
    { name: postActing.name, run: (e, t) => postActing.onToolAfter(e, t) },
    // 90
    { name: budgetHook.name, run: (e) => {
      budgetHook.onToolAfter(e);
      return CONTINUE;
    } },
    // 90 (refill only)
    ...options.extraPost ?? [],
    // 20
    // manager.go EmitToolAfterExecute appends the simulation result after every registered hook.
    ...plan ? [{ name: SIMULATION_HOOK, run: (e) => plan.planExitDetected(e.toolName) ? { message: plan.simulationMessage() } : CONTINUE }] : []
  ];
  const pipeline = new SwarmHookPipeline({ ...options, preHooks: pre, postHooks: post });
  pipeline.hooks = { enforcement, completion, maintenance, lifecycle, postActing, budgetHook };
  return pipeline;
}

// vendor/trebol/.pi/lib/policy/swarm-sleep-blocker.ts
var sleepCommandPattern = /(?:^|[\n;&|(`{])\s*(?:(?:do|then|else|!)\s+)*sleep\s/g;
var loopKeywordPattern = /\b(until|while|for)\b/;
var loopBodyPattern = /\bdo\b[\s\S]*\bdone\b/;
var leadingSleepChainPattern = /^\s*sleep\s+(\S+)\s*(?:&&|;)\s*(.+)$/;
var filePathPattern = /(?:^|\s)((?:\.{0,2}\/|~\/)?[\w./@-]*[\w]\/[\w./@-]+|\/[\w./@-]+|[\w.@-]+\.[\w]{1,8})/;
var allowedSleepPatterns = ["tlmgr", "pdflatex", "xelatex", "lualatex", "npm install", "pip install", "go mod tidy", "cargo build", "apt-get", "dnf install", "brew install"];
var isHeredocWordChar = (c) => /[A-Za-z0-9_]/.test(c);
function heredocOpeners(line) {
  const tags = [];
  for (let i = 0; i + 1 < line.length; i++) {
    if (line[i] !== "<" || line[i + 1] !== "<") continue;
    if (i + 2 < line.length && line[i + 2] === "<") {
      i += 2;
      continue;
    }
    if (i > 0 && line[i - 1] === "<") continue;
    let j = i + 2;
    const tag = { word: "", dash: false };
    if (j < line.length && line[j] === "-") {
      tag.dash = true;
      j++;
    }
    while (j < line.length && (line[j] === " " || line[j] === "	")) j++;
    if (j < line.length && line[j] === "\\") j++;
    if (j < line.length && (line[j] === "'" || line[j] === '"')) {
      const quote2 = line[j];
      j++;
      const start = j;
      while (j < line.length && line[j] !== quote2) j++;
      if (j >= line.length) break;
      tag.word = line.slice(start, j);
      j++;
    } else {
      const start = j;
      while (j < line.length && isHeredocWordChar(line[j])) j++;
      tag.word = line.slice(start, j);
    }
    if (tag.word === "") {
      i = j - 1;
      continue;
    }
    tags.push(tag);
    i = j - 1;
  }
  return tags;
}
function stripHeredocs(command) {
  if (!command.includes("<<")) return command;
  const lines = command.split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    kept.push(line);
    for (const tag of heredocOpeners(line)) {
      while (i + 1 < lines.length) {
        i++;
        let candidate = lines[i];
        if (tag.dash) candidate = candidate.replace(/^\t+/, "");
        if (candidate.replace(/[ \t\r]+$/, "") === tag.word) break;
      }
    }
  }
  return kept.join("\n");
}
function isAllowedSleepCommand(command, env = process.env) {
  const cmd = command.toLowerCase();
  for (const pattern of allowedSleepPatterns) if (cmd.includes(pattern.toLowerCase())) return true;
  return env.SWARM_ALLOW_SLEEP === "1";
}
var isPollingLoop = (command) => loopKeywordPattern.test(command) && loopBodyPattern.test(command);
function isBackgroundedSleepClause(rest) {
  for (let i = 0; i < rest.length; i++) {
    switch (rest[i]) {
      case ";":
      case "\n":
        return false;
      case "&":
        if (i + 1 < rest.length && rest[i + 1] === "&") return false;
        if (i > 0 && rest[i - 1] === ">") continue;
        return true;
    }
  }
  return false;
}
function allSleepInvocationsBackgrounded(scanned) {
  const matches = [...scanned.matchAll(sleepCommandPattern)];
  if (matches.length === 0) return false;
  for (const m of matches) if (!isBackgroundedSleepClause(scanned.slice((m.index ?? 0) + m[0].length))) return false;
  return true;
}
function firstFilePath(cmd) {
  const m = filePathPattern.exec(cmd);
  return m ? m[1].trim() : "";
}
function deriveUntilRewrite(command) {
  const m = leadingSleepChainPattern.exec(command);
  if (!m) return "";
  const chained = m[2].trim();
  if (chained === "") return "";
  const file = firstFilePath(chained);
  if (file !== "") return `until grep -q "SUCCESS\\|TIMEOUT\\|done" ${file}; do sleep 5; done && ${chained}`;
  return `until <check>; do sleep 5; done && ${chained}`;
}
function buildBlockMessage(command) {
  const rewrite = deriveUntilRewrite(command);
  if (rewrite !== "") {
    return `Blocked: a bare sleep can't wait for a condition. To wait until something is ready, poll with an until-loop instead. Replace this command with:

  ${rewrite}

(Adjust the marker/condition and the trailing command for your case. To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block \u2014 set timeout_seconds on the Bash call if you only need a hard cap.)`;
  }
  return "Blocked: a bare sleep can't wait for a condition. Use one of these instead:\n\n  - Poll until a condition holds:  until <check>; do sleep 5; done && <next-command>\n  - Wait for a command you started: run_in_background: true, then read its output when notified.\n  - Just need a hard cap on a single command? Set timeout_seconds on the Bash call.\n\nDo not chain shorter sleeps to work around this block.";
}
function sleepBlockReason(command, env = process.env) {
  if (!command) return void 0;
  const scanned = stripHeredocs(command);
  sleepCommandPattern.lastIndex = 0;
  if (!new RegExp(sleepCommandPattern.source).test(scanned)) return void 0;
  if (isAllowedSleepCommand(scanned, env)) return void 0;
  if (isPollingLoop(scanned)) return void 0;
  if (allSleepInvocationsBackgrounded(scanned)) return void 0;
  return buildBlockMessage(command);
}

// vendor/trebol/.pi/lib/runtime/swarm-stdin-conflict.ts
var STDIN_CONFLICT_HOOK_NAME = "stdin-conflict-advisory";
var MAX_STDIN_CONFLICT_ADVISORIES = 3;
var isShellSpace = (c) => c === " " || c === "	" || c === "\r" || c === "\n";
var isDelimTerminator = (c) => [" ", "	", "\n", ";", "|", "&", "<", ">", "(", ")"].includes(c);
function skipSingleQuoted(s, i) {
  for (let j = i + 1; j < s.length; j++) if (s[j] === "'") return j;
  return -1;
}
function skipDoubleQuoted(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === '"') return j;
  }
  return -1;
}
function skipBackquoted(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === "`") return j;
  }
  return -1;
}
function parseHeredocDelim(s, i) {
  const n = s.length;
  let j = i + 2;
  const d = { word: "", stripTabs: false };
  if (j < n && s[j] === "-") {
    d.stripTabs = true;
    j++;
  }
  while (j < n && (s[j] === " " || s[j] === "	")) j++;
  if (j >= n) return [d, j, false];
  let word = "";
  while (j < n) {
    const c = s[j];
    if (c === "'") {
      const k = skipSingleQuoted(s, j);
      if (k < 0) return [d, j, false];
      word += s.slice(j + 1, k).join("");
      j = k + 1;
    } else if (c === '"') {
      const k = skipDoubleQuoted(s, j);
      if (k < 0) return [d, j, false];
      word += s.slice(j + 1, k).join("");
      j = k + 1;
    } else if (c === "\\") {
      if (j + 1 >= n) return [d, j, false];
      word += s[j + 1];
      j += 2;
    } else if (isDelimTerminator(c)) {
      d.word = word;
      return [d, j, d.word !== ""];
    } else {
      word += c;
      j++;
    }
  }
  d.word = word;
  return [d, j, d.word !== ""];
}
function consumeHeredocBodies(s, start, delims) {
  const n = s.length;
  let pos = start;
  for (const d of delims) {
    while (pos <= n) {
      let lineEnd = pos;
      while (lineEnd < n && s[lineEnd] !== "\n") lineEnd++;
      let line = s.slice(pos, lineEnd).join("");
      if (d.stripTabs) line = line.replace(/^\t+/, "");
      if (line.replace(/\r+$/, "") === d.word) {
        pos = lineEnd;
        if (pos < n) pos++;
        break;
      }
      if (lineEnd >= n) return n;
      pos = lineEnd + 1;
    }
  }
  return pos;
}
function hasPipeHeredocStdinConflict(command) {
  if (command === "") return false;
  if (!command.includes("|") || !command.includes("<<")) return false;
  const s = [...command];
  const n = s.length;
  let depth = 0;
  let pipedSegment = false;
  let segHasContent = false;
  let pendingHeredocs = [];
  for (let i = 0; i < n; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      segHasContent = true;
    } else if (c === "'") {
      const j = skipSingleQuoted(s, i);
      if (j < 0) return false;
      i = j;
      segHasContent = true;
    } else if (c === '"') {
      const j = skipDoubleQuoted(s, i);
      if (j < 0) return false;
      i = j;
      segHasContent = true;
    } else if (c === "`") {
      const j = skipBackquoted(s, i);
      if (j < 0) return false;
      i = j;
      segHasContent = true;
    } else if (c === "$" && i + 1 < n && s[i + 1] === "(") {
      depth++;
      i++;
      segHasContent = true;
    } else if (c === "(" && depth > 0) {
      depth++;
      segHasContent = true;
    } else if (c === ")" && depth > 0) {
      depth--;
      segHasContent = true;
    } else if (depth > 0) {
      if (!isShellSpace(c)) segHasContent = true;
    } else if (c === "\n") {
      if (pendingHeredocs.length > 0) {
        i = consumeHeredocBodies(s, i + 1, pendingHeredocs) - 1;
        pendingHeredocs = [];
      }
      if (segHasContent) {
        pipedSegment = false;
        segHasContent = false;
      }
    } else if (c === "<") {
      if (i + 2 < n && s[i + 1] === "<" && s[i + 2] === "<") {
        i += 2;
        segHasContent = true;
        continue;
      }
      if (i + 1 < n && s[i + 1] === "<") {
        const [delim, next, ok] = parseHeredocDelim(s, i);
        if (!ok) return false;
        if (pipedSegment) return true;
        pendingHeredocs.push(delim);
        i = next - 1;
        segHasContent = true;
        continue;
      }
      segHasContent = true;
    } else if (c === "|") {
      if (i + 1 < n && s[i + 1] === "|") {
        i++;
        pipedSegment = false;
        segHasContent = false;
        continue;
      }
      pipedSegment = true;
      segHasContent = false;
    } else if (c === "&") {
      if (i + 1 < n && s[i + 1] === "&") i++;
      pipedSegment = false;
      segHasContent = false;
    } else if (c === ";") {
      pipedSegment = false;
      segHasContent = false;
    } else if (!isShellSpace(c)) segHasContent = true;
  }
  return false;
}
var stdinConflictAdvisoryMessage = () => "[stdin conflict] This command gives the same command two stdin sources: a pipe on the left and a heredoc on the right. Bash applies the last redirection and silently discards the other input, which usually fails in a confusing way.\n\nIf you meant to send the piped data, drop the heredoc. If you meant to send the heredoc, drop the pipe (e.g. inline the data, or use `ssh host 'cmd' < file`). Running as-is \u2014 this is advice, not a block.";
var stdinConflictBlockMessage = () => "[stdin conflict] Refusing to run: this command gives the same command two stdin sources, a pipe on the left and a heredoc on the right. Bash applies the last redirection and silently discards the other input, so this would return plausible output that is missing half its input.\n\nFix one of the two: if you meant to send the piped data, drop the heredoc; if you meant to send the heredoc, drop the pipe (e.g. inline the data, or use `ssh host 'cmd' < file`). Then run the command again.";
var stdinConflictModeFromEnv = (env = process.env) => (env.SWARM_STDIN_CONFLICT_MODE ?? "").trim().toLowerCase() === "block" ? "block" : "advise";
var StdinConflictHook = class {
  constructor(mode = stdinConflictModeFromEnv()) {
    this.mode = mode;
  }
  mode;
  advisoryCount = 0;
  /** Returns { block } or { advise } or undefined to continue silently. */
  onBashCommand(command) {
    if (!command || !hasPipeHeredocStdinConflict(command)) return void 0;
    if (this.mode === "block") return { block: stdinConflictBlockMessage() };
    if (++this.advisoryCount > MAX_STDIN_CONFLICT_ADVISORIES) return void 0;
    return { advise: stdinConflictAdvisoryMessage() };
  }
};

// vendor/trebol/.pi/lib/runtime/task-gate-resume.ts
var TASK_GATE_CONTINUE_LIMIT = 2;
var BLOCKED_BY_HOOK_PREFIX = "blocked by hook:";
var TASK_GATE_BLOCK_MARKER = "[TASK ENFORCEMENT - BLOCKED]";
var TASK_GATE_BLOCK_HEADLINE = "YOU CANNOT EXECUTE ANY TOOL WITHOUT A TASK";
var TASK_GATE_CONTINUE_TYPE = "swarm-task-gate-auto-continue";
var TASK_GATE_SPENT_TYPE = "swarm-task-gate-auto-continue-spent";
var TASK_GATE_CONTINUE_SENTINEL = "TASK GATE \u2014 AUTO-CONTINUE";
function messageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}
function isTaskGateContinuationMessage(message) {
  return messageText(message?.content).includes(TASK_GATE_CONTINUE_SENTINEL);
}
function isTaskEnforcementBlockText(text3) {
  return text3.includes(BLOCKED_BY_HOOK_PREFIX) && text3.includes(TASK_GATE_BLOCK_MARKER) && text3.includes(TASK_GATE_BLOCK_HEADLINE);
}
function hasCompletedReport(messages) {
  return messages.some((m) => m?.role === "toolResult" && normalizeToolName(String(m?.toolName ?? "")) === "clawfinish" && m?.isError !== true);
}
var lastIndexOfRole = (messages, role) => {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === role) return i;
  return -1;
};
var currentRunStart = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "user") continue;
    if (isTaskGateContinuationMessage(message)) continue;
    return i;
  }
  return -1;
};
function classifyTaskGateStop(input2) {
  const { messages } = input2;
  if (input2.outcome !== void 0 && input2.outcome !== "completed") return { gate: false, reason: `outcome:${input2.outcome}` };
  if (input2.alreadyContinuing) return { gate: false, reason: "already-continuing" };
  if (input2.hasPendingMessages) return { gate: false, reason: "pending-input" };
  const assistantIndex = lastIndexOfRole(messages, "assistant");
  if (assistantIndex < 0) return { gate: false, reason: "no-assistant-message" };
  const stopReason = messages[assistantIndex]?.stopReason;
  if (stopReason !== "stop") return { gate: false, reason: `stop-reason:${String(stopReason)}` };
  const tail = messages.slice(currentRunStart(messages) + 1);
  if (hasCompletedReport(tail)) return { gate: false, reason: "completed-report" };
  const resultIndex = lastIndexOfRole(tail, "toolResult");
  if (resultIndex < 0) return { gate: false, reason: "no-tool-result" };
  const result = tail[resultIndex];
  if (!isTaskEnforcementBlockText(messageText(result?.content))) return { gate: false, reason: "last-tool-not-gate" };
  const after = tail.slice(resultIndex + 1);
  const furtherToolCall = after.some((m) => m?.role === "assistant" && Array.isArray(m?.content) && m.content.some((part) => part?.type === "toolCall"));
  if (furtherToolCall) return { gate: false, reason: "further-tool-call" };
  const toolName2 = String(result?.toolName ?? "tool");
  const toolCallId = String(result?.toolCallId ?? "");
  return { gate: true, block: { toolName: toolName2, toolCallId, key: `${toolCallId || `${toolName2}:${resultIndex}`}@${messages.length}` } };
}
var BUDGETS = /* @__PURE__ */ Symbol.for("pi-swarm-task-gate-resume-budgets");
var sharedBudgets = () => globalThis[BUDGETS] ??= /* @__PURE__ */ new Map();
var TaskGateResumeBudget = class {
  constructor(limit = TASK_GATE_CONTINUE_LIMIT, states) {
    this.limit = limit;
    this.states = states ?? sharedBudgets();
  }
  limit;
  states;
  state(session) {
    const key = session.trim() || "session";
    let state = this.states.get(key);
    if (!state) {
      state = { used: 0, lastKey: "", reported: false };
      this.states.set(key, state);
    }
    return state;
  }
  snapshot(session) {
    return { ...this.state(session), limit: this.limit };
  }
  /** Real progress: the block's precondition is gone (a task is focused) or a human intervened. */
  reset(session) {
    this.states.delete(session.trim() || "session");
  }
  claim(session, key) {
    const state = this.state(session);
    if (state.lastKey === key) return "duplicate";
    if (state.used >= this.limit) return "exhausted";
    state.used += 1;
    state.lastKey = key;
    return "continue";
  }
  /** True the first time this episode runs out of budget, so the notice is appended once, not every stop. */
  markReported(session) {
    const state = this.state(session);
    if (state.reported) return false;
    state.reported = true;
    return true;
  }
};
function taskGateContinueContent(block, used, limit) {
  return [
    `[TASK GATE \u2014 AUTO-CONTINUE ${used}/${limit}] Your turn ended immediately after the task-enforcement hook blocked \`${block.toolName}\`. That block is a correction, not a stop condition. Continue this same run now on one of these authorized paths:`,
    `1. Create a task and focus it: TaskManage {operations:[{op:"create", subject:"<specific work item>", questions:[{id:"q1",text:"<what must be true when done>"}]}]} then TaskManage {operations:[{op:"update", taskId:"<id>", status:"in_progress", active:true}]}.`,
    `2. Or focus the task you already have: TaskManage {operations:[{op:"update", taskId:"<id>", status:"in_progress", active:true}]}.`,
    `3. Or stay on a path the gate already exempts: TaskManage list/get, read-only tools and read-only Bash commands, Skill, plan-mode tools, ask_user_question.`,
    `Claw workers: claw_finish is allowed once any task is completed.`,
    `Do not replay the blocked call before a task is focused, and do not end the turn with a needs_user report unless the task list itself shows a real blocker. Auto-continue ${used} of ${limit} for this session.`
  ].join("\n");
}
function taskGateSpentContent(block, limit) {
  return [
    `[TASK GATE \u2014 AUTO-CONTINUE BUDGET SPENT] The task-enforcement hook blocked \`${block.toolName}\` (call ${block.toolCallId || "unknown"}) and the turn stopped there again. The auto-continue budget for this session is spent (${limit} of ${limit} used), so no further continue was injected.`,
    `The gate still stands: create a TaskManage task and mark it in_progress with active:true, focus the existing one, or finish on the exempt paths (TaskManage list/get, read-only tools and Bash, Skill, plan mode, ask_user_question). Claw worker: claw_finish is allowed once a task is completed.`,
    `If the task list cannot satisfy the gate, this is a genuine blocker: say which one and stop. Otherwise a human has to send continue.`
  ].join("\n");
}
function evaluateTaskGateResume(input2) {
  const budget = input2.budget ?? new TaskGateResumeBudget();
  if (input2.taskFocused) {
    budget.reset(input2.session);
    return { action: "none", reason: "task-focused" };
  }
  const verdict = classifyTaskGateStop(input2);
  if ("reason" in verdict) return { action: "none", reason: verdict.reason };
  const block = verdict.block;
  const claim = budget.claim(input2.session, block.key);
  if (claim === "duplicate") return { action: "none", reason: "duplicate", block };
  if (claim === "exhausted") {
    if (!budget.markReported(input2.session)) return { action: "none", reason: "exhausted-reported", block };
    return {
      action: "exhausted",
      reason: "budget-spent",
      block,
      content: taskGateSpentContent(block, budget.limit),
      customType: TASK_GATE_SPENT_TYPE,
      used: budget.limit,
      limit: budget.limit
    };
  }
  const { used } = budget.snapshot(input2.session);
  return {
    action: "continue",
    reason: "gate-blocked-tool",
    block,
    content: taskGateContinueContent(block, used, budget.limit),
    customType: TASK_GATE_CONTINUE_TYPE,
    used,
    limit: budget.limit
  };
}

// vendor/trebol/.pi/lib/runtime/work-registration.ts
var WORK_REGISTRATION_HOOK = "work-registration-hook";
var INJECTED = /^\s*(?:<(?:task-notification|cross-session-message|system-reminder|local-command-stdout|local-command-stderr|bash-stdout|bash-stderr|user-prompt-submit-hook)\b|\[SYSTEM NOTIFICATION)/i;
var ACKNOWLEDGEMENT = /^(?:ok(?:ay)?|k|yes|yep|yeah|sure|thanks?(?: you)?|thx|ty|great|nice|cool|perfect|good|got it|continue|keep going|carry on|go on|proceed|resume)[\s.!,]*$/i;
function isUserAuthoredPrompt(prompt) {
  const text3 = prompt.trim();
  return text3 !== "" && !INJECTED.test(text3);
}
var isAcknowledgement = (prompt) => ACKNOWLEDGEMENT.test(prompt.trim());
function isActingCall(toolName2, params, hostReadOnly = false) {
  if (!toolName2 || hostReadOnly) return false;
  if (isTaskManagementTool(toolName2) || isPlanModeTool(toolName2) || isUserInteractionTool(toolName2) || isSkillTool(toolName2) || isCodeModeTool(toolName2)) return false;
  if (isReadOnlyExplorationTool(toolName2) || isReadOnlyDomainTool(toolName2) || isReadOnlyMemoryCall(toolName2, params) || isReadOnlyVaultCall(toolName2, params)) return false;
  if (isBashTool(toolName2)) {
    const command = params?.command;
    if (typeof command === "string" && isBashReadOnly(command)) return false;
  }
  return true;
}
var quote = (subject) => `"${subject.length > 80 ? `${subject.slice(0, 77)}\u2026` : subject}"`;
var focusedOf = (tasks) => tasks.find((t) => t.status === "in_progress" && t.active === true && !t.owner);
var openOf = (tasks) => tasks.filter((t) => (t.status === "pending" || t.status === "in_progress") && !t.owner);
var WorkRegistrationPolicy = class {
  turn = 0;
  settledTurn = -1;
  actingSinceTaskUpdate = 0;
  actingThisTurn = 0;
  taskToolThisTurn = false;
  reconcileThreshold;
  registerThreshold;
  constructor(config = {}) {
    this.reconcileThreshold = Math.max(1, config.reconcileThreshold ?? 2);
    this.registerThreshold = Math.max(1, config.registerThreshold ?? 2);
  }
  /**
   * Any prompt opens a turn (for the settle check); only a message the user wrote gets the registration line.
   * Returns the line to add to the model's context, or undefined.
   */
  onUserPrompt(prompt, tasks) {
    this.turn++;
    this.actingThisTurn = 0;
    this.taskToolThisTurn = false;
    if (!isUserAuthoredPrompt(prompt)) return void 0;
    const focus = focusedOf(tasks);
    if (focus) {
      if (isAcknowledgement(prompt)) return void 0;
      return `[Work registration] New user message while task #${focus.id} ${quote(focus.subject)} is active. If it asks for more of the same goal, keep going (a distinct deliverable gets a child task with parentTaskId="${focus.id}", filed as a sub-issue). If it asks for anything else, create a new task for it with status "in_progress" and active=true before acting. Do not fold a new request into #${focus.id}.`;
    }
    const open = openOf(tasks);
    if (open.length) {
      const list = open.slice(0, 3).map((t) => `#${t.id} ${quote(t.subject)}`).join(", ");
      return `[Work registration] New user message. Open tasks: ${list}${open.length > 3 ? ", \u2026" : ""}; none is active. Before acting, set the one this message continues to in_progress with active=true, or create a new task for new work.`;
    }
    if (isAcknowledgement(prompt)) return void 0;
    return '[Work registration] New user message. If answering it needs more than read-only lookups, create a TaskManage task for it (status "in_progress", active=true) before acting. Give each separate deliverable its own child task (parentTaskId) so it is tracked on its own.';
  }
  /** Record one finished tool call. `taskManageSucceeded` is true for a TaskManage batch that succeeded. */
  onToolResult(event) {
    if (isTaskManagementTool(event.toolName)) {
      if (event.taskManageSucceeded !== false && !event.failed) {
        this.actingSinceTaskUpdate = 0;
        this.taskToolThisTurn = true;
      }
      return;
    }
    if (!isActingCall(event.toolName, event.params, event.hostReadOnly)) return;
    this.actingSinceTaskUpdate++;
    this.actingThisTurn++;
  }
  /**
   * The agent is about to end its turn. Returns a continuation instruction at most once per turn, or undefined.
   * The caller delivers it the way its host continues a turn (Pi agent_before_settle, Claude Code Stop).
   */
  onSettle(tasks) {
    if (this.turn === 0 || this.settledTurn === this.turn) return void 0;
    const focus = focusedOf(tasks);
    if (focus && this.actingThisTurn > 0 && this.actingSinceTaskUpdate >= this.reconcileThreshold) {
      this.settledTurn = this.turn;
      return `[Work registration] Before you end this reply, reconcile task #${focus.id} ${quote(focus.subject)} (${this.actingSinceTaskUpdate} acting tool call${this.actingSinceTaskUpdate === 1 ? "" : "s"} since its last update). If its acceptance criteria are verified, update it to status "completed" with answers and evidence. If not, keep it in_progress and add a note (addNote) saying what is done and what is left. If this reply also did work outside it, register that as its own task. Then finish your reply; the user should not have to ask for this.`;
    }
    if (!focus && !this.taskToolThisTurn && this.actingThisTurn >= this.registerThreshold) {
      this.settledTurn = this.turn;
      return `[Work registration] This reply made ${this.actingThisTurn} acting tool calls without a task, so the work is not tracked. Create a task for what you did now (one TaskManage batch: create it, then update it to "completed" with answers and evidence, or leave it in_progress with a note if work remains). Then finish your reply.`;
    }
    return void 0;
  }
  /** Visible for tests and diagnostics. */
  state() {
    return { turn: this.turn, settledTurn: this.settledTurn, actingSinceTaskUpdate: this.actingSinceTaskUpdate, actingThisTurn: this.actingThisTurn, taskToolThisTurn: this.taskToolThisTurn };
  }
};

// src/agy.ts
var BUILTINS = {
  run_command: { name: "Bash", args: (a) => ({ ...a, command: a.CommandLine ?? a.command }) },
  read_file: { name: "Read", args: (a) => ({ ...a, file_path: a.Path ?? a.AbsolutePath }) },
  view_file: { name: "Read", args: (a) => ({ ...a, file_path: a.Path ?? a.AbsolutePath }) },
  list_dir: { name: "LS", args: (a) => ({ ...a, path: a.Path ?? a.DirectoryPath }) },
  list_directory: { name: "LS", args: (a) => ({ ...a, path: a.Path ?? a.DirectoryPath }) },
  grep_search: { name: "Grep", args: (a) => ({ ...a, pattern: a.Query ?? a.Pattern }) },
  find_by_name: { name: "Glob", args: (a) => ({ ...a, pattern: a.Pattern ?? a.Name }) },
  glob: { name: "Glob" },
  code_search: { name: "CodeSearch" },
  search_web: { name: "WebSearch", args: (a) => ({ ...a, query: a.Query ?? a.query }) },
  read_url_content: { name: "WebFetch", args: (a) => ({ ...a, url: a.Url ?? a.url }) },
  tool_search: { name: "ToolSearch" },
  write_file: { name: "Write", args: (a) => ({ ...a, file_path: a.Path ?? a.TargetFile, content: a.Content }) },
  edit_file: { name: "Edit", args: (a) => ({ ...a, file_path: a.Path ?? a.TargetFile }) },
  replace_file_content: { name: "Edit", args: (a) => ({ ...a, file_path: a.Path ?? a.TargetFile }) },
  multi_replace_file_content: { name: "MultiEdit", args: (a) => ({ ...a, file_path: a.Path ?? a.TargetFile }) },
  apply_patch: { name: "Edit" }
};
var AGY_READ_ONLY = ["command_status", "read_terminal", "view_code_item", "ask_question", "notify_user", "task_boundary", "read_resource", "list_resources"];
function agyToolCall(call) {
  const name = String(call?.name ?? "");
  const args = call?.args && typeof call.args === "object" ? call.args : {};
  const id = typeof call?.id === "string" ? call.id : void 0;
  if (name === "call_mcp_tool") {
    const server = String(args.ServerName ?? "");
    const tool = String(args.ToolName ?? "");
    const input2 = args.Arguments && typeof args.Arguments === "object" ? args.Arguments : typeof args.Arguments === "string" ? safeJson(args.Arguments) : {};
    return { tool_name: `mcp__${server}__${tool}`, tool_input: input2, tool_use_id: id };
  }
  const builtin = BUILTINS[name];
  if (!builtin) return { tool_name: name, tool_input: args, tool_use_id: id };
  return { tool_name: builtin.name, tool_input: builtin.args ? builtin.args(args) : args, tool_use_id: id };
}
var safeJson = (s) => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
var transcriptFromArtifacts = (artifactsDir) => `${artifactsDir.replace(/\/+$/, "")}/.system_generated/logs/transcript_full.jsonl`;

// src/host-policy.ts
var bare = (name) => name.replace(/^mcp__[A-Za-z0-9_-]+__/, "");
var policyName = (name) => bare(name).replace(/_/g, "").toLowerCase();
var READ_ONLY_HOST_TOOLS = [
  // this plugin's own tools (Trebol already allows hoja_list/hoja_get; hoja_project is action-gated below)
  "hoja_list",
  "hoja_get",
  "hoja_setup",
  // identity, workspace, teams
  "hoja_viewer",
  "hoja_workspace",
  "hoja_organizationMembers",
  "hoja_teams",
  "hoja_team",
  // issues and tasks
  "hoja_issues",
  "hoja_issue",
  "hoja_searchIssues",
  "hoja_myIssueActivity",
  "hoja_tasks",
  "hoja_task",
  "hoja_searchTasks",
  "hoja_myTaskActivity",
  // projects, initiatives, cycles, workflow states, labels
  "hoja_projects",
  "hoja_projectUpdates",
  "hoja_initiatives",
  "hoja_initiative",
  "hoja_cycles",
  "hoja_cycle",
  "hoja_teamCycleCadence",
  "hoja_workflowStates",
  "hoja_issueLabels",
  "hoja_taskLabels",
  // decisions (read) and inbox
  "hoja_issueDecisions",
  "hoja_issueDecision",
  "hoja_taskDecisions",
  "hoja_taskDecision",
  "hoja_inboxNotifications",
  "hoja_inboxUnreadCount",
  // extension action catalogue (running one is hoja_extensionActionRun and stays gated)
  "hoja_extensionActions",
  // Antigravity built-ins that only read a terminal or a resource, or only talk to the user (agy.ts AGY_READ_ONLY)
  ...AGY_READ_ONLY
];
var READ_ONLY_HOST = new Set(READ_ONLY_HOST_TOOLS.map(policyName));
var isAdapterReadOnlyTool = (toolName2, params) => {
  const name = policyName(toolName2);
  if (name === "hojaproject") {
    const action = params?.action;
    return action == null || action === "list";
  }
  if (name === "hojatrace") return params?.action !== "upload";
  return READ_ONLY_HOST.has(name);
};
var stripFdRedirections = (command) => command.replace(/(?:^|(?<=[\s;|&]))(\d*|&)>>?\s*&(?:(\d+)|-)/g, " ").replace(/(?:^|(?<=[\s;|&]))(\d*|&)>>?\s*\/dev\/null/g, " ").replace(/[ \t]{2,}/g, " ").trim();
var bashReadOnlyCommand = (command) => stripFdRedirections(command).trim().replace(/\s+$/, "");
var normalizeCommandName = (raw) => String(raw ?? "").trim().toLowerCase().replace(/^\//, "").replace(/^plugin:[a-z0-9_-]+:/, "").replace(/^[a-z0-9_-]+:/, "");
var LOCAL_COMMAND = /^\s*\/?hoja:([a-z][\w-]*)(?:\s+([\s\S]*))?$/i;
var localCommandOf = (prompt) => {
  const match = LOCAL_COMMAND.exec(prompt);
  return match ? { name: match[1].toLowerCase(), args: match[2]?.trim() ?? "" } : void 0;
};

// src/hook-bridge.ts
var HOST_SCHEMA_LOADERS = /* @__PURE__ */ new Set(["ToolSearch"]);
var parse = (value) => {
  if (typeof value !== "string") return value;
  const trimmed2 = value.trim();
  if (!trimmed2 || !/^[\[{"]/.test(trimmed2)) return value;
  try {
    return JSON.parse(trimmed2);
  } catch {
    return value;
  }
};
function responseText(response) {
  const value = parse(response);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((part) => typeof part === "string" ? part : part?.type === "text" ? String(part.text ?? "") : "").filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const v = value;
    if (typeof v.stdout === "string" || typeof v.stderr === "string") return [v.stdout, v.stderr].filter((s) => typeof s === "string" && s).join("\n");
    if (Array.isArray(v.content)) return responseText(v.content);
    if (typeof v.output === "string") return v.output;
    return JSON.stringify(value);
  }
  return value == null ? "" : String(value);
}
var HookBridge = class {
  constructor(shim2, manager, options = {}) {
    this.shim = shim2;
    this.manager = manager;
    const stdinConflict = new StdinConflictHook();
    const bashPre = (name, decide) => ({
      name,
      run: (event) => {
        if (event.toolName !== "bash" && event.toolName !== "Bash") return {};
        const r = decide(event.params?.command);
        if (!r) return {};
        return r.block ? { block: true, message: r.block } : { message: r.message };
      }
    });
    const mode = options.enforcementMode ?? "block";
    this.headless = options.headless ?? false;
    this.recorder = options.recorder;
    this.host = options.host ?? hostOf();
    if (!options.autogenSkills && !globalThis[AUTOGEN_BUDGET_SOURCE])
      globalThis[AUTOGEN_BUDGET_SOURCE] = { gateTool: () => void 0, budgetStatus: () => ({ used: 0, budget: Infinity }) };
    this.pipeline = createSwarmBuiltinPipeline({
      session: () => this.shim.sessionId || "session",
      tasks: () => this.tasks(),
      isSubAgent: () => this.subagent || process.env.PI_SWARM_SUBAGENT === "1",
      enforcementMode: mode,
      completion: { enabled: mode !== "off", toolThreshold: 8, maxNudges: 3 },
      extraPre: [
        bashPre("sleep-blocker", (command) => {
          const reason = sleepBlockReason(command);
          return reason ? { block: reason } : void 0;
        }),
        bashPre(STDIN_CONFLICT_HOOK_NAME, (command) => {
          const c = stdinConflict.onBashCommand(command);
          if (!c) return void 0;
          return "block" in c ? { block: c.block } : { message: c.advise };
        })
      ],
      extraPost: []
    });
    if (!options.autogenSkills) this.pipeline.hooks.lifecycle.onToolAfter = () => ({});
  }
  shim;
  manager;
  pipeline;
  gateResume = new TaskGateResumeBudget();
  /** Every user request registered and reconciled before the turn ends (vendored work-registration.ts, HOJA-757). */
  registration = new WorkRegistrationPolicy();
  subagent = false;
  startedPostActingSession = "";
  pendingToolCallIds = /* @__PURE__ */ new Map();
  headless;
  recorder;
  host;
  /** Antigravity: a PreToolUse answer cannot carry context, so a nudge waits for the next model call. */
  deferred = [];
  /** Codex: PreToolUse calls not yet settled by PostToolUse, so the turn flushes once per tool batch. */
  inFlight = /* @__PURE__ */ new Set();
  /** Tasks as the Swarm hooks see them (swarm-builtin-hooks-runtime.ts hookTasks). */
  tasks() {
    return this.manager.snapshot().tasks.filter((t) => t.status !== "deleted").map((t) => ({
      id: String(t.id),
      subject: String(t.subject ?? ""),
      status: String(t.status ?? ""),
      active: t.active === true,
      category: t.category,
      owner: t.owner_id,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : []
    }));
  }
  /** The tool_use_id of the PreToolUse that preceded an MCP call to one of our own tools (FIFO per tool). */
  takeToolCallId(tool) {
    return this.pendingToolCallIds.get(tool)?.shift();
  }
  async bind(payload) {
    if (typeof payload.session_id === "string" && payload.session_id)
      await this.shim.bindSession(payload.session_id, payload.transcript_path || void 0, payload.cwd || void 0);
    this.subagent = typeof payload.agent_id === "string" && payload.agent_id !== "";
  }
  async handle(event, input2) {
    const payload = Object.fromEntries(Object.entries(input2).filter(([, v]) => v != null && !(typeof v === "string" && /^\$\{[\w.]+\}$/.test(v))));
    await this.bind(payload);
    const output = await this.dispatch(event, payload);
    if (this.recorder) {
      const text3 = event === "PostToolUse" ? responseText(payload.tool_response) : event === "PostToolUseFailure" ? responseText(payload.error ?? payload.tool_response) : void 0;
      this.recorder.record(this.shim.sessionId, event, { ...payload, tool_input: parse(payload.tool_input) }, output, text3);
    }
    return output;
  }
  async dispatch(event, payload) {
    switch (event) {
      case "SessionStart":
        return {};
      case "SessionEnd":
        await this.shim.emit("session_shutdown");
        return {};
      case "UserPromptSubmit":
        return this.userPrompt(payload);
      case "UserPromptExpansion":
        return this.command(payload);
      case "PreToolUse":
        return this.preTool(payload);
      case "PostToolUse":
        return this.postTool(payload, false);
      case "PostToolUseFailure":
        return this.postTool(payload, true);
      case "PostToolBatch":
        return this.turnEnd();
      case "Stop":
        return this.stop(payload);
      // Observed for tracing only: SubagentStart/Stop, PreCompact/PostCompact, Notification, StopFailure,
      // PermissionDenied. None of them has a Trebol counterpart, so the answer is always "no change".
      default:
        return {};
    }
  }
  async userPrompt(payload) {
    const session = this.shim.sessionId || "session";
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    this.inFlight.clear();
    const local = localCommandOf(prompt);
    if (local && this.shim.commands.has(local.name)) return this.command({ command_name: local.name, command_args: local.args });
    this.gateResume.reset(session);
    await this.shim.emit("input", { text: prompt, source: this.headless ? "rpc" : "interactive" });
    await this.shim.emit("before_agent_start", { prompt, systemPrompt: "" });
    const hooks = this.pipeline.hooks;
    if (this.startedPostActingSession !== session) {
      this.startedPostActingSession = session;
      hooks.postActing?.startSession(this.tasks());
    }
    if (this.headless) {
      hooks.enforcement.onUserMessage(prompt);
      hooks.maintenance.onUserMessage(this.tasks(), this.pipeline.budget, session);
    }
    if (this.host !== "antigravity") this.pipeline.pendingToolMessages = [];
    const { injected } = this.pipeline.onUserPrompt({ messageAfterReceive: this.headless, prompt });
    const line = this.registration.onUserPrompt(prompt, this.tasks());
    const text3 = [injected, line].filter(Boolean).join("\n");
    return text3 ? context("UserPromptSubmit", formatHookContext("user_prompt_submit", text3)) : {};
  }
  async preTool(payload) {
    const raw = String(payload.tool_name ?? "");
    const toolName2 = canonicalToolName(raw);
    const params = parse(payload.tool_input) ?? {};
    const toolCallId = typeof payload.tool_use_id === "string" ? payload.tool_use_id : void 0;
    if (isOwnTool(raw) && toolCallId) this.pendingToolCallIds.set(toolName2, [...this.pendingToolCallIds.get(toolName2) ?? [], toolCallId]);
    await this.shim.emit("tool_call", { toolName: toolName2, toolCallId, input: params });
    if (HOST_SCHEMA_LOADERS.has(toolName2)) return {};
    if (isAdapterReadOnlyTool(toolName2, params)) {
      this.inFlight.add(toolCallId ?? `anon-${this.inFlight.size}`);
      return {};
    }
    const policy = toolName2 === "Bash" && typeof params?.command === "string" ? { ...params, command: bashReadOnlyCommand(params.command) } : params;
    const { block, context: pre } = this.pipeline.preTool({ toolName: toolName2, params: policy, toolCallId });
    if (block) {
      if (isOwnTool(raw)) this.takeToolCallId(toolName2);
      return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: block } };
    }
    this.inFlight.add(toolCallId ?? `anon-${this.inFlight.size}`);
    if (pre && this.host === "antigravity") {
      this.deferred.push(pre);
      return {};
    }
    return pre ? context("PreToolUse", pre) : {};
  }
  async postTool(payload, failed2) {
    const raw = String(payload.tool_name ?? "");
    const toolName2 = canonicalToolName(raw);
    const params = parse(payload.tool_input) ?? {};
    const toolCallId = typeof payload.tool_use_id === "string" ? payload.tool_use_id : void 0;
    const output = failed2 ? responseText(payload.error ?? payload.tool_response) : responseText(payload.tool_response);
    if (!isOwnTool(raw))
      await this.shim.emit("tool_result", { toolName: toolName2, toolCallId, input: params, content: [{ type: "text", text: output }], isError: failed2 });
    if (HOST_SCHEMA_LOADERS.has(toolName2)) return {};
    this.pipeline.postTool({ toolName: toolName2, params, toolCallId, failed: failed2, output });
    if (!this.subagent) this.registration.onToolResult({
      toolName: toolName2,
      params,
      failed: failed2,
      hostReadOnly: isAdapterReadOnlyTool(toolName2, params),
      taskManageSucceeded: !failed2 && !/^\s*(?:Error\b|\{"status":"failed")/.test(output)
    });
    if (this.host !== "codex") return {};
    if (toolCallId && this.inFlight.has(toolCallId)) this.inFlight.delete(toolCallId);
    else this.inFlight.delete(this.inFlight.values().next().value);
    return this.inFlight.size === 0 ? this.turnEnd("PostToolUse") : {};
  }
  async turnEnd(hookEventName = "PostToolBatch") {
    await this.shim.emit("turn_end");
    const content = [...this.deferred.splice(0), this.pipeline.flushTurn()].filter(Boolean).join("\n\n");
    return content ? context(hookEventName, content) : {};
  }
  async stop(payload) {
    if (this.subagent || process.env.PI_SWARM_SUBAGENT === "1") return {};
    await this.shim.emit("turn_end");
    await this.shim.emit("agent_settle");
    const session = this.shim.sessionId || "session";
    const messages = [...this.shim.transcript.messages()];
    const last = messages.at(-1);
    if (!(last?.role === "assistant" && last.stopReason === "stop"))
      messages.push({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: String(payload.last_assistant_message ?? "") }] });
    const decision = evaluateTaskGateResume({ session, messages, taskFocused: hasFocusedTask(this.tasks()), budget: this.gateResume });
    if (decision.action === "continue" && decision.content) return this.continueTurn(decision.content);
    if (decision.action === "exhausted" && decision.content) return { systemMessage: decision.content };
    const reminder = this.registration.onSettle(this.tasks());
    if (!reminder) return {};
    this.recorder?.record(this.shim.sessionId, "WorkRegistration", { hook: WORK_REGISTRATION_HOOK, reminder });
    return this.continueTurn(reminder);
  }
  /** Keep the turn going with `content` as the next instruction, in the host's own Stop wire shape. */
  continueTurn(content) {
    return this.host === "codex" ? { decision: "block", reason: content } : this.host === "antigravity" ? { decision: "continue", reason: content } : context("Stop", content);
  }
  async command(payload) {
    const name = normalizeCommandName(payload.command_name ?? payload.name);
    const command = this.shim.commands.get(name);
    if (!command) return {};
    const before = this.shim.notifications.length;
    let returned;
    try {
      returned = await command.handler(String(payload.command_args ?? ""), this.shim.ctx());
    } catch (error) {
      returned = `/${name} failed: ${error.message}`;
    }
    const notes = this.shim.notifications.slice(before).map((n) => n.message);
    const text3 = [typeof returned === "string" ? returned : "", ...notes].filter(Boolean).join("\n");
    return { decision: "block", reason: text3 || `/${name} done.` };
  }
};
var context = (hookEventName, additionalContext) => ({ hookSpecificOutput: { hookEventName, additionalContext } });

// src/api-proxy.ts
import { createInterface } from "node:readline";

// src/env.ts
import { homedir } from "node:os";
import { dirname as dirname2, join as join5, resolve as resolve2 } from "node:path";

// src/credentials.ts
import { execFileSync as execFileSync2 } from "node:child_process";
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
var defaultRunCli = (args) => execFileSync2("hoja", args, {
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
  if (host === "antigravity" || host === "agy") return join5(homedir(), ".gemini", "antigravity-cli", "plugin-data", "hoja");
  if (host !== "codex") return join5(homedir(), ".claude", "plugins", "data", "hoja-standalone");
  const installed = script ? /^(.*)[\\/]plugins[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/][^\\/]+$/.exec(resolve2(dirname2(resolve2(script)), "..")) : null;
  if (installed) return join5(installed[1], "plugins", "data", `${installed[3]}-${installed[2]}`);
  return join5(env.CODEX_HOME?.trim() || join5(homedir(), ".codex"), "plugins", "data", "hoja-standalone");
}
function enforcementMode(env = process.env) {
  const v = (env.HOJA_PLUGIN_ENFORCEMENT || env.HOJA_TASK_ENFORCEMENT || "block").trim();
  return v === "advise" || v === "off" ? v : "block";
}
var headless = (env = process.env) => truthy(env.HOJA_PLUGIN_HEADLESS) || !!env.CLAUDE_CODE_ENTRYPOINT && env.CLAUDE_CODE_ENTRYPOINT !== "cli";
var truthy = (v) => /^(1|true|yes|on)$/i.test(v?.trim() ?? "");
function traceUpload(env = process.env) {
  const v = (env.HOJA_PLUGIN_TRACE_UPLOAD || env.HOJA_TRACE_UPLOAD || "completion").trim().toLowerCase();
  return v === "session-end" || v === "manual" || v === "off" ? v : "completion";
}
function traceDetail(env = process.env) {
  return (env.HOJA_PLUGIN_TRACE_DETAIL || env.HOJA_TRACE_DETAIL || "full").trim().toLowerCase() === "metadata" ? "metadata" : "full";
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
    const text3 = await response.text();
    if (notification) return void 0;
    if (response.status === 401 || response.status === 403) throw new Error(`Hoja MCP rejected the token (${response.status}). ${SIGN_IN_HINT}`);
    if (response.status >= 400) throw new Error(`Hoja MCP ${this.url} answered HTTP ${response.status}`);
    const message = parseMessages(text3, response.headers.get("content-type") ?? "").find((m) => m.id === id);
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
            const text3 = Array.isArray(result?.content) ? result.content.map((c) => c?.text ?? "").join("\n") : "";
            const touched = extractTouchedIssuesFromTool(String(params?.name ?? ""), params?.arguments, text3);
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
  const send2 = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  const inflight2 = /* @__PURE__ */ new Map();
  createInterface({ input: process.stdin }).on("line", async (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = message;
    if (method === "notifications/cancelled") {
      inflight2.get(params?.requestId)?.abort();
      return;
    }
    if (id === void 0 || typeof method !== "string") return;
    const controller = new AbortController();
    inflight2.set(id, controller);
    try {
      send2({ jsonrpc: "2.0", id, result: await proxy.handle(method, params ?? {}, controller.signal) });
    } catch (error) {
      send2({ jsonrpc: "2.0", id, error: { code: error.code ?? -32603, message: error.message } });
    } finally {
      inflight2.delete(id);
    }
  }).on("close", () => process.exit(0));
}
if (process.argv[1] && /api-proxy\.(m?js|ts)$/.test(process.argv[1])) main();

// src/trace/collect.ts
import { existsSync as existsSync5, readdirSync, readFileSync as readFileSync7, writeFileSync as writeFileSync3, mkdirSync as mkdirSync5, renameSync as renameSync2 } from "node:fs";
import { basename, dirname as dirname3, join as join6, resolve as resolve3, sep as sep2 } from "node:path";
import { statSync as statSync4 } from "node:fs";

// src/trace/schema.ts
var TRACE_SCHEMA = "hoja.trace/v1";
var emptyUsage = () => ({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 });
var addUsage = (a, b) => {
  a.input_tokens += b.input_tokens;
  a.output_tokens += b.output_tokens;
  a.cache_read_tokens += b.cache_read_tokens;
  a.cache_creation_tokens += b.cache_creation_tokens;
};
var totalTokens = (u) => u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_creation_tokens;

// src/trace/build.ts
var PERSISTED = /<persisted-output>[\s\S]*?Full output saved to: (\S+)/;
var ms = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : void 0;
};
var between = (a, b) => {
  const x = ms(a), y = ms(b);
  return x !== void 0 && y !== void 0 && y >= x ? y - x : void 0;
};
var parseLines = (text3) => text3.split("\n").flatMap((line) => {
  if (!line.trim()) return [];
  try {
    const v = JSON.parse(line);
    return v && typeof v === "object" ? [v] : [];
  } catch {
    return [];
  }
});
var firstLine = (s) => s.split("\n").find((l) => l.trim())?.trim() ?? "";
var INJECTED_PROMPT = /^\s*<(command-name|command-message|command-args|local-command-stdout|local-command-caveat|system-reminder|task-notification|user-prompt-submit-hook)\b/;
function usageOf(u) {
  if (!u || typeof u !== "object") return void 0;
  const n = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
  return { input_tokens: n(u.input_tokens), output_tokens: n(u.output_tokens), cache_read_tokens: n(u.cache_read_input_tokens), cache_creation_tokens: n(u.cache_creation_input_tokens) };
}
function resultText(content, toolUseResult) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text3 = content.map((c) => typeof c === "string" ? c : c?.type === "text" ? String(c.text ?? "") : c?.type === "image" ? "[image]" : "").filter(Boolean).join("\n");
    if (text3) return text3;
  }
  const r = toolUseResult;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") return [r.stdout, r.stderr].filter((s) => typeof s === "string" && s).join("\n");
  return "";
}
function codexToolName(item) {
  if (item.type === "local_shell_call") return "Bash";
  const name = String(item.name ?? "tool");
  const ns = typeof item.namespace === "string" ? item.namespace : "";
  if (!ns) return /^(exec_command|shell|container\.exec)$/.test(name) ? "Bash" : name === "apply_patch" ? "Edit" : name;
  if (ns === "mcp__hoja") return name;
  if (ns === "mcp__hoja_api" || ns === "mcp__hoja-api") return `hoja/${name}`;
  return `${ns.replace(/^mcp__/, "")}/${name}`;
}
function displayToolName(raw) {
  const canonical = canonicalToolName(raw);
  const mcp = /^mcp__(?:plugin_([^_]+(?:_[^_]+)*?)_)?([^_].*?)__(.+)$/.exec(canonical);
  if (!mcp) return canonical;
  return canonical.startsWith("mcp__hoja__") ? `hoja/${mcp[3]}` : `${mcp[2]}/${mcp[3]}`;
}
var Builder = class {
  constructor(input2) {
    this.input = input2;
    this.full = (input2.detail ?? "full") === "full";
    this.redactor = input2.redactor ?? new Redactor();
  }
  input;
  spans = [];
  events = [];
  toolSpans = /* @__PURE__ */ new Map();
  llmSpans = /* @__PURE__ */ new Map();
  models = /* @__PURE__ */ new Set();
  truncated = [];
  title;
  firstPrompt;
  cwd;
  gitBranch;
  permissionMode;
  hostVersion;
  turnCount = 0;
  /** Antigravity transcripts carry second-resolution times; hook records time tool calls to the millisecond. */
  preferHookTimes = false;
  full;
  redactor;
  /** Whole content, scrubbed; capped only at FIELD_CAP (head and tail kept). */
  content(value) {
    if (!this.full || !value) return void 0;
    return clipMiddle(this.redactor.scrub(value), FIELD_CAP);
  }
  preview(value, max) {
    if (!this.full || !value) return void 0;
    return clip2(this.redactor.scrub(value), max);
  }
  add(span) {
    this.spans.push(span);
    return span;
  }
  label(tool, input2) {
    const name = displayToolName(tool);
    if (!this.full) return name;
    const label = this.redactor.scrub(toolLabel(name, input2));
    return this.cwd ? label.split(`${this.cwd}/`).join("") : label;
  }
  /** One transcript (the main session or one subagent) into spans under `rootId`. */
  walk(entries, rootId, agentId) {
    const main2 = agentId === void 0;
    let turn;
    let lastTs;
    let lastSeen;
    const parent = () => turn?.id ?? rootId;
    const closeTurn = (end) => {
      if (!turn) return;
      turn.end ??= end ?? lastSeen;
      turn.durationMs ??= between(turn.start, turn.end);
      if (turn.status === "running") turn.status = "ok";
    };
    for (const entry of entries) {
      const ts = typeof entry.timestamp === "string" ? entry.timestamp : void 0;
      if (main2) {
        if (entry.type === "ai-title" && typeof entry.aiTitle === "string") this.title = entry.aiTitle;
        if (entry.type === "summary" && typeof entry.summary === "string") this.title ??= entry.summary;
        if (typeof entry.cwd === "string") this.cwd ??= entry.cwd;
        if (typeof entry.gitBranch === "string" && entry.gitBranch) this.gitBranch = entry.gitBranch;
        if (typeof entry.permissionMode === "string") this.permissionMode = entry.permissionMode;
        if (typeof entry.version === "string") this.hostVersion ??= entry.version;
      }
      if (entry.type === "system" && main2) {
        if (entry.subtype === "turn_duration" && turn) {
          turn.end = ts ?? lastSeen;
          if (typeof entry.durationMs === "number") turn.durationMs = entry.durationMs;
        }
        if (entry.subtype === "compact_boundary" && ts) this.events.push({ at: ts, kind: "compaction", message: `Context compacted${entry.compactMetadata?.trigger ? ` (${entry.compactMetadata.trigger})` : ""}`, spanId: turn?.id });
        if (ts) lastSeen = ts;
        continue;
      }
      const message = entry.message;
      if (!message || typeof message !== "object") continue;
      if (entry.type === "user" && message.role === "user") {
        const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : Array.isArray(message.content) ? message.content : [];
        const prompt = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
        for (const block of blocks) {
          if (block?.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
          const span = this.toolSpans.get(block.tool_use_id);
          if (!span) continue;
          span.end = ts ?? span.end;
          span.durationMs = between(span.start, span.end);
          let text3 = resultText(block.content, entry.toolUseResult);
          const saved = PERSISTED.exec(text3)?.[1];
          if (saved && this.full) {
            const whole = this.input.readPersisted?.(saved);
            if (whole) {
              text3 = whole;
              span.attrs = { ...span.attrs, persisted: true };
            }
          }
          span.status = block.is_error === true ? /^\s*\[TASK ENFORCEMENT|hook (?:error|blocked)|blocked by (?:a )?(?:PreToolUse )?hook/i.test(text3) ? "blocked" : /interrupted by user/i.test(text3) ? "interrupted" : "error" : "ok";
          const out = this.content(text3);
          if (out) span.attrs = { ...span.attrs, [span.status === "ok" ? "output" : "error"]: out };
        }
        const genuine = prompt && !blocks.some((b) => b?.type === "tool_result") && entry.isMeta !== true && entry.isCompactSummary !== true && !INJECTED_PROMPT.test(prompt);
        if (genuine && main2) {
          closeTurn(lastSeen);
          this.turnCount++;
          this.firstPrompt ??= prompt;
          turn = this.add({
            id: `turn:${this.turnCount}`,
            parentId: rootId,
            kind: "turn",
            status: "running",
            name: this.full ? clip2(firstLine(this.redactor.scrub(prompt)), 90, false) : `Turn ${this.turnCount}`,
            start: ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString(),
            attrs: { index: this.turnCount, ...this.full ? { prompt: this.content(prompt) } : {} }
          });
        } else if (genuine && !main2) {
          const root = this.spans.find((s) => s.id === rootId);
          if (root && this.full && !root.attrs?.prompt) root.attrs = { ...root.attrs, prompt: this.content(prompt) };
        }
        if (ts) {
          lastTs = ts;
          lastSeen = ts;
        }
        continue;
      }
      if (entry.type === "assistant" && message.role === "assistant") {
        const id = typeof message.id === "string" ? message.id : String(entry.uuid ?? `${this.spans.length}`);
        let span = this.llmSpans.get(id);
        const model = typeof message.model === "string" && message.model !== "<synthetic>" ? message.model : void 0;
        if (model) this.models.add(model);
        if (!span) {
          span = this.add({ id: `llm:${id}`, parentId: parent(), kind: "llm", name: model ?? "model", start: lastTs ?? ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString(), status: "ok", agentId, attrs: { model } });
          this.llmSpans.set(id, span);
        }
        span.end = ts ?? span.end;
        span.durationMs = between(span.start, span.end);
        const usage = usageOf(message.usage);
        if (usage) span.attrs.usage = usage;
        if (typeof message.stop_reason === "string") span.attrs.stopReason = message.stop_reason;
        if (typeof entry.thinkingDurationMs === "number") span.attrs.thinkingMs = entry.thinkingDurationMs;
        if (typeof entry.requestId === "string") span.attrs.request_id = entry.requestId;
        if (message.stop_reason === "max_tokens") span.status = "error";
        for (const block of Array.isArray(message.content) ? message.content : []) {
          if (block?.type === "text" && typeof block.text === "string" && this.full) {
            const prior = typeof span.attrs.text === "string" ? `${span.attrs.text}
` : "";
            span.attrs.text = this.content(prior + block.text);
          }
          if (block?.type === "thinking") span.attrs.thinking = true;
          if (block?.type === "tool_use" && typeof block.id === "string") {
            const raw = String(block.name ?? "tool");
            const tool = displayToolName(raw);
            const toolSpan = this.add({
              id: `tool:${block.id}`,
              parentId: parent(),
              kind: "tool",
              name: this.label(raw, block.input),
              start: ts ?? span.start,
              status: "running",
              agentId,
              attrs: { tool_name: tool, tool_use_id: block.id, llmId: span.id, ...this.full ? { input: this.content(typeof block.input === "object" ? JSON.stringify(block.input, null, 1) : String(block.input ?? "")) } : {} }
            });
            this.toolSpans.set(block.id, toolSpan);
            this.taskEvents(tool, block.input, ts, toolSpan.id);
            const path = block.input?.file_path ?? block.input?.notebook_path;
            if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool) && typeof path === "string") toolSpan.attrs.file = path;
          }
        }
        if (ts) lastSeen = ts;
      }
    }
    if (main2) closeTurn(lastSeen);
  }
  /**
   * A Codex rollout (`~/.codex/sessions/…/rollout-*.jsonl`). Its shape, as Codex 0.169 writes it:
   *   event_msg task_started / task_complete     one turn, with duration_ms
   *   response_item reasoning|message|function_call   what the model produced
   *   token_usage_record                          closes one model request: response_id + exact usage
   *   response_item function_call_output          a tool result (call_id)
   *   session_meta / turn_context                 cwd, cli_version, model
   * Like the Claude transcript it is undocumented, so every field is optional and unknown lines are skipped.
   */
  walkCodex(entries, rootId) {
    let turn;
    let llm;
    let model;
    let lastInput;
    let lastSeen;
    let requests = 0;
    const parent = () => turn?.id ?? rootId;
    const openLlm = (ts) => {
      if (llm) return llm;
      llm = this.add({ id: `llm:codex-${++requests}`, parentId: parent(), kind: "llm", name: model ?? "model", start: lastInput ?? ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString(), status: "ok", attrs: { model } });
      if (model) this.models.add(model);
      return llm;
    };
    const closeTurn = (end, durationMs) => {
      if (!turn) return;
      turn.end = end ?? lastSeen;
      turn.durationMs = durationMs ?? between(turn.start, turn.end);
      if (turn.status === "running") turn.status = "ok";
      turn = void 0;
    };
    for (const entry of entries) {
      const ts = typeof entry.timestamp === "string" ? entry.timestamp : void 0;
      const p = entry.payload ?? {};
      if (entry.type === "session_meta") {
        if (typeof p.cwd === "string") this.cwd ??= p.cwd;
        if (typeof p.cli_version === "string") this.hostVersion ??= p.cli_version;
        if (typeof p.git?.branch === "string") this.gitBranch = p.git.branch;
      } else if (entry.type === "turn_context") {
        if (typeof p.model === "string") model = p.model;
        if (typeof p.cwd === "string") this.cwd ??= p.cwd;
        if (typeof p.approval_policy === "string") this.permissionMode = p.approval_policy;
      } else if (entry.type === "compacted") {
        if (ts) this.events.push({ at: ts, kind: "compaction", message: "Context compacted", spanId: turn?.id });
      } else if (entry.type === "event_msg" && p.type === "task_started") {
        closeTurn(lastSeen);
        this.turnCount++;
        turn = this.add({ id: `turn:${this.turnCount}`, parentId: rootId, kind: "turn", status: "running", name: `Turn ${this.turnCount}`, start: ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString(), attrs: { index: this.turnCount, trigger: p.turn_attribution?.turn_trigger } });
        lastInput = ts;
      } else if (entry.type === "event_msg" && p.type === "task_complete") {
        if (llm) {
          llm.end ??= ts;
          llm.durationMs ??= between(llm.start, llm.end);
          llm = void 0;
        }
        closeTurn(ts, typeof p.duration_ms === "number" ? p.duration_ms : void 0);
      } else if (entry.type === "event_msg" && (p.type === "turn_aborted" || p.type === "error") && ts) {
        this.events.push({ at: ts, kind: "error", message: `Turn ${p.type === "turn_aborted" ? "aborted" : "failed"}${p.reason ? `: ${p.reason}` : p.message ? `: ${String(p.message).slice(0, 200)}` : ""}`, spanId: turn?.id });
        if (turn) turn.status = "error";
      } else if (entry.type === "token_usage_record") {
        const span = openLlm(ts);
        span.end = ts ?? span.end;
        span.durationMs = between(span.start, span.end);
        const u = p.usage ?? {};
        const n = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
        span.attrs.usage = { input_tokens: Math.max(0, n(u.input_tokens) - n(u.cached_input_tokens)), output_tokens: n(u.output_tokens), cache_read_tokens: n(u.cached_input_tokens), cache_creation_tokens: n(u.cache_write_input_tokens) };
        if (n(u.reasoning_output_tokens)) span.attrs.reasoningTokens = n(u.reasoning_output_tokens);
        if (typeof p.response_id === "string") span.attrs.request_id = p.response_id;
        llm = void 0;
      } else if (entry.type === "response_item") {
        if (p.type === "message" && p.role === "user") {
          const text3 = (Array.isArray(p.content) ? p.content : []).filter((c) => typeof c?.text === "string").map((c) => c.text).join("\n");
          if (text3 && !ROLLOUT_INJECTED.test(text3) && turn && !turn.attrs?.prompt) {
            turn.name = this.full ? clip2(firstLine(this.redactor.scrub(text3)), 90, false) : turn.name;
            if (this.full) turn.attrs = { ...turn.attrs, prompt: this.content(text3) };
            this.firstPrompt ??= text3;
          }
          lastInput = ts;
        } else if (p.type === "reasoning") {
          openLlm(ts).attrs.thinking = true;
        } else if (p.type === "message" && p.role === "assistant") {
          const text3 = (Array.isArray(p.content) ? p.content : []).filter((c) => typeof c?.text === "string").map((c) => c.text).join("\n");
          const span = openLlm(ts);
          if (text3 && this.full) span.attrs.text = this.content(typeof span.attrs.text === "string" ? `${span.attrs.text}
${text3}` : text3);
        } else if ((p.type === "function_call" || p.type === "custom_tool_call" || p.type === "local_shell_call") && typeof p.call_id === "string") {
          const span = openLlm(ts);
          let args = p.arguments ?? p.input ?? p.action;
          if (typeof args === "string") {
            try {
              args = JSON.parse(args);
            } catch {
            }
          }
          const tool = codexToolName(p);
          const labelInput = tool === "Bash" && args && typeof args === "object" ? { command: args.cmd ?? args.command } : args;
          const toolSpan = this.add({
            id: `tool:${p.call_id}`,
            parentId: parent(),
            kind: "tool",
            name: this.label(tool, labelInput),
            start: ts ?? span.start,
            status: "running",
            attrs: { tool_name: tool, tool_use_id: p.call_id, llmId: span.id, ...this.full ? { input: this.content(typeof args === "object" ? JSON.stringify(args, null, 1) : String(args ?? "")) } : {} }
          });
          this.toolSpans.set(p.call_id, toolSpan);
          this.taskEvents(tool, args, ts, toolSpan.id);
        } else if ((p.type === "function_call_output" || p.type === "custom_tool_call_output") && typeof p.call_id === "string") {
          const span = this.toolSpans.get(p.call_id);
          const text3 = typeof p.output === "string" ? p.output : Array.isArray(p.output) ? p.output.map((c) => typeof c?.text === "string" ? c.text : "").filter(Boolean).join("\n") : typeof p.output?.content === "string" ? p.output.content : "";
          if (span) {
            span.end = ts ?? span.end;
            span.durationMs = between(span.start, span.end);
            const exit = /Process exited with code (\d+)/.exec(text3);
            const rejected = span.attrs?.tool_name === "TaskManage" && /"status"\s*:\s*"(failed|partial)"/.test(text3);
            span.status = /blocked by (?:PreToolUse )?hook|\[TASK ENFORCEMENT/i.test(text3) ? "blocked" : exit && exit[1] !== "0" || p.output?.success === false || rejected ? "error" : "ok";
            const out = this.content(text3);
            if (out) span.attrs = { ...span.attrs, [span.status === "ok" ? "output" : "error"]: out };
            if (exit) span.attrs = { ...span.attrs, exitCode: Number(exit[1]) };
          }
          lastInput = ts;
        }
      }
      if (ts) lastSeen = ts;
    }
    closeTurn(lastSeen);
  }
  /**
   * An Antigravity transcript (`brain/<id>/.system_generated/logs/transcript_full.jsonl`), agy 1.5.14:
   *   USER_INPUT        the user's turn (<USER_REQUEST> … wrapped in metadata)
   *   PLANNER_RESPONSE  one model call: model, input/cache_read/output tokens, thinking, content, tool_calls (no ids)
   *   GENERIC           one tool result, answering the previous response's tool_calls in order; status ERROR when it
   *                     failed or a hook denied it
   * Times are whole seconds, so hook records refine them: a tool result's step index is the `stepIdx` its
   * PreToolUse/PostToolUse hooks carry, and the invocation hooks bracket each model call.
   */
  walkAgy(entries, rootId, hooks) {
    this.preferHookTimes = true;
    const hookIdByStep = /* @__PURE__ */ new Map();
    for (const h of hooks) if ((h.event === "PreToolUse" || h.event === "PostToolUse" || h.event === "PostToolUseFailure") && h.stepIdx !== void 0 && h.toolUseId) hookIdByStep.set(h.stepIdx, h.toolUseId);
    const invocations = hooks.filter((h) => (h.event === "UserPromptSubmit" || h.event === "PreInvocation") && h.invocationNum !== void 0).map((h) => h.at).sort();
    const marks = hooks.filter((h) => h.event === "PreToolUse" || h.event === "PostToolBatch" || h.event === "Stop").map((h) => h.at).sort();
    const planners = entries.filter((e) => e.type === "PLANNER_RESPONSE").length;
    const useInvocations = invocations.length === planners;
    let turn;
    let pending = [];
    let planner = 0;
    let lastSeen;
    const stamps = entries.map((e) => typeof e.created_at === "string" ? e.created_at : void 0);
    const closeTurn = (end) => {
      if (!turn) return;
      turn.end ??= end ?? lastSeen;
      turn.durationMs = between(turn.start, turn.end);
      if (turn.status === "running") turn.status = "ok";
      turn = void 0;
    };
    entries.forEach((e, i) => {
      const ts = stamps[i];
      if (e.type === "USER_INPUT" && typeof e.content === "string") {
        closeTurn(lastSeen);
        this.turnCount++;
        const prompt = agyUserRequest(e.content);
        turn = this.add({ id: `turn:${this.turnCount}`, parentId: rootId, kind: "turn", status: "running", start: ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString(), name: this.full ? clip2(firstLine(this.redactor.scrub(prompt)), 90, false) : `Turn ${this.turnCount}`, attrs: { index: this.turnCount, ...this.full ? { prompt: this.content(prompt) } : {} } });
        this.firstPrompt ??= prompt;
        pending = [];
      } else if (e.type === "PLANNER_RESPONSE") {
        const model = typeof e.model === "string" ? e.model : void 0;
        if (model) this.models.add(model);
        const start = useInvocations ? invocations[planner] : ts ?? lastSeen ?? (/* @__PURE__ */ new Date(0)).toISOString();
        const end = useInvocations ? marks.find((m) => m > start) ?? stamps.slice(i + 1).find(Boolean) : stamps.slice(i + 1).find(Boolean) ?? ts;
        planner++;
        const n = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
        const llm = this.add({
          id: `llm:agy-${e.step_index ?? i}`,
          parentId: turn?.id ?? rootId,
          kind: "llm",
          name: model ?? "model",
          start,
          end,
          durationMs: between(start, end),
          status: e.status === "ERROR" ? "error" : "ok",
          attrs: { model, usage: { input_tokens: n(e.input_tokens), output_tokens: n(e.output_tokens), cache_read_tokens: n(e.cache_read_tokens), cache_creation_tokens: 0 }, ...e.thinking ? { thinking: true } : {}, ...this.full && typeof e.content === "string" && e.content ? { text: this.content(e.content) } : {} }
        });
        pending = (Array.isArray(e.tool_calls) ? e.tool_calls : []).map((call) => ({ call, llm }));
      } else if (e.type === "GENERIC" && pending.length) {
        const { call, llm } = pending.shift();
        const tool = agyToolName(call);
        const mapped = agyToolCall(call).tool_input;
        const step = typeof e.step_index === "number" ? e.step_index : i;
        const id = hookIdByStep.get(step) ?? `agy-step-${step}`;
        const body = agyResultText(typeof e.content === "string" ? e.content : "");
        const denied = typeof e.error === "string" && /denied by (?:a )?pre-tool hook/i.test(e.error);
        const exit = /Command exited with code (\d+)/.exec(body);
        const status = denied ? "blocked" : e.status === "ERROR" || exit && exit[1] !== "0" ? "error" : "ok";
        const span = this.add({
          id: `tool:${id}`,
          parentId: turn?.id ?? rootId,
          kind: "tool",
          name: this.label(tool, mapped),
          start: ts ?? llm.end ?? llm.start,
          end: ts,
          status,
          attrs: { tool_name: displayToolName(tool), tool_use_id: id, llmId: llm.id, step, ...this.full ? { input: this.content(JSON.stringify(call.args ?? {}, null, 1)) } : {}, ...exit ? { exitCode: Number(exit[1]) } : {} }
        });
        const out = this.content(denied ? String(e.error) : body);
        if (out) span.attrs[status === "ok" ? "output" : status === "blocked" ? "blockedReason" : "error"] = out;
        this.toolSpans.set(id, span);
        this.taskEvents(displayToolName(tool), agyToolCall(call).tool_input, ts, span.id);
        const path = mapped.file_path;
        if (/^(Write|Edit|MultiEdit)$/.test(tool) && typeof path === "string") span.attrs.file = path;
      }
      if (ts) lastSeen = ts;
    });
    closeTurn(lastSeen);
  }
  /** TaskManage creates/updates as instants on the timeline: what the agent committed to, and when. */
  taskEvents(tool, input2, at, spanId) {
    if (tool !== "TaskManage" || !at || !Array.isArray(input2?.operations)) return;
    for (const op of input2.operations) {
      if (op?.op === "create") this.events.push({ at, kind: "task", spanId, message: `Task created: ${clip2(String(op.subject ?? ""), 120)}`, attrs: { op: "create", status: op.status } });
      else if (op?.op === "update" && (op.status || op.active)) {
        const id = typeof op.taskId === "string" ? `#${op.taskId}` : "task";
        this.events.push({ at, kind: "task", spanId, message: `${id} \u2192 ${op.status ?? "focused"}`, attrs: { op: "update", taskId: op.taskId, status: op.status } });
      }
    }
  }
  /** Fold hook records into the spans: exact durations, gate decisions, calls the transcript missed. */
  mergeHooks(hooks, rootId) {
    const pre = /* @__PURE__ */ new Map();
    const post = /* @__PURE__ */ new Map();
    const subagentStart = /* @__PURE__ */ new Map();
    let turn = this.spans.filter((s) => s.kind === "turn").at(-1);
    const hooksOnly = !this.spans.some((s) => s.kind === "turn" || s.kind === "llm");
    let turnIndex = 0;
    for (const h of hooks) {
      if (h.event === "PreToolUse" && h.toolUseId) pre.set(h.toolUseId, h);
      if ((h.event === "PostToolUse" || h.event === "PostToolUseFailure") && h.toolUseId) post.set(h.toolUseId, h);
      if (h.event === "SubagentStart" && h.agentId) subagentStart.set(h.agentId, h);
      if (h.permissionMode) this.permissionMode = h.permissionMode;
      if (h.model) this.models.add(h.model);
      if (h.event === "PreToolUse" && h.decision === "deny")
        this.events.push({ at: h.at, kind: "gate.block", message: `${h.tool ? displayToolName(h.tool) : "Tool"} blocked: ${firstLine(h.reason ?? "")}`.slice(0, 300), spanId: h.toolUseId ? `tool:${h.toolUseId}` : void 0, attrs: this.full ? { reason: h.reason } : void 0 });
      if (h.event === "PreCompact") this.events.push({ at: h.at, kind: "compaction", message: `Compaction started (${h.trigger ?? "auto"})` });
      if (h.event === "Notification") this.events.push({ at: h.at, kind: "notification", message: h.message ?? h.notificationType ?? "notification", attrs: h.notificationType ? { type: h.notificationType } : void 0 });
      if (h.event === "StopFailure") this.events.push({ at: h.at, kind: "error", message: `Turn failed: ${firstLine(h.error ?? "")}`.slice(0, 300) });
      if (h.event === "PermissionDenied") this.events.push({ at: h.at, kind: "gate.block", message: `${h.tool ?? "Tool"} denied by permissions${h.reason ? `: ${h.reason}` : ""}`, spanId: h.toolUseId ? `tool:${h.toolUseId}` : void 0 });
      if (h.event === "SessionStart" && h.source && h.source !== "startup") this.events.push({ at: h.at, kind: "session", message: `Session ${h.source}` });
      if (h.event === "SessionEnd") this.events.push({ at: h.at, kind: "session", message: `Session ended (${h.reason ?? "exit"})` });
      if (hooksOnly && h.event === "UserPromptSubmit" && !h.agentId) {
        if (turn && !turn.end) {
          turn.end = h.at;
          turn.durationMs = between(turn.start, turn.end);
          turn.status = "ok";
        }
        turnIndex++;
        turn = this.add({ id: `turn:${turnIndex}`, parentId: rootId, kind: "turn", status: "running", start: h.at, name: this.full && h.prompt ? clip2(firstLine(h.prompt), 90, false) : `Turn ${turnIndex}`, attrs: { index: turnIndex, ...this.full && h.prompt ? { prompt: h.prompt } : {} } });
        this.firstPrompt ??= h.prompt;
      }
      if (hooksOnly && (h.event === "Stop" || h.event === "StopFailure") && !h.agentId && turn && !turn.end) {
        turn.end = h.at;
        turn.durationMs = between(turn.start, turn.end);
        turn.status = h.event === "StopFailure" ? "error" : "ok";
      }
      if (h.event === "SubagentStop" && h.agentId && !this.spans.some((s) => s.id === `agent:${h.agentId}`)) {
        const started = subagentStart.get(h.agentId);
        this.add({ id: `agent:${h.agentId}`, parentId: turn?.id ?? rootId, kind: "subagent", name: h.agentType ?? "subagent", start: started?.at ?? h.at, end: h.at, durationMs: between(started?.at, h.at), status: "ok", agentId: h.agentId, attrs: { agentType: h.agentType } });
      }
      if (hooksOnly && h.event === "PreToolUse" && h.toolUseId && !this.toolSpans.has(h.toolUseId)) {
        const tool = displayToolName(h.tool ?? "tool");
        const span = this.add({
          id: `tool:${h.toolUseId}`,
          parentId: h.agentId ? `agent:${h.agentId}` : turn?.id ?? rootId,
          kind: "tool",
          name: this.full && (h.label ?? h.input) ? `${tool} \xB7 ${clip2(firstLine(h.label ?? h.input ?? ""), 100, false)}` : tool,
          start: h.at,
          status: "running",
          agentId: h.agentId,
          attrs: { tool_name: tool, tool_use_id: h.toolUseId, ...this.full && h.input ? { input: h.input } : {} }
        });
        this.toolSpans.set(h.toolUseId, span);
      }
    }
    if (hooksOnly && turn && !turn.end) {
      turn.status = "running";
    }
    for (const [id, span] of this.toolSpans) {
      const p = pre.get(id), q2 = post.get(id);
      if (this.preferHookTimes && p && q2) {
        span.start = p.at;
        span.end = q2.at;
        span.durationMs = between(p.at, q2.at);
      }
      if (p?.decision === "deny") {
        span.status = "blocked";
        span.end ??= p.at;
        span.durationMs = 0;
        if (this.full && p.reason) span.attrs = { ...span.attrs, blockedReason: p.reason };
        continue;
      }
      if (p?.context && this.full) span.attrs = { ...span.attrs, hookContext: p.context };
      if (!q2) continue;
      if (span.status === "running") span.status = q2.event === "PostToolUseFailure" ? q2.interrupted ? "interrupted" : "error" : "ok";
      if (hooksOnly || !span.end) span.end = q2.at;
      if (q2.durationMs !== void 0) {
        span.durationMs = q2.durationMs;
        span.attrs = { ...span.attrs, measured: "hook" };
      } else span.durationMs ??= between(span.start, span.end);
      if (hooksOnly && this.full) {
        if (q2.output) span.attrs = { ...span.attrs, output: q2.output };
        if (q2.error) span.attrs = { ...span.attrs, error: q2.error };
      }
    }
    for (const span of this.spans) if (span.kind === "tool" && span.agentId && span.parentId !== `agent:${span.agentId}` && this.spans.some((s) => s.id === `agent:${span.agentId}`) && hooksOnly) span.parentId = `agent:${span.agentId}`;
  }
};
function buildTrace(input2) {
  const b = new Builder(input2);
  const rootId = "session";
  const root = b.add({ id: rootId, kind: "session", name: "Session", start: "", status: "ok" });
  const entries = input2.transcript ? parseLines(input2.transcript) : [];
  const codex = entries.some((e) => e.type === "session_meta" || e.type === "response_item" || e.type === "token_usage_record");
  const agy = !codex && entries.some((e) => typeof e.step_index === "number" && (e.type === "USER_INPUT" || e.type === "PLANNER_RESPONSE"));
  const basis = codex || agy || entries.some((e) => e.type === "assistant" || e.type === "user") ? "transcript" : "hooks";
  if (basis === "transcript") {
    if (codex) b.walkCodex(entries, rootId);
    else if (agy) b.walkAgy(entries, rootId, input2.hooks);
    else b.walk(entries, rootId);
  }
  for (const sub of input2.subagents ?? []) {
    const subEntries = parseLines(sub.text);
    if (!subEntries.length) continue;
    const stamps2 = subEntries.map((e) => e.timestamp).filter((t) => typeof t === "string").sort();
    const parentTool = sub.toolUseId ? b.toolSpans.get(sub.toolUseId) : void 0;
    const span = b.add({
      id: `agent:${sub.agentId}`,
      parentId: parentTool?.id ?? rootId,
      kind: "subagent",
      name: [sub.agentType, sub.description ? clip2(b.redactor.scrub(sub.description), 80, false) : void 0].filter(Boolean).join(" \xB7 ") || "subagent",
      start: stamps2[0] ?? "",
      end: stamps2.at(-1),
      durationMs: between(stamps2[0], stamps2.at(-1)),
      status: "ok",
      agentId: sub.agentId,
      attrs: { agentType: sub.agentType, description: b.preview(sub.description, 200) }
    });
    b.walk(subEntries, span.id, sub.agentId);
    if (b.spans.some((s) => s.parentId === span.id && s.kind === "tool" && s.status === "error")) span.attrs.hadErrors = true;
  }
  b.mergeHooks(input2.hooks, rootId);
  const stamps = [...b.spans.flatMap((s) => [s.start, s.end]), ...b.events.map((e) => e.at), ...input2.hooks.map((h) => h.at)].filter((t) => !!t && ms(t) !== void 0).sort();
  const now = (input2.now ?? /* @__PURE__ */ new Date()).toISOString();
  root.start = stamps[0] ?? now;
  root.end = stamps.at(-1) ?? now;
  root.durationMs = between(root.start, root.end) ?? 0;
  for (const span of b.spans) if (!span.start) span.start = root.start;
  b.events.sort((x, y) => (ms(x.at) ?? 0) - (ms(y.at) ?? 0));
  const tokens = emptyUsage();
  const tokensByModel = {};
  const tools = /* @__PURE__ */ new Map();
  const files = /* @__PURE__ */ new Set();
  let llmMs = 0, toolMs = 0;
  for (const span of b.spans) {
    if (span.kind === "llm") {
      const usage = span.attrs?.usage;
      if (usage) {
        addUsage(tokens, usage);
        const model = String(span.attrs?.model ?? "unknown");
        addUsage(tokensByModel[model] ??= emptyUsage(), usage);
      }
      llmMs += span.durationMs ?? 0;
    }
    if (span.kind === "tool") {
      if (span.status !== "running") span.attrs = { ...span.attrs, success: span.status === "ok" };
      const name = String(span.attrs?.tool_name ?? span.name);
      const stat = tools.get(name) ?? { name, calls: 0, errors: 0, blocked: 0, totalMs: 0 };
      stat.calls++;
      if (span.status === "error" || span.status === "interrupted") stat.errors++;
      if (span.status === "blocked") stat.blocked++;
      stat.totalMs += span.durationMs ?? 0;
      toolMs += span.durationMs ?? 0;
      tools.set(name, stat);
      if (typeof span.attrs?.file === "string") files.add(span.attrs.file);
    }
  }
  const toolSpans = b.spans.filter((s) => s.kind === "tool");
  const cwd = b.cwd;
  const relative = (p) => cwd && p.startsWith(cwd + "/") ? p.slice(cwd.length + 1) : p;
  let spans = b.spans;
  const maxSpans = input2.maxSpans ?? 5e3;
  if (spans.length > maxSpans) {
    b.truncated.push(`${spans.length - maxSpans} spans past the ${maxSpans}-span limit were dropped`);
    spans = spans.slice(0, maxSpans);
  }
  const title = b.title ?? (b.firstPrompt ? clip2(firstLine(b.redactor.scrub(b.firstPrompt)), 90, false) : void 0);
  const trace = {
    schema: TRACE_SCHEMA,
    id: `${input2.sessionId}@${root.end}`,
    createdAt: now,
    source: { host: input2.host ?? (codex ? "codex" : agy ? "antigravity" : "claude-code"), hostVersion: b.hostVersion, plugin: input2.plugin, detail: input2.detail ?? "full" },
    session: {
      id: input2.sessionId,
      title: (input2.detail ?? "full") === "full" ? title : void 0,
      cwd,
      gitBranch: b.gitBranch,
      permissionMode: b.permissionMode,
      models: [...b.models],
      start: root.start,
      end: root.end,
      durationMs: root.durationMs ?? 0,
      basis
    },
    totals: {
      turns: b.spans.filter((s) => s.kind === "turn").length,
      llmCalls: b.spans.filter((s) => s.kind === "llm").length,
      toolCalls: toolSpans.length,
      toolErrors: toolSpans.filter((s) => s.status === "error" || s.status === "interrupted").length,
      blocked: toolSpans.filter((s) => s.status === "blocked").length,
      subagents: b.spans.filter((s) => s.kind === "subagent").length,
      compactions: b.events.filter((e) => e.kind === "compaction" && !/started/.test(e.message)).length || b.events.filter((e) => e.kind === "compaction").length,
      tokens,
      tokensByModel,
      llmMs,
      toolMs,
      filesTouched: [...files].map(relative).sort()
    },
    tools: [...tools.values()].sort((x, y) => y.calls - x.calls || y.totalMs - x.totalMs),
    tasks: input2.tasks ?? [],
    issues: [.../* @__PURE__ */ new Set([...(input2.tasks ?? []).map((t) => t.issue).filter((i) => !!i), ...(input2.extraIssues ?? []).filter(Boolean)])],
    spans,
    events: b.events,
    ...b.truncated.length ? { truncated: b.truncated } : {}
  };
  return fitTrace(trace);
}
var CONTENT_FIELDS = ["output", "input", "text", "error", "prompt", "hookContext", "blockedReason"];
var FIT_CAPS = [64e3, 16e3, 4e3, 1e3, 300];
function fitTrace(trace, limit = 8 * 1024 * 1024) {
  const size = () => Buffer.byteLength(JSON.stringify(trace));
  if (size() <= limit) return trace;
  for (const cap of FIT_CAPS) {
    let trimmed2 = 0;
    for (const span of trace.spans) for (const field of CONTENT_FIELDS) {
      const value = span.attrs?.[field];
      if (typeof value === "string" && value.length > cap) {
        span.attrs[field] = clipMiddle(value, cap);
        trimmed2++;
      }
    }
    if (trimmed2) (trace.truncated ??= []).push(`${trimmed2} content fields over ${cap.toLocaleString("en-US")} chars trimmed (head and tail kept) to fit the upload limit`);
    if (size() <= limit) return trace;
  }
  while (size() > limit && trace.spans.length > 1) {
    const drop = Math.ceil(trace.spans.length / 10);
    trace.spans = trace.spans.slice(0, trace.spans.length - drop);
    trace.truncated.push(`${drop} trailing spans dropped to fit the upload limit`);
  }
  return trace;
}

// src/trace/collect.ts
var PLUGIN_VERSION = "0.7.0";
var HOJA_TASK_ENTRY2 = "hoja-task-link";
var TASK_STATE_ENTRY = "pi-swarm-task-state";
function hojaLinks(entries) {
  const links = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry?.customType !== HOJA_TASK_ENTRY2) continue;
    const d = entry.data;
    if (d?.taskId == null) continue;
    if (d.state === "linked" && typeof d.identifier === "string") links.set(String(d.taskId), d.identifier);
  }
  return links;
}
function journalTasks(entries) {
  const last = [...entries].reverse().find((e) => e?.customType === TASK_STATE_ENTRY);
  const tasks = last?.data?.tasks;
  return Array.isArray(tasks) ? tasks : tasks && typeof tasks === "object" ? Object.values(tasks) : [];
}
function traceTasks(tasks, links) {
  return tasks.filter((t) => t && t.status !== "deleted").map((t) => {
    const answered = new Set((t.answers ?? []).map((a) => a?.question));
    return {
      id: String(t.id),
      subject: String(t.subject ?? ""),
      status: String(t.status ?? ""),
      ...t.parentTaskId ? { parentId: String(t.parentTaskId) } : {},
      ...links.get(String(t.id)) ? { issue: links.get(String(t.id)) } : {},
      ...Array.isArray(t.questions) && t.questions.length ? { questions: t.questions.map((q2) => ({ id: String(q2.id), text: String(q2.text ?? ""), answered: answered.has(q2.id) })) } : {}
    };
  });
}
function readSubagents(transcriptPath) {
  if (!transcriptPath) return [];
  const dir = join6(dirname3(transcriptPath), basename(transcriptPath, ".jsonl"), "subagents");
  if (!existsSync5(dir)) return [];
  const out = [];
  for (const file of readdirSync(dir).filter((f) => /^agent-.+\.jsonl$/.test(f)).sort()) {
    const agentId = file.slice("agent-".length, -".jsonl".length);
    let meta = {};
    try {
      meta = JSON.parse(readFileSync7(join6(dir, `agent-${agentId}.meta.json`), "utf8"));
    } catch {
    }
    try {
      out.push({ agentId, text: readFileSync7(join6(dir, file), "utf8"), toolUseId: meta.toolUseId, agentType: meta.agentType, description: meta.description });
    } catch {
    }
  }
  return out;
}
function persistedReader(transcriptPath) {
  if (!transcriptPath) return void 0;
  const root = resolve3(dirname3(transcriptPath), basename(transcriptPath, ".jsonl"), "tool-results") + sep2;
  return (path) => {
    const target2 = resolve3(path);
    if (!target2.startsWith(root) || target2.slice(root.length).includes(sep2)) return void 0;
    try {
      if (statSync4(target2).size > FIELD_CAP * 4) return readFileSync7(target2, "utf8").slice(0, FIELD_CAP * 4);
      return readFileSync7(target2, "utf8");
    } catch {
      return void 0;
    }
  };
}
function transcriptFromHooks(records) {
  return [...records].reverse().find((r) => r.transcriptPath)?.transcriptPath;
}
function collectTrace(options) {
  const hooks = readHookRecords(options.dataDir, options.sessionId);
  const transcriptPath = options.transcriptPath || transcriptFromHooks(hooks);
  let transcript;
  try {
    if (transcriptPath) transcript = readFileSync7(transcriptPath, "utf8");
  } catch {
  }
  const journal = options.journal ?? [];
  const links = hojaLinks(journal);
  const extraIssues = [
    ...hooks.flatMap((h) => h.touchedIssues ?? []),
    ...readTouchedIssues(options.dataDir, options.sessionId)
  ];
  return buildTrace({
    sessionId: options.sessionId,
    transcript,
    subagents: readSubagents(transcriptPath),
    hooks,
    tasks: traceTasks(options.tasks ?? journalTasks(journal), links),
    extraIssues,
    plugin: `hoja@${PLUGIN_VERSION}`,
    host: options.host ?? (hostOf() === "claude" ? void 0 : hostOf()),
    detail: options.detail ?? traceDetail(options.env),
    redactor: new Redactor(options.env ?? process.env),
    now: options.now,
    readPersisted: persistedReader(transcriptPath)
  });
}
function saveTrace(dataDir2, trace) {
  const path = tracePath(dataDir2, trace.session.id);
  mkdirSync5(tracesDir(dataDir2), { recursive: true, mode: 448 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync3(tmp, JSON.stringify(trace), { mode: 384 });
  renameSync2(tmp, path);
  return path;
}

// src/trace/render.ts
function formatDuration(ms2) {
  if (ms2 == null || !Number.isFinite(ms2)) return "\u2013";
  if (ms2 < 1e3) return `${Math.round(ms2)}ms`;
  const s = ms2 / 1e3;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  const m = Math.floor(s / 60), rs = Math.round(s % 60);
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}
function formatTokens(n) {
  if (n < 1e3) return String(n);
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k`;
  return `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`;
}
var bar = (part, whole, width = 18) => {
  const n = whole > 0 ? Math.max(part > 0 ? 1 : 0, Math.round(part / whole * width)) : 0;
  return "\u2588".repeat(n) + "\u2591".repeat(width - n);
};
var icon = (s) => s === "ok" ? "\u2713" : s === "blocked" ? "\u2298" : s === "running" ? "\u2026" : "\u2717";
function renderSummary(trace, extra = {}) {
  const t = trace.totals;
  const lines = [];
  lines.push(`Session trace${trace.session.title ? ` \xB7 ${trace.session.title}` : ""}`);
  lines.push(`  ${formatDuration(trace.session.durationMs)} \xB7 ${t.turns} turn${t.turns === 1 ? "" : "s"} \xB7 ${t.llmCalls} model calls \xB7 ${t.toolCalls} tool calls${t.toolErrors ? ` (${t.toolErrors} failed)` : ""}${t.blocked ? ` \xB7 ${t.blocked} blocked by the gate` : ""}${t.subagents ? ` \xB7 ${t.subagents} subagents` : ""}${t.compactions ? ` \xB7 ${t.compactions} compactions` : ""}`);
  if (trace.session.models.length) lines.push(`  Model     ${trace.session.models.join(", ")}`);
  if (totalTokens(t.tokens)) lines.push(`  Tokens    ${formatTokens(totalTokens(t.tokens))} total \xB7 in ${formatTokens(t.tokens.input_tokens)} \xB7 out ${formatTokens(t.tokens.output_tokens)} \xB7 cache read ${formatTokens(t.tokens.cache_read_tokens)} \xB7 cache write ${formatTokens(t.tokens.cache_creation_tokens)}`);
  const busy = t.llmMs + t.toolMs;
  if (busy) {
    const parallel = busy > trace.session.durationMs * 1.05 ? "  (summed; subagents and parallel calls overlap)" : "";
    lines.push(`  Waiting   model ${bar(t.llmMs, busy, 12)} ${formatDuration(t.llmMs)} \xB7 tools ${bar(t.toolMs, busy, 12)} ${formatDuration(t.toolMs)}${parallel}`);
  }
  if (trace.tools.length) {
    lines.push("", "  Tool            calls  failed  blocked     time");
    for (const s of trace.tools.slice(0, 8))
      lines.push(`  ${s.name.padEnd(15).slice(0, 15)} ${String(s.calls).padStart(5)}  ${String(s.errors || "").padStart(6)}  ${String(s.blocked || "").padStart(7)}  ${formatDuration(s.totalMs).padStart(7)}`);
    if (trace.tools.length > 8) lines.push(`  \u2026 ${trace.tools.length - 8} more`);
  }
  const slow = trace.spans.filter((s) => s.kind === "tool" && s.durationMs).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)).slice(0, 3);
  if (slow.length) {
    lines.push("", "  Slowest");
    for (const s of slow) lines.push(`  ${icon(s.status)} ${formatDuration(s.durationMs).padStart(7)}  ${s.name.slice(0, 90)}`);
  }
  const failed2 = trace.spans.filter((s) => s.kind === "tool" && (s.status === "error" || s.status === "blocked")).slice(-3);
  if (failed2.length) {
    lines.push("", "  Recent failures");
    for (const s of failed2) lines.push(`  ${icon(s.status)} ${s.name.slice(0, 90)}`);
  }
  if (t.filesTouched.length) lines.push("", `  Files     ${t.filesTouched.slice(0, 6).join(", ")}${t.filesTouched.length > 6 ? ` +${t.filesTouched.length - 6}` : ""}`);
  if (trace.issues.length) lines.push(`  Issues    ${trace.issues.join(", ")}`);
  for (const u of extra.uploads ?? []) lines.push(`  Uploaded  \u2192 ${u.issue} at ${u.at.slice(11, 16)} UTC`);
  if (extra.path) lines.push(`  Saved     ${extra.path}`);
  if (trace.truncated?.length) lines.push(`  Note      ${trace.truncated.join("; ")}`);
  return lines.join("\n");
}

// src/trace/upload.ts
import { existsSync as existsSync6, readFileSync as readFileSync8, writeFileSync as writeFileSync4, mkdirSync as mkdirSync6 } from "node:fs";
import { join as join7 } from "node:path";
var HOSTS = { "claude-code": { slug: "claude-code", name: "Claude Code" }, codex: { slug: "codex", name: "Codex" }, antigravity: { slug: "antigravity", name: "Antigravity" } };
var hostOf2 = (trace) => HOSTS[trace.source.host] ?? { slug: trace.source.host.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "agent", name: trace.source.host };
function traceFileName(trace) {
  const stamp = trace.session.end.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "-");
  return `${hostOf2(trace).slug}-${trace.session.id.slice(0, 8)}-${stamp}.trace.json`;
}
function traceSubtitle(trace) {
  const t = trace.totals;
  return [
    `${hostOf2(trace).name} trace`,
    formatDuration(trace.session.durationMs),
    `${t.turns} turn${t.turns === 1 ? "" : "s"}`,
    `${t.toolCalls} tool call${t.toolCalls === 1 ? "" : "s"}`,
    t.toolErrors ? `${t.toolErrors} failed` : "",
    t.blocked ? `${t.blocked} blocked` : "",
    t.subagents ? `${t.subagents} subagent${t.subagents === 1 ? "" : "s"}` : "",
    totalTokens(t.tokens) ? `${formatTokens(totalTokens(t.tokens))} tokens` : ""
  ].filter(Boolean).join(" \xB7 ");
}
function traceTitle(trace, reason) {
  const slug = hostOf2(trace).slug;
  return traceFileName(trace).replace(`${slug}-`, `${slug}${reason ? `-${reason}` : ""}-`);
}
var ATTACH = `mutation HojaTraceAttach($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success attachment { id url } } }`;
var LegacyTraceEndpointError = class extends Error {
  constructor(status) {
    super(`POST /api/traces returned HTTP ${status}`);
    this.status = status;
  }
  status;
};
async function uploadSessionTrace(trace, issues, target2, reason) {
  const fetchImpl = target2.fetchImpl ?? fetch;
  const origin = new URL(target2.graphqlUrl).origin;
  const payload = JSON.stringify({ trace, issues: [...issues], ...reason ? { reason } : {} });
  const bytes = Buffer.byteLength(JSON.stringify(trace));
  const signal = () => AbortSignal.timeout(target2.timeoutMs ?? 3e4);
  const headers = {
    authorization: `Bearer ${target2.token}`,
    "content-type": "application/json",
    "x-hoja-actor": "agent",
    "x-hoja-session-id": trace.session.id
  };
  const res = await fetchImpl(`${origin}/api/traces`, { method: "POST", headers, body: payload, signal: signal() });
  if (res.status === 404 || res.status === 405) throw new LegacyTraceEndpointError(res.status);
  const text3 = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error(`Hoja rejected the token for trace upload (HTTP ${res.status}). Check HOJA_TOKEN.`);
  if (res.status === 413) throw new Error(`the trace (${Math.round(bytes / 1024)} KB) is larger than Hoja's upload limit`);
  if (res.status >= 400) throw new Error(`Hoja trace upload failed: HTTP ${res.status} ${text3.slice(0, 200)}`);
  let parsed;
  try {
    parsed = JSON.parse(text3);
  } catch {
    throw new Error("Hoja /api/traces returned invalid JSON");
  }
  return {
    url: String(parsed?.url ?? ""),
    title: String(parsed?.title ?? traceTitle(trace, reason)),
    subtitle: String(parsed?.subtitle ?? traceSubtitle(trace)),
    bytes,
    issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
    attachments: Array.isArray(parsed?.attachments) ? parsed.attachments : []
  };
}
async function uploadTrace(trace, issue, target2, reason) {
  try {
    const res = await uploadSessionTrace(trace, [issue], target2, reason);
    const att = res.attachments.find((a) => a.issue.toUpperCase() === issue.toUpperCase()) ?? res.attachments[0];
    if (!att && !res.url) throw new Error(`Hoja did not attach the trace to ${issue} (issue not found or not visible to this token)`);
    return { issue, url: att?.url ?? res.url, attachmentId: att?.id, title: att?.title ?? res.title, subtitle: att?.subtitle ?? res.subtitle, bytes: res.bytes };
  } catch (error) {
    if (!(error instanceof LegacyTraceEndpointError)) throw error;
  }
  const fetchImpl = target2.fetchImpl ?? fetch;
  const origin = new URL(target2.graphqlUrl).origin;
  const body = JSON.stringify(trace);
  const name = traceTitle(trace, reason);
  const auth = { authorization: `Bearer ${target2.token}`, "x-hoja-actor": "agent", "x-hoja-session-id": trace.session.id };
  const signal = () => AbortSignal.timeout(target2.timeoutMs ?? 3e4);
  const form = new FormData();
  form.append("file", new Blob([body], { type: "application/json" }), name);
  const uploaded = await fetchImpl(`${origin}/api/uploads`, { method: "POST", headers: auth, body: form, signal: signal() });
  const text3 = await uploaded.text();
  if (uploaded.status === 401 || uploaded.status === 403) throw new Error(`Hoja rejected the token for uploads (HTTP ${uploaded.status}). Check HOJA_TOKEN.`);
  if (uploaded.status === 413) throw new Error(`the trace (${Math.round(body.length / 1024)} KB) is larger than Hoja's upload limit`);
  if (uploaded.status >= 400) throw new Error(`Hoja upload failed: HTTP ${uploaded.status} ${text3.slice(0, 200)}`);
  let url;
  try {
    url = JSON.parse(text3)?.url;
  } catch {
  }
  if (typeof url !== "string" || !url) throw new Error("Hoja upload answered without a file url");
  const subtitle = traceSubtitle(trace);
  const attached = await fetchImpl(target2.graphqlUrl, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    signal: signal(),
    body: JSON.stringify({ query: ATTACH, variables: { input: { issueId: issue, url, title: name, subtitle } } })
  });
  const answer = await attached.text();
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    throw new Error(`Hoja attachmentCreate answered HTTP ${attached.status}`);
  }
  if (parsed?.errors?.length) throw new Error(`Hoja attachmentCreate: ${parsed.errors[0]?.message ?? "error"}`);
  if (!parsed?.data?.attachmentCreate?.success) throw new Error(`Hoja did not attach the trace to ${issue} (issue not found or not visible to this token)`);
  return { issue, url, attachmentId: parsed.data.attachmentCreate.attachment?.id, title: name, subtitle, bytes: body.length };
}
var flushPath = (dataDir2, sessionId) => join7(tracesDir(dataDir2), `${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.flush.json`);
function readFlushState(dataDir2, sessionId) {
  const path = flushPath(dataDir2, sessionId);
  if (!existsSync6(path)) return void 0;
  try {
    const v = JSON.parse(readFileSync8(path, "utf8"));
    return typeof v?.lastSpanCount === "number" && Array.isArray(v?.lastIssues) ? v : void 0;
  } catch {
    return void 0;
  }
}
function writeFlushState(dataDir2, sessionId, state) {
  mkdirSync6(tracesDir(dataDir2), { recursive: true, mode: 448 });
  writeFileSync4(flushPath(dataDir2, sessionId), JSON.stringify(state), { mode: 384 });
}
var ledgerPath = (dataDir2, sessionId) => join7(tracesDir(dataDir2), `${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.uploads.json`);
function readLedger(dataDir2, sessionId) {
  const path = ledgerPath(dataDir2, sessionId);
  if (!existsSync6(path)) return [];
  try {
    const v = JSON.parse(readFileSync8(path, "utf8"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function appendLedger(dataDir2, sessionId, entry) {
  mkdirSync6(tracesDir(dataDir2), { recursive: true, mode: 448 });
  writeFileSync4(ledgerPath(dataDir2, sessionId), JSON.stringify([...readLedger(dataDir2, sessionId), entry], null, 1), { mode: 384 });
}

// src/trace/service.ts
var ISSUE = /^[A-Za-z0-9]+-\d+$/;
var TURN_SYNC_INTERVAL_MS = 3e4;
var MAX_BACKOFF_MS = 10 * 6e4;
var MAX_COMPLETION_ATTEMPTS = 3;
var TraceService = class {
  constructor(options) {
    this.options = options;
  }
  options;
  syncing = false;
  /** After a failed sync, mid-reply syncs pause (30 s, doubling, capped at 10 min); end-of-reply and session-end still try. */
  failures = 0;
  retryAt = 0;
  /** Background sync scheduling (`schedule`): one in flight, at most one queued, throttled mid-reply. */
  inFlight;
  queued;
  lastTurnSync = 0;
  get env() {
    return this.options.env ?? process.env;
  }
  build() {
    const s = this.options.session();
    if (!s.id) return void 0;
    return collectTrace({ dataDir: this.options.dataDir, sessionId: s.id, transcriptPath: s.transcriptPath, tasks: s.tasks, journal: s.entries, detail: this.options.detail, env: this.env });
  }
  /** Credentials problem in words, or "" when uploads can run. */
  uploadProblem() {
    if (!resolveHojaUrl(this.env)) return "no Hoja endpoint (set hoja_api_url or HOJA_API_URL)";
    if (!resolveHojaToken(this.env)) return "no Hoja token (set hoja_token or HOJA_TOKEN)";
    return "";
  }
  async upload(issue, reason, taskId, trace = this.build()) {
    if (!trace) throw new Error("no session is bound yet");
    const problem = this.uploadProblem();
    if (problem) throw new Error(problem);
    saveTrace(this.options.dataDir, trace);
    const result = await uploadTrace(trace, issue, { graphqlUrl: resolveHojaUrl(this.env), token: resolveHojaToken(this.env), fetchImpl: this.options.fetchImpl }, reason);
    appendLedger(this.options.dataDir, trace.session.id, { issue, at: (/* @__PURE__ */ new Date()).toISOString(), url: result.url, attachmentId: result.attachmentId, reason, taskId });
    this.options.log?.(`trace uploaded to ${issue} (${result.bytes} bytes)`);
    return result;
  }
  /** Completed tasks linked to an issue whose trace has not been uploaded in this session. */
  pendingCompletions() {
    const s = this.options.session();
    if (!s.id) return [];
    const links = hojaLinks(s.entries);
    const attempts = /* @__PURE__ */ new Map();
    const done = /* @__PURE__ */ new Set();
    for (const e of readLedger(this.options.dataDir, s.id)) {
      if (e.reason !== "completion") continue;
      const key = `${e.taskId}:${e.issue}`;
      if (e.url) done.add(key);
      else if ((attempts.set(key, (attempts.get(key) ?? 0) + 1).get(key) ?? 0) >= MAX_COMPLETION_ATTEMPTS) done.add(key);
    }
    return s.tasks.filter((t) => t?.status === "completed" && links.has(String(t.id))).map((t) => ({ taskId: String(t.id), issue: links.get(String(t.id)) })).filter((p) => !done.has(`${p.taskId}:${p.issue}`));
  }
  /** After a TaskManage call: upload the trace to each issue whose task just completed. Lines for the tool result. */
  async afterTaskManage() {
    if (this.options.upload === "off" || this.options.upload === "manual") return [];
    const pending = this.pendingCompletions();
    if (!pending.length || this.uploadProblem()) return [];
    const trace = this.build();
    const lines = [];
    const s = this.options.session();
    const first = !!s.id && !readLedger(this.options.dataDir, s.id).some((e) => e.url);
    for (const p of pending) {
      try {
        const r = await this.upload(p.issue, "completion", p.taskId, trace);
        lines.push(`Hoja trace: attached this session's trace to ${p.issue} (${r.subtitle}).`);
        if (first && lines.length === 1) lines.push(this.contentNotice());
      } catch (error) {
        lines.push(`Hoja trace: could not attach the trace to ${p.issue}: ${error.message}. Run /hoja:trace upload ${p.issue} to retry.`);
        const s2 = this.options.session();
        if (s2.id) appendLedger(this.options.dataDir, s2.id, { issue: p.issue, at: (/* @__PURE__ */ new Date()).toISOString(), url: "", reason: "completion", taskId: p.taskId });
      }
    }
    return lines;
  }
  /**
   * Task-independent trace sync (turn settle / session end): if any Hoja issue was touched in this session and
   * the trace gained spans or new issues since the last upload, upsert the trace idempotently via `/api/traces`.
   */
  async syncSession(reason) {
    if (this.options.upload === "off" || this.options.upload === "manual") return [];
    if (this.syncing || this.uploadProblem()) return [];
    if (reason === "turn" && Date.now() < this.retryAt) return [];
    const trace = this.build();
    if (!trace || !trace.issues.length) return [];
    const prev = readFlushState(this.options.dataDir, trace.session.id);
    const prevIssues = new Set(prev?.lastIssues ?? []);
    const unchanged = prev && prev.lastSpanCount === trace.spans.length && trace.issues.every((i) => prevIssues.has(i));
    if (unchanged) return [];
    this.syncing = true;
    try {
      saveTrace(this.options.dataDir, trace);
      const target2 = { graphqlUrl: resolveHojaUrl(this.env), token: resolveHojaToken(this.env), fetchImpl: this.options.fetchImpl };
      const out = [];
      try {
        const res = await uploadSessionTrace(trace, trace.issues, target2, reason === "reply" ? "turn" : reason);
        this.failures = 0;
        this.retryAt = 0;
        for (const att of res.attachments) {
          appendLedger(this.options.dataDir, trace.session.id, {
            issue: att.issue,
            at: (/* @__PURE__ */ new Date()).toISOString(),
            url: att.url,
            attachmentId: att.id,
            reason
          });
          out.push(`Hoja trace: ${att.updated ? "updated" : "attached"} session trace on ${att.issue} (${att.subtitle}).`);
        }
        writeFlushState(this.options.dataDir, trace.session.id, {
          lastSpanCount: trace.spans.length,
          lastIssues: [.../* @__PURE__ */ new Set([...prevIssues, ...trace.issues])],
          at: (/* @__PURE__ */ new Date()).toISOString()
        });
        return out;
      } catch (error) {
        if (!(error instanceof LegacyTraceEndpointError)) {
          this.failures++;
          this.retryAt = Date.now() + Math.min(MAX_BACKOFF_MS, 3e4 * 2 ** (this.failures - 1));
          this.options.log?.(`session trace sync failed (${reason}, attempt ${this.failures}): ${error.message}`);
          return [];
        }
        const uploaded = new Set(readLedger(this.options.dataDir, trace.session.id).filter((e) => e.url).map((e) => e.issue));
        for (const issue of trace.issues) {
          if (uploaded.has(issue)) continue;
          try {
            const r = await uploadTrace(trace, issue, target2, reason);
            appendLedger(this.options.dataDir, trace.session.id, { issue, at: (/* @__PURE__ */ new Date()).toISOString(), url: r.url, attachmentId: r.attachmentId, reason });
            out.push(`Hoja trace: attached this session's trace to ${issue} (${r.subtitle}).`);
          } catch (err) {
            this.options.log?.(`trace fallback failed for ${issue}: ${err.message}`);
          }
        }
        writeFlushState(this.options.dataDir, trace.session.id, {
          lastSpanCount: trace.spans.length,
          lastIssues: [.../* @__PURE__ */ new Set([...prevIssues, ...trace.issues])],
          at: (/* @__PURE__ */ new Date()).toISOString()
        });
        return out;
      }
    } finally {
      this.syncing = false;
    }
  }
  /**
   * Sync in the background, off the hook's critical path (HOJA-757: an awaited sync on every PostToolBatch made the
   * hook 7–15x slower and grew with the trace). "turn" (a tool batch settled) is throttled to one per
   * TURN_SYNC_INTERVAL_MS; "reply" (the agent ended its reply) always runs, so the issue sees each reply's final
   * state. One sync runs at a time; requests that arrive meanwhile collapse into one follow-up.
   */
  schedule(kind) {
    if (this.options.upload === "off" || this.options.upload === "manual") return;
    const interval = Number(this.env.HOJA_TRACE_SYNC_INTERVAL_MS ?? TURN_SYNC_INTERVAL_MS);
    if (kind === "turn" && Date.now() - this.lastTurnSync < (Number.isFinite(interval) ? interval : TURN_SYNC_INTERVAL_MS)) return;
    if (this.inFlight) {
      if (kind === "reply" || !this.queued) this.queued = kind;
      return;
    }
    this.lastTurnSync = Date.now();
    this.inFlight = this.syncSession(kind).then(() => void 0, (error) => this.options.log?.(`trace sync failed: ${error.message}`)).finally(() => {
      this.inFlight = void 0;
      const next = this.queued;
      this.queued = void 0;
      if (next) {
        this.lastTurnSync = 0;
        this.schedule(next);
      }
    });
  }
  /** Resolves once no background sync is running or queued (tests, SessionEnd). */
  async idle() {
    while (this.inFlight) await this.inFlight;
  }
  contentNotice() {
    return this.options.detail === "full" ? "It includes full content (prompts, tool inputs and outputs, model responses) with secrets scrubbed; set trace_detail to metadata to send only timings, statuses and token counts." : "It includes timings, statuses and token counts only (trace_detail: metadata).";
  }
  /** `/hoja:trace [summary|upload [ISSUE]|path]` and the `hoja_trace` tool share this. */
  async run(args) {
    const [verb = "summary", target2] = args.trim().split(/\s+/).filter(Boolean);
    const trace = this.build();
    if (!trace) return "No session is bound yet; send a prompt first.";
    const path = saveTrace(this.options.dataDir, trace);
    const uploads = readLedger(this.options.dataDir, trace.session.id).filter((e) => e.url);
    if (verb === "path") return path;
    if (verb === "upload") {
      const issues = target2 ? [target2.toUpperCase()] : trace.issues;
      if (!issues.length) return "No issue to attach the trace to: this session's tasks are not linked to Hoja issues. Name one: /hoja:trace upload HOJA-123";
      const bad = issues.find((i) => !ISSUE.test(i));
      if (bad) return `"${bad}" is not an issue identifier (expected TEAM-123).`;
      const out = [];
      for (const issue of issues) {
        try {
          const r = await this.upload(issue, "manual", void 0, trace);
          out.push(`\u2713 ${issue}: ${r.title} \u2014 ${r.subtitle}`);
        } catch (error) {
          out.push(`\u2717 ${issue}: ${error.message}`);
        }
      }
      return [...out, this.contentNotice()].join("\n");
    }
    const footer = this.options.upload === "off" ? "Uploads are off (trace_upload)." : this.uploadProblem() ? `Uploads unavailable: ${this.uploadProblem()}.` : this.options.upload === "manual" ? "Uploads are manual: /hoja:trace upload [ISSUE]." : `Uploads: automatic on ${this.options.upload === "session-end" ? "task completion and session end" : "task completion"}; now: /hoja:trace upload [ISSUE].`;
    return `${renderSummary(trace, { path, uploads })}

${footer}`;
  }
};

// src/runtime.ts
var TASK_MANAGER_SYMBOL = /* @__PURE__ */ Symbol.for("pi-swarm-task-manager");
var alias = (name) => typeof name === "string" && canonicalToolName(name) !== name ? canonicalToolName(name) : void 0;
var toolAliases = new Proxy({}, {
  get: (_target, name) => {
    const a = alias(name);
    return a ? [a] : void 0;
  },
  has: (_target, name) => alias(name) !== void 0
});
function createRuntime(options) {
  const shim2 = new PiShim(options);
  const manager = registerTaskManage(shim2.api, taskManageRenderers, { workspaceRoot: options.cwd, toolAliases, evidenceRoots: shim2.evidenceRoots });
  globalThis[TASK_MANAGER_SYMBOL] = manager;
  const tracing = options.trace?.enabled !== false;
  const recorder = tracing ? new TraceRecorder({ dataDir: options.dataDir, detail: options.trace?.detail, log: options.log }) : void 0;
  const bridge2 = new HookBridge(shim2, manager, { ...options, recorder });
  const extraHeaders = () => ({ "x-hoja-actor": "agent", ...shim2.sessionId ? { "x-hoja-session-id": shim2.sessionId } : {} });
  const traceCredentials = options.trace?.env ? new Credentials({ ...options.trace.env }) : credentials;
  const traces = new TraceService({
    dataDir: options.dataDir,
    upload: tracing ? options.trace?.upload ?? "completion" : "off",
    detail: options.trace?.detail ?? "full",
    // Uploads go through the same credential as everything else: a CLI sign-in's token is refreshed before expiry
    // and once after a 401 (src/credentials.ts).
    env: options.trace?.env,
    fetchImpl: options.trace?.fetchImpl ?? authFetch(traceCredentials, void 0, extraHeaders),
    log: options.log,
    session: () => ({ id: shim2.sessionId, transcriptPath: shim2.transcript.path, entries: shim2.branch(), tasks: manager.snapshot().tasks })
  });
  registerTaskHooks(shim2.api, manager, { enforcementMode: "off", silent: true });
  shim2.api.registerCommand("tasks", { description: "Show the read-only task board", handler: () => taskBoard(manager) });
  if (options.hoja !== false) {
    const client = options.hojaClient ?? new HojaClient({ fetch: authFetch(credentials, void 0, extraHeaders) });
    registerHojaMode(shim2.api, client);
  }
  shim2.api.on("tool_result", async (event) => {
    if (event?.toolName !== "TaskManage" || event.isError) return void 0;
    const lines = await traces.afterTaskManage();
    return lines.length ? { content: [...event.content ?? [], { type: "text", text: lines.join("\n") }] } : void 0;
  });
  shim2.api.on("turn_end", () => {
    traces.schedule("turn");
  });
  shim2.api.on("agent_settle", () => {
    traces.schedule("reply");
  });
  shim2.api.registerCommand("trace", {
    description: "Session trace: summary (default), upload [ISSUE], path",
    handler: (args) => traces.run(args)
  });
  shim2.api.registerTool({
    name: "hoja_trace",
    label: "Hoja session trace",
    description: `This session's trace (turns, model calls with token usage, every tool call with its duration and outcome, gate blocks, subagents). action "summary" (default, read-only) returns a readable summary and saves the hoja.trace/v1 JSON locally; "path" returns that file's path; "upload" attaches the trace to a Hoja issue (\`issue\`, e.g. HOJA-123, or every issue this session's tasks are linked to). Completed tasks linked to an issue get their trace attached automatically, so call upload only when asked or for an unlinked issue.`,
    parameters: { type: "object", properties: { action: { type: "string", enum: ["summary", "path", "upload"] }, issue: { type: "string", description: "Issue identifier for upload, e.g. HOJA-123" } }, additionalProperties: false },
    execute: async (_id, params) => ({ content: [{ type: "text", text: await traces.run(`${params?.action ?? "summary"} ${params?.issue ?? ""}`) }], details: {} })
  });
  const setupReport = async (ctx = shim2.ctx()) => {
    const hoja = shim2.commands.get("hoja");
    const before = shim2.notifications.length;
    if (hoja) await hoja.handler("status", ctx);
    const mode = shim2.notifications.slice(before).map((n) => n.message).join(" ");
    shim2.notifications.length = before;
    const detail = (options.trace?.detail ?? "full") === "full" ? "full (whole prompts, tool inputs and outputs, secrets scrubbed; trace_detail: metadata to opt out)" : "metadata (timings, statuses, token counts)";
    const trace = tracing ? `Session traces: upload ${options.trace?.upload ?? "completion"}, detail ${detail}${traces.uploadProblem() ? ` (uploads unavailable: ${traces.uploadProblem()})` : ""}` : "Session traces: off";
    return [`Task enforcement: ${options.enforcementMode ?? "block"}`, ...await hojaDoctor(), mode && `Hoja mode: ${mode}`, trace].filter(Boolean).join("\n");
  };
  shim2.api.registerCommand("setup", {
    description: "Check Hoja credentials, endpoints, project and task enforcement",
    handler: (_args, ctx) => setupReport(ctx)
  });
  shim2.api.registerTool({
    name: "hoja_setup",
    label: "Hoja setup check",
    description: "Read-only health check for this plugin: task enforcement mode, Hoja credential sources, the GraphQL endpoint and the hosted MCP endpoint, Hoja mode for this chat and the task board. Prints the same report as /hoja:setup. Call it when /hoja:setup did not answer locally, and show its output verbatim.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async (_id, _params, _signal, _onUpdate, ctx) => ({ content: [{ type: "text", text: await setupReport(ctx ?? shim2.ctx()) }], details: {} })
  });
  return { shim: shim2, manager, bridge: bridge2, traces };
}
async function hojaDoctor(env = process.env, probe = fetch) {
  const graphql = resolveHojaUrl(env);
  const token = resolveHojaToken(env);
  const tokenSource = env === process.env && credentials.source === "hoja-cli" ? `hoja auth login${credentials.workspace ? `, ${credentials.workspace}` : ""}` : ["HOJA_TOKEN", "LINEAR_TOKEN"].find((name) => env[name]?.trim());
  const lines = [
    `Token: ${token ? `set (from ${tokenSource}${env.HOJA_PLUGIN_TOKEN?.trim() ? ", plugin userConfig" : ""})` : `${MISSING_HOJA_TOKEN}. ${SIGN_IN_HINT}`}`,
    ...env === process.env ? credentials.problems.map((problem) => `\u2717 ${problem}`) : [],
    `GraphQL endpoint: ${graphql || HOJA_ENDPOINT_HINT}`
  ];
  if (graphql && token) {
    try {
      const r = await probe(graphql, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ query: "query { viewer { name } }" }), signal: AbortSignal.timeout(1e4) });
      const name = r.status === 200 ? JSON.parse(await r.text())?.data?.viewer?.name : void 0;
      lines.push(name ? `  \u2713 signed in as ${name}` : `  \u2717 HTTP ${r.status}`);
    } catch (error) {
      lines.push(`  \u2717 ${error.message}`);
    }
  }
  const mcp = resolveMcpUrl(env);
  lines.push(`Hoja API MCP endpoint (hoja-api server): ${mcp || "not configured (set HOJA_MCP_URL or a GraphQL endpoint)"}`);
  if (mcp && token) {
    try {
      const result = await new UpstreamMcp(mcp, token, probe).send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "hoja-setup", version: "0" } });
      lines.push(`  \u2713 ${result?.serverInfo?.name ?? "server"} ${result?.serverInfo?.version ?? ""}`.trimEnd());
    } catch (error) {
      lines.push(`  \u2717 ${error.message}`);
    }
  }
  return lines;
}
var plain = { fg: (_c, t) => t, bold: (t) => t, dim: (t) => t };
function taskBoard(manager, width = 100) {
  const tasks = manager.snapshot().tasks.filter((t) => t.status !== "deleted");
  const widget = taskWidgetRenderer(tasks, plain).render(width);
  const icon2 = (s) => s === "completed" ? "\u2713" : s === "in_progress" ? "\u25C9" : "\u25CB";
  const all = tasks.map((t) => `  ${icon2(t.status)} #${t.id}${t.parentTaskId ? ` (child of #${t.parentTaskId})` : ""} ${t.subject} [${t.status}${t.active ? ", active" : ""}]`);
  return [...widget, "", "All tasks:", ...all.length ? all : ["  (none)"]].join("\n");
}

// src/agy-socket.ts
import { createConnection, createServer } from "node:net";
import { chmodSync, existsSync as existsSync7, mkdirSync as mkdirSync7, readFileSync as readFileSync9, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join8 } from "node:path";
var uid = () => typeof process.getuid === "function" ? process.getuid() : "user";
var socketDir = (env = process.env) => env.HOJA_AGY_SOCKET_DIR?.trim() || join8(tmpdir(), `hoja-agy-${uid()}`);
var socketPath = (agyPid, env = process.env) => join8(socketDir(env), `${agyPid}.sock`);
function listen(path, handle, log2) {
  mkdirSync7(join8(path, ".."), { recursive: true, mode: 448 });
  try {
    chmodSync(join8(path, ".."), 448);
  } catch {
  }
  try {
    unlinkSync(path);
  } catch {
  }
  const server = createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", async (chunk) => {
      buffer += chunk;
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      const line = buffer.slice(0, end);
      buffer = "";
      let reply;
      try {
        reply = await handle(JSON.parse(line));
      } catch (error) {
        log2?.(`agy hook failed: ${error.message}`);
        reply = { error: error.message };
      }
      socket.end(JSON.stringify(reply ?? {}) + "\n");
    });
    socket.on("error", () => {
    });
  });
  server.listen(path, () => {
    try {
      chmodSync(path, 384);
    } catch {
    }
  });
  const cleanup = () => {
    try {
      unlinkSync(path);
    } catch {
    }
  };
  process.once("exit", cleanup);
  return server;
}

// src/server.ts
var HOOK_TOOL = "__hoja_hook";
var send = (message) => process.stdout.write(JSON.stringify(message) + "\n");
var debugLog = process.env.HOJA_DEBUG_LOG?.trim();
var log = (line) => {
  process.stderr.write(`[hoja] ${line}
`);
  if (debugLog) try {
    appendFileSync3(debugLog, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}
`);
  } catch {
  }
};
applyCredentials();
var elicitation = false;
var nextRequest = 0;
var waiting = /* @__PURE__ */ new Map();
var request = (method, params) => new Promise((resolve4) => {
  const id = `hoja-${nextRequest++}`;
  waiting.set(id, resolve4);
  send({ jsonrpc: "2.0", id, method, params });
});
var confirm = async (title, message) => {
  const result = await request("elicitation/create", {
    message: `${title}

${message}`,
    requestedSchema: { type: "object", properties: { confirm: { type: "boolean", title: "Confirm", description: title } }, required: ["confirm"] }
  });
  return result?.action === "accept" && result?.content?.confirm === true;
};
var runtime = createRuntime({
  dataDir: dataDir(),
  cwd: process.env.CLAUDE_PROJECT_DIR?.trim() || process.cwd(),
  log,
  confirm: (title, message) => elicitation ? confirm(title, message) : Promise.resolve(false),
  enforcementMode: enforcementMode(),
  headless: headless(),
  autogenSkills: truthy(process.env.HOJA_AUTOGEN_SKILLS),
  hoja: !truthy(process.env.HOJA_PLUGIN_DISABLE_HOJA),
  trace: { upload: traceUpload(), detail: traceDetail() }
});
if (debugLog) log(`start host=${hostOf()} dataDir=${dataDir()} enforcement=${enforcementMode()} headless=${headless()}`);
var { shim, bridge } = runtime;
var calls = 0;
if (hostOf() === "antigravity") listen(socketPath(process.ppid), async (message) => {
  const event = String(message?.event ?? "");
  const out = await bridge.handle(event, message?.payload ?? {});
  if (event === "Stop") setImmediate(() => {
    runtime.traces.idle().then(() => runtime.traces.run("path")).catch((error) => log(`trace sync failed: ${error.message}`));
  });
  return out;
}, log);
async function callTool(name, args, signal, meta) {
  const conversation = meta?.["antigravity.google/conversation_id"];
  if (typeof conversation === "string" && conversation && conversation !== shim.sessionId) {
    const artifacts = meta?.["antigravity.google/artifacts_dir"];
    await shim.bindSession(conversation, typeof artifacts === "string" ? transcriptFromArtifacts(artifacts) : void 0);
  }
  if (name === HOOK_TOOL) {
    const output = await bridge.handle(String(args.event ?? ""), args);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  }
  const tool = shim.tools.get(name);
  if (!tool) return { content: [{ type: "text", text: `Error: Tool '${name}' not found` }], isError: true };
  const toolCallId = bridge.takeToolCallId(name) ?? `hoja-call-${++calls}`;
  let result;
  try {
    result = await tool.execute(toolCallId, args, signal, void 0, shim.ctx());
  } catch (error) {
    result = { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], details: error?.details, isError: true };
  }
  const isError = result?.isError === true;
  const content = await shim.emitToolResult({ toolName: name, toolCallId, input: args, content: Array.isArray(result?.content) ? result.content : [], details: result?.details, isError });
  return { content: content.filter((part) => part?.type === "text").map((part) => ({ type: "text", text: String(part.text) })), isError };
}
var inflight = /* @__PURE__ */ new Map();
async function onMessage(message) {
  if (message.id !== void 0 && message.method === void 0) {
    waiting.get(String(message.id))?.(message.result ?? { action: "cancel" });
    waiting.delete(String(message.id));
    return;
  }
  const { id, method, params } = message;
  if (debugLog) log(`<- ${method ?? "response"}${method === "tools/call" ? ` ${params?.name} ${JSON.stringify(params?.arguments ?? {}).slice(0, 400)}` : ""}`);
  try {
    if (method === "initialize") {
      elicitation = !!params?.capabilities?.elicitation;
      return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "hoja", version: PLUGIN_VERSION } } });
    }
    if (method === "tools/list") {
      const tools = [...shim.tools.values()].map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.parameters, _meta: { "anthropic/alwaysLoad": true } }));
      return send({ jsonrpc: "2.0", id, result: { tools } });
    }
    if (method === "tools/call") {
      const controller = new AbortController();
      inflight.set(id, controller);
      try {
        return send({ jsonrpc: "2.0", id, result: await callTool(String(params?.name), params?.arguments ?? {}, controller.signal, params?._meta) });
      } finally {
        inflight.delete(id);
      }
    }
    if (method === "notifications/cancelled") {
      inflight.get(params?.requestId)?.abort();
      return;
    }
    if (id === void 0) return;
    if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (error) {
    log(`${method} failed: ${error.stack ?? error}`);
    if (id !== void 0) send({ jsonrpc: "2.0", id, error: { code: -32603, message: error.message } });
  }
}
createInterface2({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  void onMessage(message);
}).on("close", async () => {
  await shim.emit("session_shutdown");
  process.exit(0);
});
export {
  HOOK_TOOL
};
