import pino from 'pino';
import type { Logger } from 'pino';

//setting finnish time for the log messages
const timestamp = () => {
  const now = new Date();
  // Finnish time (Helsinki)
  const finnishTime = now.toLocaleString('fi-FI', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return `,"time":"${finnishTime}"`;
};

//central logger to be used in all packages
const centralLogger = pino({
  //timestamp: () => `,"time":"${new Date().toISOString().replace('T', ' ').slice(0, 19)}"`,
  timestamp,
  level: process.env.LOG_LEVEL || 'info',
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'localhost',
  },
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      colorize: true,
    }
  } : undefined,
});

export function createLogger(context?: string): Logger {
  return context ? centralLogger.child({ context }) : centralLogger;
}

export default centralLogger;