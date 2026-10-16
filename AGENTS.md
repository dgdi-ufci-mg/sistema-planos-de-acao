# AGENTS.md — regras para quem contribui neste repositório

Leia este arquivo inteiro antes de qualquer tarefa. Ele vale para **qualquer pessoa ou assistente de IA** (Claude, Gemini, Copilot, Codex, Cursor ou outro) que trabalhar aqui.

**Este arquivo é a fonte única das regras.** Outros arquivos de instrução, como o `CLAUDE.md`, apenas apontam para este e acrescentam o que for exclusivo de uma ferramenta. Não copie estas regras para outros arquivos: altere-as somente aqui. Se a sua ferramenta de IA não lê este arquivo automaticamente, cole-o no início da conversa.

## 1. O que é este projeto

**Sistema de Gerenciamento de Planos de Ação** da DGDI, da Diretoria de Governança e Desenvolvimento Institucional da UFCI-MG (Universidade Federal de Ciência e Inovação de Minas Gerais).

O sistema serve para planejar e acompanhar planos de ação institucionais:

- calcula quando o plano deve terminar e quais ações não podem atrasar (caminho crítico, em dias úteis);
- estima a chance de cumprir o prazo (PERT e simulação de Monte Carlo);
- desenha o cronograma e o fluxo das ações por etapa (Gantt e diagrama de rede);
- compara o andamento real com o plano original (valor agregado e Earned Schedule);
- importa e exporta ações por planilha e por fluxograma (Mermaid).

Além disso, ele tem estes atributos:
- **Site oficial:** https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/. O GitHub Pages publica a partir da branch `main`, pasta raiz.
- **Banco de dados:** Firebase Firestore, projeto `sistema-planos-de-acao`. A leitura é pública; para gravar é preciso login com e-mail e senha.
- **Público:** gestores e equipes **leigos** em gerenciamento de projetos.
- **Licença:** GPL v3.

A versão antiga, publicada como artefato no claude.ai, está **descontinuada**. Não a atualize. O repositório é a única fonte da verdade.

## 2. Regras de trabalho (obrigatórias)

1. **Uma mudança por vez.** Cada pedido vira uma mudança pequena, testada e publicada isoladamente. Não junte melhorias não pedidas, refatorações oportunistas ou "aproveitei e corrigi também". Se notar outro problema, **relate** e espere a decisão.
2. **Pergunte antes de decidir pelo usuário.** Isso vale para decisões de metodologia, de texto da interface ou de comportamento que possam ir para mais de um lado. Quando a escolha for técnica e óbvia, decida e diga o que decidiu.
3. **Toda mudança atualiza a documentação técnica** (`docs/documentacao-tecnica.md`), no mesmo commit (ver seção 6).
4. **O manual do usuário está congelado** (`docs/manual-do-usuario.md`). Não o altere até o responsável liberar.
5. **Teste antes de publicar** (ver seção 7). Nunca envie à `main` código que não foi executado.
6. **Depois de publicar, confira o site no ar.** Se houver navegador disponível, abra o endereço oficial e confirme a mudança, recarregando se preciso: o GitHub Pages leva 1 a 2 minutos. Diga ao usuário o que conferir.
7. **Avaliações e listas de sugestões não são ordens.** Exemplo: o arquivo `claude/avaliacao-v12.md`, que fica no projeto do claude.ai e não no repositório. Ele foi escrito para a versão 12 e não foi verificado. Só aplique um item quando o responsável pedir aquele item. Antes, confirme no código atual se o problema existe.
8. **Pontos para reavaliação.** Antes de mexer nas regras de liberação das ações ou de estimativas, leia a seção "Pontos para reavaliação" da especificação da reescrita (`docs/especificacao-reescrita.md`) ou, depois da versão 2, da documentação técnica. São decisões provisórias que o responsável quer rever.

## 3. Como se comunicar com quem pede

- Responda sempre em **português do Brasil**.
- Seja **curto e claro**: uma ideia por parágrafo, porque o responsável costuma ler pelo celular.
- Evite jargão. Se usar um termo técnico, explique-o em palavras simples.
- Ao concluir, diga **o que mudou e o que conferir no site**. Não liste os passos que você executou.
- Não use mais referências e citações do que o necessário.

## 4. Princípios do produto (não negociáveis)

- **Linguagem simples na interface.** Use palavras do dia a dia. O termo técnico aparece em itálico, em letra menor, no formato "Termo técnico: …". Todo termo técnico novo entra também na aba **Entenda os termos** (seção `/* --- Glossário --- */`).
- **Rigor nos cálculos.** Mudanças em fórmulas citam a referência na documentação (seção 4) e são validadas com um plano real ou o plano de exemplo.
- **Reprodutibilidade.** A simulação usa semente fixa (mulberry32, `20261014`). Não introduza aleatoriedade sem semente.
- **Um único arquivo.** Todo o sistema fica em `index.html`, sem etapa de compilação, sem npm e sem *framework*. Bibliotecas externas entram só por CDN e com **versão fixa**: hoje, dagre 0.8.5 e Firebase compat 10.14.1, ambos do cdn.jsdelivr.net.
- **Celular.** Toda tela precisa funcionar em cerca de 400 px de largura.
- **Temas claro e escuro.** Use sempre as variáveis CSS de `:root`. Elas existem em **três** blocos: claro, `prefers-color-scheme: dark` e `[data-theme="dark"]`, e qualquer cor nova vai nos três. Não use cores fixas no código. As exceções existentes são as cores das etapas do diagrama (`CL`) e os `classDef` da exportação Mermaid; ao mexer na paleta, atualize-as também.
- **Paleta derivada do logotipo** (`logo.png`, rosa dos ventos):
  - verde-azulado `#00796B`: destaque e ações com folga;
  - vermelho `#E3262D`: sem folga, caminho crítico;
  - dourado `#F2B04A`: quase sem folga;
  - laranja `#F47216`: faixa do topo e histograma;
  - fundos neutros quentes.

## 5. Mapa do código (`index.html`)

O arquivo é dividido por comentários de seção. Procure-os com `grep -n "^/\* " index.html`. Os principais:

| Seção | O que contém |
|---|---|
| `utilidades`, `geração automática de código` | helpers (`$`, `esc`, datas) e `genCode` |
| `calendário de dias úteis` | dias úteis e feriados |
| `estimativas e rede`, `cálculo determinístico` | PERT, CPM com passada de ida e volta, folgas |
| `aleatoriedade reprodutível`, `Monte Carlo` | sorteios, P10/P50/P80/P95, criticidade, crucialidade, SSI |
| `armazenamento` | estado global `S`, objeto **`Store`**, `Local`, `W(fn)` (tratamento de erros de gravação) |
| `Firebase` | `loadFirebase`, login, `onAuthStateChanged` |
| `Cópia de segurança` | `collectAll` / `restoreAll` |
| `renderização` e subseções `--- … ---` | uma por aba: Gantt, Diagrama, Tarefas (Ações), seletores, Responsáveis, Risco (Previsões), Acompanhamento (Andamento), Glossário, Importar e exportar, Configurações |
| `ações` | despacho dos cliques (`data-act`) |
| `partida` | `boot()`: escolhe o modo Firebase ou local |

Regras do código:

- **Toda leitura e gravação passa por `Store`.** Nunca chame o Firestore fora dele. Toda gravação disparada pela interface passa por `W(fn)`.
- O `Store` tem dois *backends*, Firestore e `Local` (em memória). Uma mudança no modelo de dados precisa funcionar nos dois e na cópia de segurança.
- **Modelo de dados:**
  - `projects/{pid}`: plano, configuração, linha de base, `nearCrit`.
  - `projects/{pid}/tasks/{id}`: ação, com os campos `name` (rótulo), `desc`, `stage`, `preds`, `owners`, `o`, `m`, `p`, `cost`, `ac`, `pct`, `aS`, `aF` e `order`.
  - `people/{id}`: responsáveis, compartilhados entre todos os planos.
  - Os detalhes estão na seção 5 da documentação.
- O **código** da ação é o identificador do documento e **não pode ser mudado** depois de criado.
- Um campo novo no documento exige revisar: importação, exportação, cópia de segurança, `firestore.rules` (se mudar o caminho) e a documentação.

## 6. Documentação técnica: como atualizar

O arquivo é `docs/documentacao-tecnica.md`, a versão oficial. Em cada mudança:

1. Descreva a mudança na seção correspondente: funcionalidades, metodologia, modelo de dados etc.
2. Se for uma decisão de projeto, registre-a em **"Decisões tomadas"**, com o motivo.
3. Acrescente uma linha na tabela **"Histórico de versões da página"**:
   - mudança nova: próximo número inteiro;
   - ajuste pequeno da mudança anterior: decimal, como 24.1.
4. Atualize o cabeçalho, com a data e a versão da página.
5. Retire de **"Pendências"** o que foi resolvido.

Existe uma cópia desta documentação fora do repositório, no projeto do claude.ai. Ela é atualizada só pelo Claude (ver `CLAUDE.md`). Não a edite e não a use como fonte.

## 7. Como testar

Não há suíte de testes automatizada. Para testar:

1. **Sintaxe:** extraia o JavaScript e rode `node --check`, por exemplo assim:
   ```sh
   python3 -c "import re;s=open('index.html').read();open('/tmp/app.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))" && node --check /tmp/app.js
   ```
2. **No navegador, em modo local:** copie `index.html` e `logo.png` para uma pasta temporária, com um `config.js` contendo `window.FIREBASE_CONFIG=null;`. Abra com Playwright/Chromium, se disponível. Use **Ver um plano de exemplo** e percorra as abas afetadas, nos temas claro e escuro e na largura de celular.
   - Para datas em formato brasileiro, inicie o Chromium com `--lang=pt-BR` e o *locale* `pt-BR`.
   - Em ambiente sem internet, o diagrama mostra "Não foi possível carregar o componente de desenho". Isso é esperado, porque o dagre vem da CDN. Para interceptar requisições no Playwright, use `context.route("**/*", …)`.
3. **Fluxo do Firebase:** teste com um *mock* do SDK, interceptando as URLs do jsDelivr. **Nunca grave no Firestore de produção durante testes.**
4. Mostre ao usuário uma captura de tela quando a mudança for visual.

## 8. Git e publicação

- A branch `main` é publicada automaticamente no site. **Tudo o que entra na `main` vai ao ar.**
- **Responsável pelo projeto e assistentes de IA trabalhando a pedido dele:** um commit por mudança, direto na `main`, enquanto ela não estiver protegida. Se estiver protegida, use branch e *pull request*.
- **Gatilho para proteger a `main`:** quando a segunda pessoa começar a colaborar ou quando um plano passar a ser usado oficialmente, o que vier primeiro. A partir daí, toda mudança entra por *pull request* aprovado pelo responsável. Se perceber que o gatilho ocorreu e a `main` segue desprotegida, avise o responsável.
- **Contribuidores externos:** branch e *pull request*, conforme o `CONTRIBUTING.md`.
- **Mensagem de commit:** em português, no imperativo ou no descritivo curto, como "Restauração da cópia disponível na tela de banco vazio". Inclua as linhas de atribuição que o ambiente indicar.
- Antes de começar, faça `git pull` para trabalhar sobre a versão mais recente.

## 9. Não faça

- **Não altere `config.js`.** Ele aponta para o Firebase oficial. A `apiKey` ali é pública por desenho do Firebase e não é vazamento; a segurança está em `firestore.rules`.
- Não altere `firestore.rules` sem pedido explícito. Ao alterar, lembre ao responsável que ele também precisa publicar as regras no console do Firebase.
- Não digite senhas nem crie usuários. Cadastro de usuários é feito pelo administrador, no console do Firebase.
- Não apague dados de produção nem rode restauração no site oficial.
- Não adicione dependências, etapa de compilação ou arquivos JavaScript separados.
- Não mude o nome do sistema, a instituição ou a licença sem pedido explícito.

## 10. Onde aprofundar

- `docs/documentacao-tecnica.md`: arquitetura, fórmulas (seção 4), modelo de dados (5), permissões (7), decisões (8), pendências (9) e histórico (10). **Leia a seção pertinente antes de mexer numa área.**
- `README.md`: instalação do Firebase passo a passo.
- `CONTRIBUTING.md`: fluxo para colaboradores.
