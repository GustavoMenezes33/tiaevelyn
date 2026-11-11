import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { Logger } from '../utils/Logger.js';

export interface SkillMetadata {
  name: string;
  description: string;
  /** Caminho absoluto do SKILL.md. */
  filePath: string;
  /**
   * `expects_reply: true` no frontmatter: a skill termina fazendo perguntas, então a próxima
   * mensagem do aluno volta direto para ela, sem passar pelo roteador (vale uma vez).
   */
  expectsReply: boolean;
}

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Lê `.agents/skills/<pasta>/SKILL.md` de forma síncrona a cada requisição,
 * o que garante hot-reload sem reiniciar o processo.
 */
export class SkillLoader {
  private readonly logger = new Logger('SkillLoader');

  constructor(private readonly skillsDir: string) {}

  /** Carrega os metadados (frontmatter) de todas as skills instaladas. */
  loadAll(): SkillMetadata[] {
    if (!fs.existsSync(this.skillsDir)) return [];

    const skills = new Map<string, SkillMetadata>();
    for (const entry of fs.readdirSync(this.skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const filePath = path.join(this.skillsDir, entry.name, 'SKILL.md');
      // EC-02: pasta sem SKILL.md é ignorada silenciosamente.
      if (!fs.existsSync(filePath)) continue;

      const metadata = this.readMetadata(filePath);
      if (!metadata) continue;

      // EC-01: nome duplicado -> a última sobrescreve a anterior.
      if (skills.has(metadata.name)) {
        this.logger.warn(`Skill duplicada "${metadata.name}" (${entry.name}) sobrescreveu a anterior.`);
      }
      skills.set(metadata.name, metadata);
    }
    return [...skills.values()];
  }

  /** Retorna as instruções completas da skill (sem o frontmatter). */
  loadContent(skill: SkillMetadata): string {
    return fs.readFileSync(skill.filePath, 'utf8').replace(FRONTMATTER, '').trim();
  }

  private readMetadata(filePath: string): SkillMetadata | null {
    try {
      const match = fs.readFileSync(filePath, 'utf8').match(FRONTMATTER);
      if (!match) return null; // EC-03: sem frontmatter.

      const data = parseYaml(match[1]!) as Record<string, unknown> | null;
      const name = typeof data?.name === 'string' ? data.name.trim() : '';
      if (!name) return null;

      const description = typeof data?.description === 'string' ? data.description.trim() : '';
      return { name, description, filePath, expectsReply: data?.expects_reply === true };
    } catch {
      // EC-03: YAML malformado -> rejeita só esta skill, sem log fatal.
      this.logger.debug(`Frontmatter inválido em ${filePath}; skill ignorada.`);
      return null;
    }
  }
}
