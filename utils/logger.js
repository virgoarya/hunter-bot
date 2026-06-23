/**
 * Simple logger with level support. In production you can replace this with a library like pino or winston.
 */
const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';

function shouldLog(level) {
  return levels[level] >= levels[currentLevel];
}

function format(msg, meta) {
  if (!meta) return msg;
  try {
    return `${msg} ${JSON.stringify(meta)}`;
  } catch (_) {
    return msg;
  }
}

module.exports = {
  debug: (msg, meta) => { if (shouldLog('debug')) console.debug('[DEBUG]', format(msg, meta)); },
  info:  (msg, meta) => { if (shouldLog('info'))  console.info('[INFO]',  format(msg, meta)); },
  warn:  (msg, meta) => { if (shouldLog('warn'))  console.warn('[WARN]',  format(msg, meta)); },
  error: (msg, meta) => { if (shouldLog('error')) console.error('[ERROR]', format(msg, meta)); },
};
