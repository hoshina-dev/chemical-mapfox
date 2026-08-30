import "server-only";

import { buildLogRecord } from "./record";
import { redact, serializeError } from "./serialize";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function envLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && LEVELS.has(raw as LogLevel)) return raw as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function prettyLogsEnabled(): boolean {
  if (process.env.LOG_PRETTY === "0") return false;
  if (process.env.LOG_PRETTY === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function formatPretty(record: Record<string, unknown>): string {
  const { level, time, msg, err, ...rest } = record;
  const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  const errPart = err === undefined ? "" : `\n  ${JSON.stringify(err)}`;
  return `${String(time)} ${String(level).toUpperCase()} ${String(msg)}${extra}${errPart}`;
}

function emit(level: LogLevel, line: string): void {
  const stream =
    typeof process !== "undefined" && process.stdout && process.stderr
      ? level === "warn" || level === "error"
        ? process.stderr
        : process.stdout
      : undefined;

  if (stream) {
    stream.write(`${line}\n`);
    return;
  }

  if (level === "debug") console.log(line);
  else console[level](line);
}

export class Logger {
  constructor(private readonly bindings: LogFields = {}) {}

  child(bindings: LogFields): Logger {
    return new Logger({ ...this.bindings, ...bindings });
  }

  debug(fieldsOrMsg: LogFields | string, msg?: string): void {
    this.write("debug", fieldsOrMsg, msg);
  }

  info(fieldsOrMsg: LogFields | string, msg?: string): void {
    this.write("info", fieldsOrMsg, msg);
  }

  warn(fieldsOrMsg: LogFields | string, msg?: string): void {
    this.write("warn", fieldsOrMsg, msg);
  }

  error(fieldsOrMsg: LogFields | string, msg?: string): void {
    this.write("error", fieldsOrMsg, msg);
  }

  write(level: LogLevel, fieldsOrMsg: LogFields | string, msg?: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[envLogLevel()]) return;

    const fields = typeof fieldsOrMsg === "string" ? {} : fieldsOrMsg;
    const message = typeof fieldsOrMsg === "string" ? fieldsOrMsg : (msg ?? "");
    const { err, ...rest } = fields;

    // Built-ins (level/time/msg) are applied by buildLogRecord AFTER these
    // fields, so a caller field literally named `level` or `time` can never
    // clobber the record's real severity/timestamp.
    const contextFields: LogFields = {
      ...(redact(this.bindings) as LogFields),
      ...(redact(rest) as LogFields),
    };
    if (err !== undefined) contextFields.err = serializeError(err);

    const record = buildLogRecord(level, contextFields, message);

    emit(level, prettyLogsEnabled() ? formatPretty(record) : JSON.stringify(record));
  }
}

/** Process-wide BFF logger. JSON lines in production; pretty-printed in dev. */
export const logger = new Logger({ app: "web" });
