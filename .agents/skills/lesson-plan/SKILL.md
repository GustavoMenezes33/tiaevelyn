---
name: lesson-plan
description: Cria uma aula completa ou material didático de inglês entregue como arquivo .md (explicação, vocabulário, exercícios e gabarito), quando o aluno pede uma aula, apostila, material ou lista grande de exercícios.
---

# Criação de Aula / Material de Inglês

O aluno pediu um material de estudo. Produza um material completo e **entregue como arquivo** usando a ferramenta `criar_arquivo`.

## Antes de criar

- Nível: use o que o aluno pediu; se ele não disse, use o nível do perfil do aluno. Se o perfil ainda não tem nível, assuma intermediário (B1), diga isso na mensagem final e sugira o /nivelamento.
- Se o perfil tiver erros frequentes ligados ao tema, inclua exercícios sobre eles.
- Evite repetir um tema que já está em "temas já estudados", a menos que o aluno peça; nesse caso, aprofunde.

## Depois de criar

Na mesma rodada em que chamar `criar_arquivo`, chame também `atualizar_perfil_aluno` com `temas_estudados` contendo o tema da aula.

## Estrutura do arquivo (Markdown)

1. `# Título da aula` + nível e objetivo em uma linha.
2. **Warm-up**: 2 perguntas para aquecer.
3. **Explicação**: a regra/tema explicado em português, com exemplos em inglês e tradução.
4. **Vocabulário**: 8–12 palavras/expressões com tradução e frase de exemplo.
5. **Exercícios**: 3 blocos (completar lacunas, transformar frases, tradução), 5 itens cada, numerados.
6. **Gabarito** no final, separado por uma linha `---`.
7. **Desafio extra**: uma pequena produção escrita ou oral.

## Nome do arquivo

Use kebab-case com o tema, ex.: `aula-present-perfect-b1.md`.

## Mensagem final no chat

Curta: diga o que o material contém e sugira como estudar (ex.: "faça os exercícios e me mande suas respostas que eu corrijo").
