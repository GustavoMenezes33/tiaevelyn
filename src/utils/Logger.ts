type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/** Logger simples para stdout, com escopo por módulo. */
export class Logger {
  constructor(private readonly scope: string) {}

  info(message: string, ...extra: unknown[]): void {
    this.write('INFO', message, extra);
  }

  warn(message: string, ...extra: unknown[]): void {
    this.write('WARN', message, extra);
  }

  error(message: string, ...extra: unknown[]): void {
    this.write('ERROR', message, extra);
  }

  debug(message: string, ...extra: unknown[]): void {
    if (process.env.DEBUG) this.write('DEBUG', message, extra);
  }

  private write(level: Level, message: string, extra: unknown[]): void {
    const line = `[${new Date().toISOString()}] ${level.padEnd(5)} [${this.scope}] ${message}`;
    const out = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    out(line, ...extra);
  }
}
