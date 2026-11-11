Agent Skill - TiaEvelyn
Aluno: Luís Gustavo Oliveira Menezes
Curso: Pós-Graduação em Sistemas e Agentes Inteligentes - Universidade Federal de Goiás (UFG)
Disciplina: ePrompt | Professor: Sandeco | Turma: T4
1. Apresentação do projeto

A TiaEvelyn é um agente pessoal de IA que faz o papel de uma professora de inglês. Ela roda localmente e conversa com o aluno pelo Telegram. Quem estuda inglês sozinho tem conteúdo de sobra, mas não tem alguém que lembre do seu nível, dos seus erros e do que já estudou. A Tia Evelyn resolve isso com um perfil persistente do aluno e com skills especializadas em cada tipo de prática. O projeto foi construído a partir das specs do SandeClaw (pasta specs/), adaptadas para o ensino de inglês.

2. O que foi desenvolvido

- Bot do Telegram com whitelist de usuários, que aceita texto, documentos (PDF/MD) e mensagens de voz (transcritas pelo Whisper local).
- Ciclo ReAct (AgentLoop) com ferramentas: criar arquivo, data/hora, atualizar perfil do aluno e registrar vocabulário.
- Memória em SQLite: histórico das conversas, perfil do aluno (nível QECR A1–C2, erros frequentes, temas estudados, objetivos e interesses) e caderno de vocabulário.
- Roteador de skills por LLM, que escolhe a skill certa para cada mensagem.
- Respostas em texto, arquivo .md ou áudio (TTS com Edge-TTS e voz reserva).
- Suporte a vários LLMs (Gemini, DeepSeek, Groq e Anthropic Claude), com fallback automático entre eles.
- Comandos /nivelamento, /nivel, /nova e /ajuda.

3. Como as skills foram construídas

Cada skill é uma pasta em .agents/skills/ com um arquivo SKILL.md. O frontmatter traz o name e a description, que o roteador usa para decidir quando aplicar a skill. O corpo traz as instruções detalhadas, que só entram no prompt quando a skill é escolhida. A opção expects_reply: true marca as skills que terminam com exercícios, para o roteador reconhecer respostas curtas do aluno ("1. went 2. ..."). As skills são recarregadas a quente (hot-reload): editar um SKILL.md muda o comportamento sem reiniciar o bot. A skill-creator foi usada como apoio para criar e refinar as demais.

Skills criadas:
- writing: corrige textos (gramática, vocabulário, coesão e tom) e propõe tarefas de escrita.
- grammar: explica pontos de gramática com foco nos erros de quem fala português, com exercícios.
- reading: texto no nível do aluno com perguntas de compreensão.
- vocabulary: temas, collocations, phrasal verbs e falsos cognatos, registrados no caderno.
- lesson-plan: aula completa entregue como arquivo .md.
- conversation-practice: role-play de situações reais (viagem, entrevista, restaurante).
- placement-test: teste de nivelamento que define o nível e anota objetivos e interesses.

4. Principais arquivos do projeto

- specs/: PRD, arquitetura, agent-loop, memória e especificações de entrada/saída do Telegram.
- .agents/skills/*/SKILL.md: as skills da professora.
- src/core/AgentController.ts: fachada que orquestra memória, roteamento de skills e o agente.
- src/core/AgentLoop.ts: ciclo ReAct com chamada de ferramentas.
- src/core/SystemPromptBuilder.ts: monta o prompt da persona com o perfil e o vocabulário do aluno.
- src/skills/SkillLoader.ts, SkillRouter.ts e SkillExecutor.ts: carregamento, escolha e execução das skills.
- src/memory/: banco SQLite, MemoryManager e repositórios (mensagens, perfil do aluno e vocabulário).
- src/llm/: provedores de LLM, ProviderFactory e FallbackProvider.
- src/tools/: ferramentas do agente.
- src/telegram/: bot, tratamento de entrada (documentos e Whisper) e saída (texto, arquivo, áudio e erro).
- README.md e .env.example: instruções de instalação e configuração.

Vídeo e repositório do projeto
YouTube: 
GitHub: https://github.com/GustavoMenezes33/tiaevelyn
