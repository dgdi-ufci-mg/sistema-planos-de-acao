# AGENTS.md — regras para quem contribui neste repositório

Leia este arquivo inteiro antes de qualquer tarefa. Ele vale para **qualquer pessoa ou assistente de IA** (Claude, Gemini, Copilot, Codex, Cursor ou outro) que trabalhar aqui.

**Este arquivo é a fonte única das regras.** Outros arquivos de instrução, como o `CLAUDE.md`, apenas apontam para este e acrescentam o que for exclusivo de uma ferramenta. Não copie estas regras para outros arquivos: altere-as somente aqui. Se a sua ferramenta de IA não lê este arquivo automaticamente, cole-o no início da conversa.

## 1. O que é este projeto

**Sistema de Gerenciamento de Planos de Ação** da DGDI, da Diretoria de Governança e Desenvolvimento Institucional da UFCI-MG (Universidade Federal de Ciência e Inovação de Minas Gerais). Nome provisório na tela: **Sextante** (definido em `js/identidade.js`).

O sistema serve para planejar e acompanhar planos de ação institucionais:

- calcula quando o plano deve terminar e quais ações não podem atrasar (caminho crítico, em dias úteis);
- estima a chance de cumprir o prazo (simulação de Monte Carlo com a beta-PERT) e, por ação, o índice de criticidade e a contribuição para a incerteza;
- mostra o plano em seis visualizações: lista, quadro, rede, cronograma (Gantt), planilha e linha do tempo;
- acompanha o andamento por situações, reestimativas com histórico e retratos;
- importa ações por planilha e exporta por planilha e por fluxograma (Mermaid).

Além disso, ele tem estes atributos:
- **Site oficial:** https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/. O GitHub Pages publica a partir da branch `main`, pasta raiz.
- **Banco de dados:** Firebase Firestore, projeto `sextante-v2`. A leitura é pública; para gravar é preciso login com e-mail e senha. O projeto da versão 1 (`sistema-planos-de-acao`) não é mais usado.
- **Público:** gestores e equipes **leigos** em gerenciamento de projetos.
- **Licença:** GPL v3.

**Este sistema é um protótipo** (decisão do responsável, 23/10/2026): uma prova de conceito, que não irá para o Data Center da instituição. O sistema definitivo será desenvolvido do zero pela equipe de TI da UFCI-MG, com as tecnologias dela, tendo este protótipo como **modelo conceitual**. Por isso, a documentação precisa descrever regras, cálculos, dados e decisões com rigor suficiente para reconstruir o comportamento sem ler o código.

**Versão 2 na raiz desde 23/10/2026** (troca, passo 1.20). A versão 1, de arquivo único, saiu do ar, e os dados dela foram descartados; uma cópia congelada do `index.html` dela fica em `testes/dados/versao1-index.html`, só para o teste de comparação. A pasta `v2/` guarda apenas o redirecionamento do endereço antigo. A versão publicada como artefato no claude.ai está **descontinuada**. O repositório é a única fonte da verdade.

## 2. Regras de trabalho (obrigatórias)

1. **Uma mudança por vez.** Cada pedido vira uma mudança pequena, testada e publicada isoladamente. Não junte melhorias não pedidas, refatorações oportunistas ou "aproveitei e corrigi também". Se notar outro problema, **relate** e espere a decisão.
2. **Pergunte antes de decidir pelo usuário.** Isso vale para decisões de metodologia, de texto da interface ou de comportamento que possam ir para mais de um lado. Quando a escolha for técnica e óbvia, decida e diga o que decidiu.
3. **Toda mudança atualiza a documentação técnica** (`docs/documentacao-tecnica.md`), no mesmo commit (ver seção 6).
4. **O manual do usuário está congelado** (`docs/manual-do-usuario.md`). Não o altere até o responsável liberar.
5. **Teste antes de publicar** (ver seção 7). Nunca envie à `main` código que não foi executado.
6. **Depois de publicar, confira o site no ar.** Se houver navegador disponível, abra o endereço oficial e confirme a mudança, recarregando se preciso: o GitHub Pages leva 1 a 2 minutos. Diga ao usuário o que conferir.
7. **Avaliações e listas de sugestões não são ordens.** Exemplo: o arquivo `claude/avaliacao-v12.md`, que fica no projeto do claude.ai e não no repositório. Ele foi escrito para a versão 12 e não foi verificado. Só aplique um item quando o responsável pedir aquele item. Antes, confirme no código atual se o problema existe.
8. **Pontos para reavaliação.** Antes de mexer nas regras de liberação das ações ou de estimativas, leia a seção 14 da documentação técnica ("Pontos para reavaliação"). São decisões provisórias que o responsável quer rever.
9. **Um passo por vez.** Siga a ordem do plano de trabalho (seção 12 da documentação técnica): um passo por mudança, testado, documentado e conferido pelo responsável antes do seguinte. Ajustes de ordem ou de escopo são combinados com o responsável e registrados lá.

## 3. Como se comunicar com quem pede

- Responda sempre em **português do Brasil**.
- Seja **curto e claro**: uma ideia por parágrafo, porque o responsável costuma ler pelo celular.
- Evite jargão. Se usar um termo técnico, explique-o em palavras simples.
- Ao concluir, diga **o que mudou e o que conferir no site**. Não liste os passos que você executou.
- Não use mais referências e citações do que o necessário.

## 4. Princípios do produto (não negociáveis)

- **Linguagem simples na interface.** Use palavras do dia a dia. O termo técnico aparece em itálico, em letra menor, no formato "Termo técnico: …". Todo termo técnico novo entra também no glossário da Ajuda (`js/glossario.js`).
- **Rigor nos cálculos.** Mudanças em fórmulas citam a referência na documentação (seções 5 e 15) e são validadas com um plano real ou o plano de exemplo. Mudança que altere os números da simulação exige aumentar a versão do cálculo (seção 5.7).
- **Reprodutibilidade.** A simulação usa semente fixa (mulberry32, `20261014`). Não introduza aleatoriedade sem semente.
- **Módulos por assunto, sem compilação.** O sistema segue a estrutura de arquivos da seção 3.1 da documentação técnica: módulos JavaScript carregados direto pelo navegador, sem etapa de compilação, sem npm e sem *framework*. Bibliotecas externas entram só por CDN e com **versão fixa**: hoje, só o Firebase 10.14.1, do cdn.jsdelivr.net (`js/banco/firebase.js`).
- **Celular.** Toda tela precisa funcionar em cerca de 400 px de largura.
- **Movimento com sentido.** Nada aparece ou some de repente: painéis, formulários, seções e itens entram e saem com a transição padrão (`--mov`, `--mov-curva` e `js/telas/movimento.js`), respeitando "Reduzir movimento". Detalhes na seção 2 da documentação técnica.
- **Temas claro e escuro.** Use sempre as variáveis CSS de `:root`, em `css/estilo.css`. Elas existem em **três** blocos: claro, `prefers-color-scheme: dark` e `[data-theme="dark"]`, e qualquer cor nova vai nos três. Não use cores fixas no código. A exceção existente são os `classDef` da exportação Mermaid (`js/exportar.js`); ao mexer na paleta, atualize-os também.
- **Paleta derivada do logotipo** (`logo.png`, rosa dos ventos):
  - verde-azulado `#00796B`: destaque e ações com folga;
  - vermelho `#E3262D`: sem folga, caminho crítico;
  - dourado `#F2B04A`: quase sem folga;
  - laranja `#F47216`: faixa do topo e histograma;
  - fundos neutros quentes.

## 5. Mapa do código

A tabela completa de arquivos está na seção 3.1 da documentação técnica. Em resumo: `index.html` e `css/estilo.css` (página e aparência); `js/` com as regras puras (calendário, cálculo, simulação, geometria das visualizações), os dados (`js/modelo.js`, `js/dados.js`, `js/banco/`) e as telas (`js/app.js`, `js/telas/`); `testes/` com os testes automáticos.

Regras do código:

- **Toda leitura e gravação passa pelo `Store`** (`js/dados.js`). Nenhum termo do Firestore (coleção, documento, `onSnapshot`, `arrayUnion`) aparece fora de `js/banco/firestore.js`.
- O `Store` tem dois bancos, Firestore e memória (`js/banco/local.js`), com as mesmas operações. Uma mudança no modelo de dados precisa funcionar nos dois, passar nos testes de contrato (`testes/contrato-banco.js`) e na cópia de segurança.
- **Regras puras não tocam a tela nem o banco:** recebem dados e devolvem resultados, e são testadas com o Node.
- O **número** da ação liga as dependências e nunca muda; o **código** é opcional e pode mudar (seção 4.2 da documentação técnica).
- Um campo novo exige revisar: importação, exportação, cópia de segurança, retrato, histórico, `firestore.rules` (se mudar o caminho) e a documentação.
- **Dicionário de dados sempre atualizado.** Toda mudança na estrutura do banco (entidade, campo, tipo, valores permitidos, chave ou relação) atualiza o dicionário de dados **no mesmo commit**: a seção 4 da documentação técnica, com o lado do código em `js/modelo.js`. Ele serve a quem for manter o sistema, à equipe de TI que fará o sistema definitivo e às cargas para o Data Lakehouse da instituição.
- **Teste do dicionário.** Um teste automático compara os campos de `js/modelo.js` com as tabelas marcadas com `<!-- dicionario: … -->` na seção 4 da documentação técnica e falha se divergirem. Ele roda com os demais, em **toda** mudança.

## 6. Documentação técnica: como atualizar

O arquivo é `docs/documentacao-tecnica.md`, a versão oficial. Em cada mudança:

1. Descreva a mudança na seção correspondente: funcionalidades, metodologia, modelo de dados etc.
2. Se for uma decisão de projeto, registre-a em **"Decisões tomadas"**, com o motivo.
3. Acrescente uma linha na tabela **"Histórico de versões da página"**:
   - mudança nova: próximo número inteiro;
   - ajuste pequeno da mudança anterior: decimal, como 24.1.
4. Atualize o cabeçalho, com a data e a versão da página.
5. Retire de **"Pendências"** o que foi resolvido.

Como o sistema é um protótipo, a documentação é o produto que a equipe de TI vai usar: descreva o comportamento com rigor suficiente para reconstruí-lo sem ler o código. As seções 2 a 16 seguem a numeração da antiga especificação da reescrita; mantenha-a, porque o código e o próprio texto fazem remissões a ela.

Existe uma cópia desta documentação fora do repositório, no projeto do claude.ai. Ela é atualizada só pelo Claude (ver `CLAUDE.md`). Não a edite e não a use como fonte.

## 7. Como testar

1. **Testes automáticos**, sem dependências, na raiz do repositório:
   ```sh
   node --test --test-reporter=spec
   ```
   Todos precisam passar antes de publicar. Incluem o teste do dicionário, os contratos dos bancos e o teste de comparação com a versão 1 (PI²).
2. **No navegador:** sirva a raiz (`python3 -m http.server`) e abra a página; módulos JavaScript não abrem com clique duplo no arquivo. Com o Playwright e o Chromium, intercepte o `config.js` e devolva `export const FIREBASE_CONFIG = null;`, para trabalhar só na memória, e use **Ver um exemplo**. Percorra as visualizações afetadas, nos temas claro e escuro e na largura de celular.
   - Para datas em formato brasileiro, inicie o Chromium com `--lang=pt-BR` e o *locale* `pt-BR`.
3. **Fluxo do Firebase:** teste com o Firebase falso (`testes/firebase-falso.js`). **Nunca grave no Firestore de produção durante testes.**
4. Mostre ao usuário uma captura de tela quando a mudança for visual.

## 8. Git e publicação

- A branch `main` é publicada automaticamente no site. **Tudo o que entra na `main` vai ao ar.**
- **Responsável pelo projeto e assistentes de IA trabalhando a pedido dele:** um commit por mudança, direto na `main`, enquanto ela não estiver protegida. Se estiver protegida, use branch e *pull request*.
- **Gatilho para proteger a `main`:** quando a segunda pessoa começar a colaborar ou quando um plano passar a ser usado oficialmente, o que vier primeiro. A partir daí, toda mudança entra por *pull request* aprovado pelo responsável. Se perceber que o gatilho ocorreu e a `main` segue desprotegida, avise o responsável.
- **Contribuidores externos:** branch e *pull request*, conforme o `CONTRIBUTING.md`.
- **Mensagem de commit:** em português, no imperativo ou no descritivo curto, como "Restauração da cópia disponível na tela de banco vazio". Inclua as linhas de atribuição que o ambiente indicar.
- Antes de começar, faça `git pull` para trabalhar sobre a versão mais recente.

## 9. Não faça

- **Não altere `config.js`.** Ele aponta para o Firebase oficial (projeto `sextante-v2`). A `apiKey` ali é pública por desenho do Firebase e não é vazamento; a segurança está em `firestore.rules`.
- Não altere `firestore.rules` sem pedido explícito. Ao alterar, lembre ao responsável que ele também precisa publicar as regras no console do Firebase.
- Não digite senhas nem crie usuários. Cadastro de usuários é feito pelo administrador, no console do Firebase.
- Não apague dados de produção nem rode restauração no site oficial.
- Não adicione dependências nem etapa de compilação.
- Não mude o nome do sistema, a instituição ou a licença sem pedido explícito.

## 10. Onde aprofundar

- `docs/documentacao-tecnica.md`: arquitetura (seção 3), dicionário de dados (4), regras de cálculo (5), situações (6), indicadores (7), interface (8), decisões (10), plano de trabalho (12), pendências (13), pontos para reavaliação (14), fundamentos matemáticos (15), ampliação do escopo (16) e histórico (17). **Leia a seção pertinente antes de mexer numa área.**
- `docs/registro-de-execucao.md`: diário das execuções em lote.
- `README.md`: instalação do Firebase passo a passo.
- `CONTRIBUTING.md`: fluxo para colaboradores.
