# Roteiro de apresentação: TiaEvelyn 👩‍🏫

**Duração sugerida:** 15 a 20 min, sendo cerca de 6 min de demo ao vivo.

---

## 1. Abertura e o problema (2 min)

**Fala:** "Quem estuda inglês sozinho tem conteúdo de sobra. O que falta é alguém que lembre do seu nível, dos seus erros e do que você já estudou. O ChatGPT esquece tudo a cada conversa."

- Hoje a pessoa abre várias abas (ChatGPT, Gemini) e cola textos soltos, sem continuidade.
- **Proposta:** a Tia Evelyn é uma professora de inglês pessoal. Ela roda **no meu próprio computador** e conversa comigo **pelo Telegram**.

## 2. O que é o projeto (1 a 2 min)

- O projeto é um agente de IA local, baseado nas specs do SandeClaw, que adaptei para ensinar inglês.
- Mostre a pasta [specs/](../specs/), com PRD, arquitetura, agent-loop e memória. **Ponto forte:** o desenvolvimento seguiu as specs.
- **Princípios do PRD:**
  - tudo roda localmente;
  - a única interface é o Telegram;
  - só os IDs da whitelist são atendidos;
  - os dados ficam num SQLite local;
  - dá para trocar o LLM sem mudar o código.

## 3. Demo ao vivo (6 min), o coração da apresentação

Deixe o bot rodando antes (`npm run dev`) e o Telegram espelhado na tela.

| # | Ação no Telegram | O que destacar |
|---|---|---|
| 1 | `/nivelamento` e responder tudo numa mensagem só | A skill placement-test define o nível (QECR A1–C2) e anota objetivos e interesses |
| 2 | `/nivel` | O **perfil persistente** mostra nível, origem do nível, erros frequentes e temas estudados |
| 3 | Mandar um parágrafo com erros ("I have 30 years and I am working here since 2020") | Skill **writing**: correção agrupada por tipo, com ❌ → ✅, e o erro vai para o perfil |
| 4 | "me passa um texto pra ler" e depois responder "1. ... 2. ..." | Skill **reading** com i+1 e tema tirado dos interesses. O `expects_reply` faz o roteador reconhecer a resposta curta |
| 5 | Mandar uma **mensagem de voz** | Whisper local transcreve, e a resposta volta **em áudio** (edge-tts) |
| 6 | "cria uma aula sobre present perfect" | Skill **lesson-plan**: a resposta chega como **arquivo .md** |
| 7 *(bônus)* | Editar um `SKILL.md` com o bot no ar | **Hot-reload**: o comportamento muda sem reiniciar |

> 💡 **Plano B:** grave a demo antes. O TTS da voz Thalita falha cerca de 1 em cada 3 vezes. Existe fallback para a Francisca, mas é mais lento, então vale ter o vídeo pronto.

## 4. Arquitetura (3 min)

Use o diagrama do [README.md](../README.md):

```
Telegram ─► TelegramBot (whitelist) ─► InputHandler (texto | PDF/MD | voz→Whisper)
                                  ▼
                        AgentController (Facade) ◄─► MemoryManager (SQLite)
                                  ▼
            SkillLoader ─► SkillRouter (LLM, JSON) ─► SkillExecutor
                                  ▼
                AgentLoop (ReAct) ◄─► ToolRegistry
                                  ▼
          OutputHandler ─► Text | File | Audio (TTS) | Error
```

Explique o caminho de uma mensagem em 4 passos:

1. **Entrada:** a whitelist barra estranhos no primeiro middleware, antes de gastar banco ou LLM. Texto, PDF e voz são normalizados.
2. **Roteamento:** um LLM escolhe a skill. Com o Claude, a saída estruturada só aceita uma skill que existe ou `"none"`.
3. **ReAct:** o modelo pensa, chama ferramentas (`atualizar_perfil_aluno`, `registrar_vocabulario`, `criar_arquivo`, `data_hora_atual`) e repete até `MAX_ITERATIONS`.
4. **Saída:** uma estratégia decide o formato da resposta (texto, arquivo ou áudio).

**Padrões de projeto que vale citar:**
- Facade: `AgentController` e `MemoryManager`
- Singleton: `Config` e `Database`
- Factory: `ProviderFactory` e `ToolFactory`
- Strategy: as estratégias de saída
- Repository: os repositórios do banco

## 5. Decisões técnicas interessantes (3 min)

Escolha 3 ou 4:

- **Vários LLMs:** Gemini, DeepSeek, Groq e Anthropic, todos atrás de `ILlmProvider`. O `FallbackProvider` tenta o próximo se um falhar, e o roteador pode usar um modelo mais barato.
- **Skills em Markdown:** um professor sem saber programar consegue criar uma skill nova, porque é só um `SKILL.md` com frontmatter.
- **Memória pedagógica:** o perfil do aluno e o caderno de vocabulário ficam no SQLite e entram no prompt de toda resposta. Um nível definido pelo aluno só é substituído por um novo teste.
- **Concorrência:** uma fila por usuário (`KeyedQueue`) com o grammY runner garante que as mensagens do mesmo aluno sejam processadas em ordem.
- **TTS resiliente:** a Microsoft passou a exigir um token novo e as bibliotecas começaram a receber HTTP 403. A solução teve três partes:
  - motor via CLI;
  - retry com voz reserva;
  - timeout proporcional ao tamanho do texto.

  É um bom exemplo de problema real.

## 6. Limitações e próximos passos (1 a 2 min)

O roadmap já foi combinado em 5 etapas:
- ✅ Etapa 1: writing, grammar, reading, vocabulary, perfil e caderno.
- ⏭️ Skills que ficam ativas por vários turnos, com um teste de nivelamento adaptativo.
- ⏭️ **Revisão espaçada (SRS)** usando o caderno de vocabulário.
- ⏭️ Agendador com plano de estudos, para a Tia Evelyn puxar a conversa.
- ⏭️ Speaking, listening e pronúncia.

## 7. Fechamento (30 s)

**Fala:** "A Tia Evelyn não é um chatbot com prompt de professora. É um agente que lembra quem você é, adapta o conteúdo ao seu nível e roda no seu computador, com os seus dados."

Depois disso, abra para perguntas.

---

### Perguntas prováveis, já com resposta
- **"E o custo?"** O roteador pode usar um modelo barato, há fallback entre provedores e o Claude usa cache do prefixo do prompt.
- **"E a privacidade?"** Banco, áudio e Whisper ficam locais. Só o texto do prompt vai para a API do LLM.
- **"Funciona para várias pessoas?"** Funciona por whitelist, de propósito. O projeto não é um SaaS (NG-02 do PRD).
