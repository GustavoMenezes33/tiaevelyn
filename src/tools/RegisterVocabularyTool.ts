import { BaseTool, type ToolExecutionContext, type ToolResult } from './BaseTool.js';
import type { VocabularyItem } from '../memory/VocabularyRepository.js';

/** O que a ferramenta precisa da memória (o MemoryManager atende). */
export interface VocabularyStore {
  addVocabulary(userId: string, items: VocabularyItem[], source: string): number;
  countVocabulary(userId: string): number;
}

const MAX_ITEMS = 15;
const SOURCES = ['reading', 'vocabulary', 'writing', 'grammar', 'conversa'] as const;

/** Guarda palavras e expressões novas no caderno de vocabulário do aluno. */
export class RegisterVocabularyTool extends BaseTool {
  readonly name = 'registrar_vocabulario';
  readonly description =
    'Registra no caderno do aluno as palavras e expressões novas que você acabou de ensinar ' +
    `(máx. ${MAX_ITEMS} por chamada). Termos já registrados são ignorados.`;
  readonly parameters = {
    type: 'object',
    properties: {
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            termo: { type: 'string', description: 'Palavra ou expressão em inglês, ex.: "look forward to".' },
            significado: { type: 'string', description: 'Significado curto em português.' },
            exemplo: { type: 'string', description: 'Frase de exemplo em inglês.' },
          },
          required: ['termo', 'significado'],
        },
      },
      fonte: { type: 'string', enum: [...SOURCES], description: 'Skill ou situação em que os termos apareceram.' },
    },
    required: ['itens'],
  };

  constructor(private readonly store: VocabularyStore) {
    super();
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!Array.isArray(args.itens) || args.itens.length === 0) throw new Error('"itens" deve ser uma lista não vazia.');

    const items: VocabularyItem[] = [];
    for (const raw of args.itens.slice(0, MAX_ITEMS)) {
      const item = (raw ?? {}) as Record<string, unknown>;
      const term = RegisterVocabularyTool.clean(item.termo, 60);
      const meaning = RegisterVocabularyTool.clean(item.significado, 120);
      if (!term || !meaning) continue;
      items.push({ term, meaning, example: RegisterVocabularyTool.clean(item.exemplo, 200) || undefined });
    }
    if (!items.length) throw new Error('Cada item precisa de "termo" e "significado".');

    const source = SOURCES.includes(args.fonte as (typeof SOURCES)[number]) ? (args.fonte as string) : 'conversa';
    const added = this.store.addVocabulary(context.userId, items, source);
    const total = this.store.countVocabulary(context.userId);
    return {
      output: `${added} termo(s) novo(s) registrado(s), ${items.length - added} já existia(m). Caderno: ${total} termo(s) no total.`,
    };
  }

  private static clean(value: unknown, max: number): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }
}
