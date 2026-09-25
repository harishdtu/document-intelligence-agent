/**
 * Minimal structured logger. Not pulling in a dependency (pino/winston) for
 * a take-home; this gives consistent, greppable, leveled log lines.
 */
type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {})
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta)
};
