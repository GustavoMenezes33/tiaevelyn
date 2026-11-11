import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { EdgeTTS } from 'edge-tts-universal';
import { Logger } from '../../../utils/Logger.js';

/** Motor de síntese de voz: grava o áudio (mp3) em `outputPath`. */
export interface ITtsEngine {
  readonly name: string;
  synthesize(text: string, voice: string, outputPath: string): Promise<void>;
}

/** Rejeita a promise se ela não terminar a tempo (a lib pode travar em handshake recusado). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Edge-TTS via biblioteca npm `edge-tts-universal` (padrão da spec). */
export class EdgeTtsUniversalEngine implements ITtsEngine {
  readonly name = 'edge-tts-universal';

  constructor(private readonly timeoutMs: number) {}

  async synthesize(text: string, voice: string, outputPath: string): Promise<void> {
    const result = await withTimeout(new EdgeTTS(text, voice).synthesize(), this.timeoutMs, this.name);
    await fs.writeFile(outputPath, Buffer.from(await result.audio.arrayBuffer()));
  }
}

/** Edge-TTS via CLI Python (`pip install edge-tts`), útil quando a lib npm estiver desatualizada. */
export class EdgeTtsCliEngine implements ITtsEngine {
  readonly name = 'edge-tts-cli';

  constructor(
    private readonly command: string,
    private readonly timeoutMs: number,
  ) {}

  synthesize(text: string, voice: string, outputPath: string): Promise<void> {
    let child: ReturnType<typeof spawn> | undefined;
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        // Texto via stdin (--file -) evita limites e escapes de linha de comando.
        const proc = spawn(this.command, ['--voice', voice, '--file', '-', '--write-media', outputPath], {
          env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
          windowsHide: true,
        });
        child = proc;
        let stderr = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString()).slice(-1000);
        });
        proc.on('error', (err) => reject(new Error(`${this.name}: não foi possível executar "${this.command}" (${err.message})`)));
        proc.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`${this.name}: código ${code}. ${stderr.trim().split('\n').pop() ?? ''}`)),
        );
        proc.stdin.end(text, 'utf8');
      }),
      EdgeTtsCliEngine.timeoutFor(text, this.timeoutMs),
      this.name,
    ).catch((err: unknown) => {
      // No timeout o processo continuaria rodando (e gravando) em segundo plano.
      if (child && child.exitCode === null) child.kill();
      throw err;
    });
  }

  /** Medido: ~1s a cada 45 caracteres (pt-BR-FranciscaNeural); TTS_TIMEOUT_MS vale como mínimo. */
  static timeoutFor(text: string, minMs: number): number {
    return Math.max(minMs, Math.ceil(text.length / 30) * 1_000 + 10_000);
  }
}

/**
 * Repete a síntese quando o Edge-TTS falha de forma intermitente (NoAudioReceived é comum
 * nas vozes "Multilingual"): uma nova tentativa com a mesma voz e, por fim, a voz reserva.
 */
export class RetryingTtsEngine implements ITtsEngine {
  private readonly logger = new Logger('TTS');

  constructor(
    private readonly inner: ITtsEngine,
    private readonly fallbackVoice: string,
  ) {}

  get name(): string {
    return this.inner.name;
  }

  async synthesize(text: string, voice: string, outputPath: string): Promise<void> {
    const attempts = voice === this.fallbackVoice ? [voice, voice] : [voice, voice, this.fallbackVoice];
    for (let i = 0; i < attempts.length; i++) {
      try {
        await this.inner.synthesize(text, attempts[i]!, outputPath);
        return;
      } catch (err) {
        // Repetir a mesma voz depois de um timeout só faria o aluno esperar de novo: vai direto à reserva.
        if (/timeout/i.test(String(err))) while (attempts[i + 1] === attempts[i]) i++;
        if (i >= attempts.length - 1) throw err;
        this.logger.warn(`Tentativa com ${attempts[i]} falhou, tentando com ${attempts[i + 1]}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}
