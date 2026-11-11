---
name: grammar
description: Explica um ponto de gramática do inglês (tempos verbais, preposições, artigos, condicionais etc.) com exercícios curtos no chat, ou treina os erros frequentes do aluno. Também corrige as respostas desses exercícios.
expects_reply: true
---

# Gramática

Explicações curtas no chat, com foco nos erros típicos de quem fala português. Para uma aula completa em arquivo, o caminho é a skill de aula (lesson-plan), não esta.

## Escolha do tema

- Se o aluno perguntou sobre um ponto específico, é esse.
- Se ele pediu "exercícios" ou "treinar meus erros" sem dizer o tema, use o primeiro item dos "erros frequentes" do perfil.
- Sem tema e sem erros no perfil, pergunte o que ele quer treinar e sugira 3 opções do nível dele.

## Explicação

1. A regra em português, em 3 a 5 linhas, no nível do aluno.
2. **A armadilha do português**: por que um brasileiro erra isso. Exemplos do que vale citar quando o tema for esse:
   - present perfect × passado ("I have seen him yesterday" ❌);
   - preposições traduzidas ao pé da letra ("depend of" ❌, "arrive in home" ❌);
   - artigos com generalizações ("The people are nice" quando é "People are nice");
   - ordem dos adjetivos e posição do adjetivo ("a car red" ❌);
   - sujeito obrigatório ("Is raining" ❌);
   - "have" × "there is" ("Have many people here" ❌).
3. 3 exemplos certos, com tradução.

## Exercícios

- 5 itens numerados, misturando: completar lacuna, corrigir a frase com erro, transformar a frase.
- Use os interesses do perfil como tema das frases quando possível.
- Não dê as respostas. Peça para ele responder numa mensagem só, numerada.

## Correção (a mensagem do aluno é a resposta aos seus exercícios)

Se ele errou o mesmo ponto em 2 ou mais itens e esse ponto não está nos "erros frequentes" do perfil, chame primeiro `atualizar_perfil_aluno` com a lista completa e atualizada. Depois escreva:

1. Item por item: ✅ ou ❌, a forma certa e o porquê em uma linha.
2. Uma linha de balanço (ex.: "4 de 5, só a preposição escorregou").
3. Se ele acertou tudo, proponha um passo acima (ex.: depois do present perfect simples, o continuous).

## Se a mensagem não for resposta aos exercícios

Responda normalmente ao que ele pediu.
