# TiaEvelyn 👩‍🏫

Agente pessoal de IA, a **Tia Evelyn, professora de inglês**, que roda localmente e conversa com você pelo **Telegram**.
Implementação das specs em [`specs/`](specs/).

## Requisitos

- Node.js 20+ (testado com 24)
- Um bot do Telegram (crie com o [@BotFather](https://t.me/BotFather)) e seu user ID numérico (ex.: via [@userinfobot](https://t.me/userinfobot))
- API key de pelo menos um LLM: Gemini, DeepSeek ou Groq
- Opcional, para áudio: [Whisper](https://github.com/openai/whisper) (`pip install openai-whisper`) e `ffmpeg` no PATH

## Como rodar

```bash
npm install
cp .env.example .env   # preencha TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS e uma API key
npm run dev            # nodemon + tsx, recarrega ao editar src/
```

Comandos no Telegram:
- `/start` ou `/ajuda` mostra a ajuda;
- `/nivelamento` aplica um teste de nível (8 questões, respondidas numa mensagem só);
- `/nivel` mostra o perfil do aluno, e `/nivel B1` define o nível na mão;
- `/nova` inicia uma conversa nova (o perfil do aluno continua salvo).

## Perfil do aluno

A tabela `student_profiles` guarda, por usuário:
- o nível no QECR (A1–C2) e de onde ele veio (teste, observação nas conversas ou definido pelo aluno);
- os erros frequentes;
- os temas já estudados;
- os objetivos com o inglês e os interesses (usados para escolher temas de textos e exemplos).

A tabela `vocabulary` é o caderno de vocabulário. Recebe os termos ensinados pela ferramenta `registrar_vocabulario` e sem repetir termos. É a base para a futura revisão espaçada.

O perfil, a contagem do caderno e os 30 termos mais recentes entram no prompt de toda resposta. A Tia Evelyn atualiza o perfil com a ferramenta `atualizar_perfil_aluno`. Um nível definido com `/nivel` só é substituído por um novo `/nivelamento`, nunca por impressões da conversa.

## Arquitetura

```
Telegram ─► TelegramBot (whitelist) ─► TelegramInputHandler (texto | PDF/MD | voz→Whisper)
                                              │
                                              ▼
                                       AgentController (Facade)
             MemoryManager ◄──────────────────┤
                                              ▼
                  SkillLoader ─► SkillRouter (LLM, JSON) ─► SkillExecutor
                                              │
                                              ▼
                       AgentLoop (ReAct, MAX_ITERATIONS) ◄─► ToolRegistry
                                              │
                                              ▼
              TelegramOutputHandler ─► Text | File | Audio (TTS) | Error
```

| Pasta | Conteúdo |
|---|---|
| `src/config` | `Config` (Singleton), que lê o `.env` |
| `src/memory` | `Database` (Singleton, WAL), repositórios e `MemoryManager` (Facade, janela `MEMORY_WINDOW_SIZE`) |
| `src/llm` | `ILlmProvider`, provedores Gemini/DeepSeek/Groq (API compatível com OpenAI), `FallbackProvider` e `ProviderFactory` |
| `src/tools` | `BaseTool`, `ToolRegistry`, `ToolFactory`, `criar_arquivo`, `data_hora_atual`, `atualizar_perfil_aluno` e `registrar_vocabulario` |
| `src/skills` | `SkillLoader` (hot-reload), `SkillRouter` e `SkillExecutor` |
| `src/core` | `AgentController`, `AgentLoop` (ReAct), prompt da persona e extração de `<arquivo>` |
| `src/telegram` | bot, input (download, PDF/MD, Whisper) e output (estratégias de texto, arquivo, áudio e erro) |
| `.agents/skills` | skills em Markdown, editáveis com o bot rodando |

## Skills (hot-reload)

Cada subpasta de `.agents/skills/` com um `SKILL.md` vira uma skill. O frontmatter precisa ter `name` e `description`:

```markdown
---
name: minha-skill
description: Quando usar esta skill (o roteador decide com base nisto).
---

Instruções detalhadas, injetadas no prompt só quando a skill é escolhida.
```

Opcional: `expects_reply: true` no frontmatter indica que a skill termina com perguntas ou exercícios. Na próxima mensagem, o roteador recebe essa dica e o trecho final da resposta, para reconhecer respostas curtas como "1. went 2. ...". Se o roteador falhar, a mensagem vai para essa skill. A dica expira em 24 h ou com `/nova`.

Skills incluídas:
- `writing`: corrige textos (gramática, vocabulário, coesão e tom) e propõe tarefas de escrita
- `grammar`: explica pontos de gramática com foco nos erros de quem fala português, com exercícios no chat
- `reading`: texto no nível do aluno ("i+1") com perguntas e registro do vocabulário novo
- `vocabulary`: temas, collocations, phrasal verbs e falsos cognatos, registrados no caderno
- `lesson-plan`: aula completa em arquivo `.md`
- `conversation-practice`: role-play de conversação
- `placement-test`: teste de nivelamento, que também anota objetivos e interesses

## LLMs

Use `LLM_PROVIDER` para escolher o provedor principal (`gemini`, `deepseek`, `groq` ou `anthropic`) e `LLM_FALLBACK_PROVIDERS` para os que serão tentados se ele falhar. O roteador de skills pode usar outro provedor com `ROUTER_PROVIDER`.

### Anthropic (Claude)

Usa o SDK oficial `@anthropic-ai/sdk`. Configure `ANTHROPIC_API_KEY` e, se quiser, `ANTHROPIC_MODEL` (padrão `claude-opus-5-5`) e `ANTHROPIC_EFFORT` (`low`, `medium` ou `high`; padrão `medium`).

- **Raciocínio:** o Claude Opus 5.5 sempre raciocina antes de responder; o `ANTHROPIC_EFFORT` controla quanto. O roteador de skills usa sempre `low`.
- **Roteador:** usa saída estruturada (JSON Schema), então o Claude só consegue responder com o nome de uma skill existente ou `"none"`.
- **Recusas:** se o filtro de segurança recusar um pedido, a própria API refaz a chamada no modelo recomendado (`fallbacks: "default"`). Se ainda assim for recusado, entram os provedores de `LLM_FALLBACK_PROVIDERS`.
- **Cache:** o prefixo do pedido (ferramentas, prompt e histórico) é cacheado automaticamente, o que barateia as iterações do ciclo ReAct.

## Áudio

- **Entrada (STT):** mensagens de voz são transcritas pelo CLI do Whisper local (`WHISPER_COMMAND`, `WHISPER_MODEL`, `WHISPER_LANGUAGE`). A detecção automática de idioma erra com áudios curtos no modelo `base`. Para quem alterna português e inglês, `WHISPER_MODEL=small` costuma ir melhor.
- **Saída (TTS):** uma resposta em áudio é gerada quando a entrada foi voz ou quando o texto pede ("me responde em áudio").
  - `TTS_ENGINE=universal` usa a lib npm `edge-tts-universal`, que é o padrão da spec.
  - `TTS_ENGINE=cli` usa o `edge-tts` do Python (`pip install -U edge-tts`).
  - Se o TTS falhar, a resposta vai em texto com um aviso.

> ⚠️ **Status em 26/10/2026:** o serviço Edge-TTS da Microsoft passou a exigir um token "v2".
> A `edge-tts-universal@1.4.0` (última no npm) e o `edge-tts` Python 7.2.7 recebem **HTTP 403**.
> O `edge-tts` Python **7.3.1** já implementa o token novo. Para ter voz agora:
> `pip install -U edge-tts` e `TTS_ENGINE=cli` no `.env`.

## Segurança

- Só os IDs em `TELEGRAM_ALLOWED_USER_IDS` são atendidos. Os demais são ignorados no primeiro middleware, sem acessar o banco nem o LLM.
- `data/` (banco SQLite), `tmp/` e `.env` estão no `.gitignore`.
- Erros enviados ao usuário não incluem stack traces nem chaves.
