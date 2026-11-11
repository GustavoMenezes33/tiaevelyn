import { BaseTool, type ToolResult } from './BaseTool.js';

/** Informa data e hora locais da máquina host. */
export class CurrentDateTimeTool extends BaseTool {
  readonly name = 'data_hora_atual';
  readonly description = 'Retorna a data, a hora e o dia da semana atuais (horário local).';
  readonly parameters = { type: 'object', properties: {} };

  async execute(): Promise<ToolResult> {
    const now = new Date();
    const formatted = now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
    return { output: `${formatted} (ISO: ${now.toISOString()})` };
  }
}
