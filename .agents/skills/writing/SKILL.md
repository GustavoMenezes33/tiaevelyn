---
name: writing
description: Corrige textos, frases, e-mails ou redações que o aluno escreveu em inglês, ou propõe uma tarefa de escrita (e-mail, ensaio, mensagem informal) quando ele quer praticar escrita.
---

# Escrita (Writing)

Duas situações: o aluno mandou um texto em inglês para corrigir, ou pediu uma tarefa de escrita.

## A) O aluno mandou um texto

1. Mostre a **versão corrigida** completa do texto.
2. Liste as correções agrupadas por tipo, só os grupos que tiverem itens:
   - **Gramática** (tempos verbais, concordância, preposições, artigos);
   - **Vocabulário** (palavra errada, falso cognato, collocation estranha);
   - **Coesão** (conectivos, ordem das ideias, frases longas ou cortadas demais);
   - **Tom** (formal demais ou informal demais para a situação, ex.: e-mail ao chefe).
   Cada item no formato: ❌ trecho original → ✅ trecho corrigido — explicação curta em português.
3. Se houver frases corretas, mas pouco naturais, sugira como um nativo diria (marque "mais natural").
4. Termine com:
   - um elogio sincero sobre algo que o aluno fez bem;
   - uma dica de estudo focada no erro mais frequente;
   - uma mini-tarefa: 2 ou 3 itens novos que pratiquem o erro mais frequente. Cada item precisa exigir uma ação clara do aluno:
     uma frase **com erro** para ele corrigir, uma lacuna para completar (ex.: "Yesterday I ___ (go) to the park.") ou um pedido para escrever uma frase. Diga em cada item o que fazer.
     Nunca coloque uma frase já correta sem lacuna ou pergunta, e não repita as frases originais do aluno.

## B) O aluno pediu uma tarefa de escrita

Proponha **uma** tarefa com:
- o gênero (e-mail formal, mensagem informal, ensaio curto, review, post) escolhido pelos objetivos do perfil (ex.: trabalho → e-mail profissional);
- uma situação concreta, ligada aos interesses do aluno quando possível;
- o tamanho esperado em palavras, adequado ao nível (A1–A2: 30–60; B1–B2: 80–150; C1–C2: 150–250);
- 2 ou 3 expressões úteis que ele pode tentar usar.

Diga que, quando ele mandar o texto, você corrige.

## Regras

- Não reescreva o estilo do aluno além do necessário: corrija, não substitua.
- Calibre as explicações ao nível do perfil do aluno: mais simples para A1–A2, mais técnicas para B2 em diante.
- Se o texto não tiver erros, diga isso com entusiasmo e proponha um desafio de nível acima.
- Se o erro mais frequente deste texto também apareceu antes (no histórico) e ainda não está nos "erros frequentes" do perfil,
  chame `atualizar_perfil_aluno` com a lista `erros_frequentes` completa e atualizada antes de responder. Não chame por um erro isolado.
- Se o texto for muito longo (mais de ~300 palavras), entregue a correção detalhada como arquivo usando a ferramenta `criar_arquivo` (ex.: `correcao-redacao.md`) e mande no chat apenas um resumo dos principais pontos.
