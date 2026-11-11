---
name: placement-test
description: Aplica um teste de nivelamento de inglês (A1 a C2) quando o aluno quer descobrir, medir ou refazer a avaliação do seu nível de inglês.
expects_reply: true
---

# Teste de Nivelamento

O teste acontece em duas etapas. Olhe o histórico para saber em qual você está.

## Etapa 1 — aplicar o teste (o aluno pediu o teste)

Mande, em uma única mensagem:

1. Uma frase curta explicando: são 8 questões, ele deve responder **todas numa mensagem só**, numeradas; pode escrever "não sei" sem problema; não vale consultar nada.
2. Antes das questões, um item **0** (em português, pode responder em português): "Em uma ou duas frases: para que você quer o inglês (trabalho, viagem, prova...) e de que assuntos você gosta?"
3. As 8 questões, numeradas, em dificuldade crescente, **sem dizer o nível de cada uma**:
   - 1 e 2 (A1–A2): completar lacunas com verbo ou palavra simples. Ex.: "She ___ (live) in Brazil."
   - 3 e 4 (B1): passado vs. present perfect, comparativos, futuro. Ex.: "I ___ (never / be) to London."
   - 5 e 6 (B2): condicionais, voz passiva, discurso indireto, phrasal verbs comuns.
   - 7 (C1): encontrar e corrigir o erro de uma frase sofisticada, ou escolher a palavra mais precisa entre opções.
   - 8 (produção livre): escrever 3 a 5 frases em inglês sobre um tema, ex.: "Describe a trip you took and what you would do differently next time."
4. Varie as frases a cada teste; não repita os exemplos acima literalmente. Na questão 7, a frase deve ter **exatamente um** erro.

Não avalie nada nesta etapa e não chame ferramentas.

## Etapa 2 — corrigir (a mensagem anterior sua tinha as questões e agora vieram as respostas)

1. Corrija questão por questão em lista curta: ✅ ou ❌, e a forma correta quando errar.
2. Comente a produção livre (questão 8): variedade de vocabulário, precisão gramatical e complexidade das frases.
3. Estime o nível no QECR:
   - O nível é a faixa mais alta em que o aluno acertou a maior parte, confirmada pela questão 8.
   - Na dúvida entre dois níveis, fique com o mais baixo.
   - Se quase tudo veio em branco ou "não sei", o nível é A1.
4. Chame a ferramenta `atualizar_perfil_aluno` com `nivel`, `fonte: "nivelamento"`, `erros_frequentes` (até 5 pontos fracos vistos no teste, ex.: "present perfect vs. passado simples") e, se ele respondeu o item 0, `objetivos` e `interesses`. O item 0 não conta para o nível.
5. Só depois da ferramenta responder, mande a mensagem final:
   - o nível e o que ele significa em uma frase (ex.: "B1: você se vira em situações do dia a dia, mas ainda tropeça em…");
   - 2 pontos fortes e 3 focos de estudo;
   - um próximo passo concreto, ex.: "quer que eu monte uma aula sobre present perfect no seu nível?";
   - lembre que ele pode ver o perfil com /nivel.

## Se a mensagem não for a resposta do teste

Se você tinha mandado as questões, mas o aluno escreveu outra coisa (uma pergunta, outro assunto), diga em uma linha que o teste ficou para depois (ele pode recomeçar com /nivelamento) e responda normalmente ao que ele escreveu. Não estime nível nem chame a ferramenta.
