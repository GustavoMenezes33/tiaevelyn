import type { ILlmProvider } from '../llm/ILlmProvider.js';
import type { SkillMetadata } from './SkillLoader.js';
import { Logger } from '../utils/Logger.js';

/** Valor que o router devolve quando nenhuma skill se aplica. */
const NO_SKILL = 'none';

/** A última resposta terminou com perguntas desta skill; a mensagem atual pode ser a resposta. */
export interface PendingReplyHint {
  skill: SkillMetadata;
  lastReply: string;
}

/**
 * "Passo zero": chamada barata ao LLM que recebe só os metadados das skills
 * e a mensagem do usuário, e decide qual skill (ou nenhuma) usar.
 */
export class SkillRouter {
  private readonly logger = new Logger('SkillRouter');

  constructor(private readonly provider: ILlmProvider) {}

  async route(userMessage: string, skills: SkillMetadata[], pending?: PendingReplyHint): Promise<SkillMetadata | null> {
    if (skills.length === 0) return null;

    const catalog = skills.map((s) => `- ${s.name}: ${s.description || '(sem descrição)'}`).join('\n');
    let system =
      'Você é um roteador de intenções. Dada a mensagem do usuário e a lista de skills disponíveis, ' +
      'escolha a skill mais adequada ou nenhuma.\n' +
      'Responda APENAS com um objeto JSON no formato exato: {"skillName": "<nome-da-skill>"} ou {"skillName": "none"}.\n' +
      'Use "none" quando a mensagem for conversa casual ou nenhuma skill se aplicar claramente.\n\n' +
      `Skills disponíveis:\n${catalog}`;
    if (pending) {
      system +=
        `\n\nContexto: a última resposta da professora (skill "${pending.skill.name}") terminou com perguntas ou ` +
        `exercícios para o aluno. Trecho final dela:\n<ultima_resposta>\n${pending.lastReply.slice(-800)}\n</ultima_resposta>\n` +
        `Se a mensagem do aluno for a resposta a essas perguntas, mesmo curta ou só numerada, escolha "${pending.skill.name}". ` +
        'Se for um pedido novo, escolha normalmente.';
    }

    // Provedores com saída estruturada (Anthropic) ficam restritos aos nomes válidos.
    const jsonSchema = {
      type: 'object',
      properties: { skillName: { type: 'string', enum: [...skills.map((s) => s.name), NO_SKILL] } },
      required: ['skillName'],
      additionalProperties: false,
    };

    try {
      const response = await this.provider.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: userMessage.slice(0, 4000) },
        ],
        { jsonMode: true, jsonSchema, temperature: 0, effort: 'low' },
      );
      const chosen = SkillRouter.parseSkillName(response.content);
      const skill = chosen ? (skills.find((s) => s.name === chosen) ?? null) : null;
      this.logger.info(`Skill escolhida: ${skill?.name ?? 'nenhuma'}`);
      return skill;
    } catch (err) {
      // RF-02: qualquer falha (parse ou API) vira null -> chatbot casual; com pergunta em aberto, segue com a skill dela.
      const fallback = pending?.skill ?? null;
      this.logger.warn(`Router falhou, seguindo com ${fallback?.name ?? 'nenhuma skill'}: ${err instanceof Error ? err.message : err}`);
      return fallback;
    }
  }

  private static parseSkillName(content: string | null): string | null {
    if (!content) return null;
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const parsed = JSON.parse(json) as { skillName?: unknown };
    const name = typeof parsed.skillName === 'string' ? parsed.skillName.trim() : '';
    return name && name !== NO_SKILL ? name : null;
  }
}
