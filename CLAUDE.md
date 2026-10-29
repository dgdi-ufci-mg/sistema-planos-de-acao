# CLAUDE.md — instruções exclusivas do Claude

As regras deste repositório estão no `AGENTS.md`, que vale para qualquer pessoa ou IA. A linha abaixo faz o Claude Code carregá-lo inteiro no início de cada sessão:

@AGENTS.md

**Não copie para cá nenhuma regra do `AGENTS.md`.** Duas cópias acabam ficando diferentes. Para mudar uma regra geral, altere o `AGENTS.md`. Este arquivo guarda só o que é exclusivo do Claude.

## Exclusivo do Claude: cópia da documentação no claude.ai

O projeto do claude.ai "Criação de uma ferramenta online para gerenciamento de projetos no CEFET-MG" guarda uma cópia da documentação técnica em `claude/documentacao-tecnica.md`. As conversas de chat do claude.ai não leem o GitHub; é por essa cópia que elas conhecem o sistema atual.

- **Quando:** depois de cada commit que altere `docs/documentacao-tecnica.md`.
- **Como:** com a ferramenta de Projetos do claude.ai, use `project_write` no caminho `claude/documentacao-tecnica.md`, com `local_path` apontando para o caminho **absoluto** do arquivo no repositório. O arquivo é enviado inteiro e substitui a cópia.
- **Só com a `main` limpa:** antes de enviar, confirme que `docs/documentacao-tecnica.md` está sem marcas de conflito (`<<<<<<<`) e que o `git pull` não deixou nada pendente. Enviar durante um conflito deixa a cópia quebrada.
- **Sentido:** sempre do repositório para a cópia. Nunca edite a cópia nem traga conteúdo dela para o repositório.
- **Sem a ferramenta de Projetos na sessão:** pule este passo e avise o responsável de que a cópia ficou desatualizada.
