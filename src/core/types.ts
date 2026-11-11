import type { OutputFile } from '../tools/BaseTool.js';

export type InputSource = 'text' | 'document' | 'voice';

/** Entrada já normalizada em texto pelo TelegramInputHandler. */
export interface AgentInput {
  userId: string;
  /** Primeiro nome do perfil do Telegram, para personalizar as respostas. */
  userName?: string;
  text: string;
  source: InputSource;
  /** RF-06 (input): resposta deve ser enviada em áudio (TTS). */
  requiresAudioReply: boolean;
  /** Voz usada no TTS quando `requiresAudioReply` for true. */
  voiceId?: string;
  /** Pula o roteador e executa esta skill (ex.: comando /nivelamento). */
  forceSkill?: string;
}

/** Resultado final do pipeline, consumido pelo TelegramOutputHandler. */
export interface AgentOutput {
  text: string;
  files: OutputFile[];
  isAudio: boolean;
  voiceId?: string;
  isError: boolean;
}
