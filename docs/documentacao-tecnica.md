# Documentação técnica — Sistema de Gerenciamento de Planos de Ação (Sextante)

**Última atualização deste documento:** 23/10/2026 (versão 123 da página)

Sistema da DGDI da UFCI-MG, em https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/. **Protótipo** (seção 1.2): esta documentação é o modelo conceitual para o sistema definitivo e precisa permitir reconstruir o comportamento sem ler o código.

**Sumário:** 1. Visão geral · 2. Princípios · 3. Arquitetura · 4. Modelo de dados (dicionário de dados) · 5. Regras de cálculo · 6. Situações e carimbo · 7. Indicadores por ação · 8. Interface · 9. O que saiu da versão 1 · 10. Decisões tomadas · 11. Migração dos dados da versão 1 · 12. Plano de trabalho · 13. Pendências e ideias futuras · 14. Pontos para reavaliação · 15. Fundamentos matemáticos dos indicadores · 16. Ampliação do escopo · 17. Histórico de versões da página

---

## 1. Visão geral

### 1.1 Objetivo

Planejar e acompanhar planos de ação institucionais da DGDI (Diretoria de Governança e Desenvolvimento Institucional) da UFCI-MG. Cada plano é um **espaço de planejamento**, com ações ligadas por dependências. O sistema calcula:

- quando o espaço deve terminar e quais ações não podem atrasar (caminho crítico, em dias úteis);
- a chance de cumprir o prazo final e as datas prováveis de conclusão (simulação de Monte Carlo com a distribuição beta-PERT);
- para cada ação, quanto um atraso nela atrasa o fim (índice de criticidade) e quanto da incerteza do prazo vem dela (contribuição para a incerteza; *termo técnico: contribuição para a variância*).

E mostra o espaço em seis visualizações: lista, quadro, rede, cronograma, planilha e linha do tempo.

### 1.2 Natureza: protótipo

O sistema é um **protótipo, uma prova de conceito** (decisão do responsável, 23/10/2026). Ele não vai para o Data Center da UFCI-MG: o sistema definitivo será desenvolvido do zero pela equipe de TI da instituição, com as linguagens e ferramentas dela e com a participação dela desde o início. O protótipo pode ser usado e testado fora da instituição e serve de **modelo conceitual**: regras, cálculos, modelo de dados, telas e decisões descritos aqui valem como requisitos; o código não é reaproveitado. Por isso, esta documentação deve permitir reconstruir o comportamento do sistema sem ler o código. Onde o texto e o código divergirem, a divergência é um defeito a corrigir, em um ou no outro.

### 1.3 Público

Gestores e equipes **leigos** em gerenciamento de projetos. Por isso a interface usa palavras do dia a dia, com o termo técnico em itálico e menor, e cada termo tem um verbete na Ajuda (glossário), com a equação e a fonte primária quando é uma medida matemática.

### 1.4 Origem: a versão 1 e a reescrita

A versão 1 era um arquivo único (`index.html`), feito em etapas como artefato do Claude, com valor agregado e Earned Schedule. A versão 2, chamada provisoriamente de **Sextante**, foi reescrita do zero entre 19 e 23/10/2026, a partir de uma especificação aprovada pelo responsável, e substituiu a versão 1 no endereço oficial em 23/10/2026 (passo 1.20). Motivos da reescrita:

- **Código difícil de revisar.** A versão 1 tinha 1.300 linhas compactas, com nomes curtos; a cada versão, limpar ficava mais caro.
- **O modelo de acompanhamento mudou.** Saíram o valor agregado e o Earned Schedule; entraram situações, reestimativas com histórico, retratos e anotações (seção 9).
- **Não foi do zero no conteúdo.** A lógica já testada foi mantida e reescrita de forma legível: calendário de dias úteis, caminho crítico, Monte Carlo e conexão com o Firebase. O teste de comparação (seção 3.2) garante que o caminho crítico dá as mesmas datas da versão 1.

A especificação da reescrita foi incorporada a este documento na troca e apagada. Para preservar as remissões, **as seções 2 a 16 mantêm a numeração da especificação**. O texto anterior da especificação, da documentação da versão 1 e do rascunho desta documentação continua no histórico do Git (commit `da7b272` e anteriores). O diário da execução em lote fica em `docs/registro-de-execucao.md`.

---

## 2. Princípios

- **KISS** ("mantenha simples"): a solução mais simples que resolve o problema é a melhor.
- **YAGNI** ("você não vai precisar disso"): nada é construído antes de haver necessidade real.
- **Código limpo:** nomes claros, funções pequenas, um assunto por arquivo, sem duplicação e sem código morto. Código que perde a função é apagado, não escondido; o histórico do Git guarda tudo.
- **Só pedir o necessário:** o usuário informa apenas dados que o sistema usa. Exemplo: a data de início real de uma ação não é pedida, porque não entra em nenhum cálculo.
- **Aceitar o mundo real:** o sistema absorve registros atrasados, reprogramações e imprecisões sem travar o usuário. Exemplo: a data de conclusão pode ser registrada com qualquer data, mesmo passada.
- **Linguagem simples:** princípio herdado da versão 1. Termo técnico em itálico, como "Termo técnico: …", e clicável, abrindo a explicação na Ajuda.
- **Movimento com sentido** (decisão do responsável, 21/10/2026): o que aparece, some ou muda de lugar na tela faz uma transição curta, nunca um salto. A animação mostra de onde a coisa veio e para onde foi, e isso ajuda a entender o sistema. É padrão em toda tela nova ou alterada: painéis e janelas deslizam, formulários e seções crescem a partir da altura zero e encolhem ao fechar, itens reordenados deslizam até a nova posição, alternadores movem a marca da opção escolhida. Durações curtas e iguais em todo o sistema: 0,25 s (`--mov`) e 0,18 s para detalhes (`--mov-rapido`), com a mesma curva (`--mov-curva`), no CSS e em `js/telas/movimento.js` (`abrirSuave`, `fecharSuave`). Quem ativou "Reduzir movimento" no aparelho não vê animação.
- **Números contínuos, não categorias:** indicadores contínuos aparecem como barras, com o número discreto em cinza. Cortes arbitrários, como "acima de 50% é prioritária", são evitados, porque tratam como diferentes casos praticamente iguais (paradoxo de sorites). Carimbos ficam só para fatos binários, como "Atrasada".
- **Rigor nos cálculos:** fórmulas documentadas (seções 5 e 15), com a fonte primária, testadas contra a versão 1 e reproduzíveis (semente fixa, gerador mulberry32).
- **Temas claro e escuro e celular:** cores só por variáveis CSS, em três blocos (claro, escuro pelo sistema, escuro escolhido); toda tela funciona em cerca de 400 px de largura.
- **Acessibilidade:** contraste e papéis conferidos com o axe-core (regras WCAG 2 A e AA) em todas as visualizações; tudo alcançável pelo teclado; textos pequenos com contraste mínimo de 4,5:1.

---

## 3. Arquitetura

### 3.1 Arquivos, sem compilação

Módulos JavaScript carregados direto pelo navegador (`<script type="module">`), sem compilação, sem npm e sem *framework*. Os motivos estão na seção 10. Para ver localmente, é preciso um servidor simples, como `python3 -m http.server` na raiz do repositório, porque módulos não abrem com clique duplo no arquivo.

- **Bibliotecas externas:** só por CDN e com versão fixa. Hoje, apenas o Firebase 10.14.1 (jsDelivr), carregado por `js/banco/firebase.js`. O desenho da rede é próprio (seção 8.4); o dagre, usado na versão 1, saiu. As fontes vêm do Google Fonts.
- **Funções puras:** cálculo, simulação e geometria não acessam a tela nem o banco. Recebem dados e devolvem resultados, e por isso são testadas com o Node, sem navegador.
- **Tipos por comentários (JSDoc):** cada função tem, acima dela, a descrição do que recebe e devolve.
- **Nome do sistema como variável:** o nome aparece na tela, no título da aba do navegador, na Ajuda e nas exportações, mas é definido num único lugar, `js/identidade.js`. Nome provisório: **Sextante** (decisão do responsável em 19/10/2026), sob avaliação.

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página: barra lateral, puxador, barra do topo, área principal |
| `css/estilo.css` | Aparência e variáveis de cor, em três blocos de tema |
| `config.js` | Configuração do Firebase (projeto `sextante-v2`; pública por desenho; `null` = só memória) |
| `firestore.rules` | Regras do banco, publicadas à mão no console do Firebase |
| `logo.png` | Logotipo (rosa dos ventos) |
| `v2/index.html` | Só leva quem guardou o endereço antigo `/v2/` para a raiz |
| **Regras, sem tela nem banco** | |
| `js/calendario.js` | Dias úteis, datas excluídas, calendário geral mais o do espaço |
| `js/feriados.js` | Sugestão anual dos feriados nacionais e pontos facultativos (Páscoa calculada) |
| `js/calculo.js` | Estimativa vigente, ordem por dependência, caminho crítico, situações, carimbo Atrasada |
| `js/simulacao.js` | Monte Carlo beta-PERT, prioridades, chave da simulação (reaproveitamento) |
| `js/lista.js` | Linhas da lista: filtros, ordens, agrupamento por fase e etapa, resumos |
| `js/acao.js` | Regras da ação: estimativa livre, anteriores possíveis sem ciclo, busca, códigos |
| `js/tipos.js` | Tipos de espaço: nomes, tipo padrão, o que cada tipo exige, agrupamento do menu lateral |
| `js/cronograma.js`, `js/rede.js`, `js/linha-do-tempo.js` | Geometria do cronograma, da rede e da linha do tempo |
| `js/retrato.js` | Montagem do retrato (cópia integral com resultados) |
| `js/historico.js` | Registros do histórico de alterações e as frases que os descrevem |
| `js/planilha.js`, `js/importar.js`, `js/importar-responsaveis.js`, `js/exportar.js` | Leitura e escrita da grade da planilha, importação e exportação |
| `js/notas.js` | Markdown seguro das anotações (conversor próprio) |
| `js/responsaveis.js`, `js/glossario.js`, `js/icones.js`, `js/identidade.js`, `js/formato.js`, `js/exemplo.js`, `js/conexao.js` | Apoio: iniciais e tons, glossário, ícones SVG, nome do sistema, formatação, espaço de exemplo, vigia da conexão |
| **Dados** | |
| `js/modelo.js` | Campos de cada entidade: o lado "código" do dicionário de dados (seção 4) |
| `js/dados.js` | `Store`: operações do sistema, com validação, histórico e permissão de gravar |
| `js/banco/local.js`, `js/banco/firestore.js` | Os dois bancos, com as mesmas operações (contrato em `testes/contrato-banco.js`) |
| `js/banco/firebase.js` | Carrega o SDK, login, troca e redefinição de senha, criação de contas |
| **Telas** | |
| `js/app.js` | Partida, roteamento (`#/espaco/<id>`), conexão, escolha do banco |
| `js/telas/*.js` | Uma tela ou peça por arquivo: navegação, abertura, espaço (lista e quadro), janela da ação, nova ação, planilha (`editar-planilha.js`), cronograma, rede, linha do tempo, configurar espaço e sistema, tipo do espaço (`tipo-espaco.js`), lixeira, ajuda, acesso, seletor com busca, edição no lugar, exclusão, pendências, pessoas, painel, movimento |
| **Testes** | |
| `testes/*.test.js` | Testes automáticos (`node --test`, na raiz) |
| `testes/contrato-banco.js`, `testes/firebase-falso.js` | Garantias que todo banco cumpre; Firebase falso, em memória |
| `testes/dados/` | A PI² (`pi2-fase1.json`) e uma cópia congelada da versão 1 (`versao1-index.html`), usada só pelo teste de comparação |
| `testes/desempenho.mjs` | Medida de velocidade, rodada à mão, com 50 a 300 ações |
| `package.json` | Só marca os arquivos como módulos para o Node; sem dependências |

### 3.2 Testes

- **Testes de unidade** das funções de calendário, cálculo, simulação e Markdown, com `node --test`, sem dependências.
- **Teste de comparação:** o espaço da PI² precisa produzir as mesmas datas do caminho crítico da versão 1, já que essa regra não mudou. O cálculo da versão 1 é executado a partir da cópia congelada em `testes/dados/versao1-index.html`. As probabilidades mudam por causa da troca para a beta-PERT; os novos valores são registrados como referência. **Referência (versão do cálculo 1, semente 20261014, 10.000 simulações, só estimativas):** P50 em 30/03/2027, P80 em 08/04/2027, P95 em 22/04/2027 e chance de 89,5% de cumprir o prazo de 14/04/2027. Na versão 1, com a triangular e 3.000 simulações, a chance era de 74%: a triangular, com os mesmos três pontos, espalha mais as durações do que a beta-PERT, que concentra os sorteios perto do mais provável. Um teste automático confere esses valores; se mudarem, é preciso aumentar a versão do cálculo.
- **Teste do dicionário de dados:** compara os campos usados pelo código (tipos JSDoc do modelo) com os da seção 4 e falha se divergirem. Roda com os demais, em toda mudança.
- **Teste visual:** capturas de tela das visualizações afetadas, nos temas claro e escuro e na largura de celular, com o Playwright e o Chromium, sobre o sistema servido localmente e com o Firebase desligado (`config.js` interceptado com `null`).
- **Como rodar:** `node --test` na raiz do repositório. Todos precisam passar antes de publicar.

### 3.3 Fluxo de trabalho

O sistema evolui **passo a passo**, seguindo a regra "uma mudança por vez" do AGENTS.md, na ordem da seção 12. Cada passo é testado, documentado e conferido pelo responsável antes do seguinte.

- **Onde:** a branch `main` é publicada pelo GitHub Pages em https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/. Até a troca (23/10/2026), a versão 2 foi construída na pasta `/v2/`, ao lado da versão 1; hoje ela está na raiz, e `/v2/` só redireciona.
- **Dados:** até o passo 1.14, a versão 2 usou só o banco em memória e o espaço de exemplo. Desde então usa **um projeto próprio no Firebase**, `sextante-v2` (decisão do responsável em 19/10/2026), que passou a ser o banco do sistema na troca. O projeto da versão 1 (`sistema-planos-de-acao`) deixou de ser usado, e os dados dele foram descartados (decisão do responsável, 23/10/2026).
- **Execução em lote** (decisão do responsável, 21/10/2026): passos independentes podem ser feitos em sequência, sem esperar a conferência de cada um, se cada passo for um commit próprio, testado, documentado e registrado em `docs/registro-de-execucao.md`, com as decisões tomadas sem consulta marcadas como provisórias. A execução para diante de teste que falhe sem solução clara, de mudança em dados reais, nas regras do banco ou na segurança, ou de decisão de método que mude o sentido de um número. As decisões dos lotes de 21 e 22/10/2026 foram aprovadas em 23/10/2026 (seção 14.1).

### 3.4 Preparação para a troca de banco

*Revisto em 23/10/2026:* o protótipo não irá para o servidor da UFCI-MG (seção 1.2). O que segue continua valendo como orientação ao sistema definitivo: separar o domínio do banco facilita reproduzir as regras sobre o PostgreSQL ou outro banco que a equipe de TI escolher.

- **O `Store` fala a língua do sistema, não a do banco.** Oferece operações com nomes do domínio, como `criarAcao`, `alterarCampo`, `acrescentarResponsavel`, `retirarResponsavel`, `registrarEstimativa`, `concluirAcao`, `salvarRetrato` e `acompanharPlano`. Nenhum termo do Firestore (coleção, documento, `onSnapshot`, `arrayUnion`) aparece fora de `js/banco/firestore.js`.
- **Cada banco é um arquivo** em `js/banco/`, que executa as mesmas operações. Hoje: Firestore e memória local. No sistema definitivo, o banco escolhido pela equipe de TI.
- **As regras de edição simultânea (seção 4.6) são do sistema.** No Firestore, viram transações e acréscimos em listas. No PostgreSQL, viram restrições do próprio banco, como código único por espaço, tabelas de ligação para responsáveis e dependências, e conferência da última alteração antes de gravar.
- **Tempo real como operação, não como recurso do banco.** `acompanharPlano` avisa a tela quando algo muda. No Firestore, isso vem pronto. No servidor, pode começar com consultas periódicas, por exemplo a cada 10 segundos.
- **Os mesmos testes para todos os bancos.** Os testes de `node --test` rodam contra o banco em memória e servem de contrato: um banco novo precisa passar neles.
- **A cópia de segurança é a ponte.** O arquivo da cópia tem formato próprio, independente do banco (seção 8.6). Se o sistema definitivo quiser receber os dados do protótipo, o caminho é ler esse arquivo.

Ficam para o sistema definitivo (seção 12, fase 4): o programa do servidor, que passa a conter as permissões hoje no `firestore.rules`, e o login institucional, que exigirá recadastrar os usuários.

### 3.5 Bancos e modos de operação

- **Firebase** (projeto `sextante-v2`): leitura pública; gravação só com login por e-mail e senha. Tempo real pelo acompanhamento do espaço (`acompanharEspaco`).
- **Memória:** o espaço de exemplo roda sempre num banco em memória à parte e nunca vai ao Firebase. Sem `config.js`, ou se o Firebase não carregar, o sistema abre só na memória, com aviso.
- **Sem conexão:** um vigia testa a rede a cada 10 s (5 s enquanto desconectado) e, depois de duas falhas, mostra "Sem conexão" na barra do topo; o `Store` recusa gravações até a conexão voltar.
- **Preferências de cada pessoa** (visualização, colunas, indicador, barra lateral recolhida, último espaço aberto) ficam só no navegador (`localStorage`, chaves `sextante.*`). Não são dados do sistema e não entram na cópia de segurança.

### 3.6 Permissões

Regras provisórias do Firestore (`firestore.rules`), até os papéis por espaço (seção 12, passo 2.1):

- qualquer pessoa consulta;
- só quem entrou com e-mail e senha cria e altera;
- ninguém apaga: a exclusão é lógica (lixeira, seção 4.7);
- o histórico de alterações e os retratos só recebem registros novos: ninguém altera nem apaga.

Usuários são cadastrados pela importação de responsáveis (provisório; seção 8.6) ou pelo administrador no console do Firebase. **Obrigatório antes de qualquer uso oficial:** papéis por espaço (administrador, usuário, leitor), visibilidade e proteção da branch `main` (seção 12, passos 2.1 a 2.3 e 2.11). Ao mudar as regras, é preciso publicá-las no console e conferir que entraram em vigor antes de publicar o código que depende delas.

---

## 4. Modelo de dados (dicionário de dados)

**Esta seção é o dicionário de dados da versão 2.** Toda mudança na estrutura do banco atualiza esta seção no mesmo commit (AGENTS.md). O teste `testes/dicionario.test.js` compara cada tabela marcada abaixo com `js/modelo.js`, a lista de campos que o código usa, e falha se divergirem. O Store recusa gravar campos que não estejam nessa lista.


### Convenções

- **Data:** texto `AAAA-MM-DD`, sem hora nem fuso. É uma data do calendário, lida no horário de Brasília. Exemplo: `2026-10-19`.
- **Momento:** texto ISO 8601 em UTC, com milissegundos e `Z`. Exemplo: `2026-10-19T13:45:00.000Z` (10h45 em Brasília).
- **Id:** texto gerado pelo sistema (UUID). Exemplo: `3f2b8c1e-…`. Exceção: a ação, cuja chave é o código.
- **Usuário:** e-mail de login de quem gravou. Vazio quando não há login (modo local).
- **Dias úteis:** número de dias úteis do espaço, descontadas as datas excluídas. Aceita frações, como `2.5`.
- **Vazio:** campo ausente ou `null`. "Obrig." indica se o campo precisa ter valor.
- **Exclusão lógica:** nada é apagado; `excluidoEm` preenchido indica item excluído (seção 4.7).
- **Nomes dos campos:** em português, sem acentos, no formato `palavraPalavra`.

### Entidades e relações

```mermaid
erDiagram
  ESPACO ||--o{ FASE : "estrutura"
  FASE ||--o{ ETAPA : "etapas"
  ETAPA |o--o{ ACAO : "etapa"
  ESPACO ||--o{ ACAO : "contém"
  ACAO }o--o{ ACAO : "dependeDe"
  ACAO }o--o{ RESPONSAVEL : "responsaveis"
  ACAO ||--|{ ESTIMATIVA : "estimativas"
  ESPACO ||--o{ RETRATO : "retratos"
  RETRATO ||--o{ RETRATO_ACAO : "acoes"
  ESPACO ||--o{ DATA_EXCLUIDA : "datasExcluidas"
  ESPACO ||--o{ DOCUMENTO : "documentos"
```

**Como ler o diagrama:** notação "pé de galinha" (*Termo técnico: crow's foot, de James Martin*), padrão em modelagem de dados. Em cada ponta da linha: `||` exatamente um; `|o` zero ou um; `|{` um ou muitos; `o{` zero ou muitos (o "pé" indica "muitos"). Exemplo: entre ESPACO e ACAO, cada ação pertence a exatamente um espaço, e um espaço tem zero ou muitas ações.

- Um **espaço** tem ações, retratos, datas excluídas, documentos e uma estrutura de fases e etapas.
- Uma **ação** pertence a um espaço e, opcionalmente, a uma etapa; depende de outras ações do mesmo espaço; tem responsáveis e um histórico de estimativas.
- **Responsáveis** são globais: os mesmos para todos os espaços.

### 4.1 Espaço de Planejamento

<!-- dicionario: espaco -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador do espaço. Imutável | `3f2b8c1e-…` |
| `nome` | texto | sim | Nome do espaço | `PI² · Fase 1` |
| `tipo` | texto: `planoDeAcao` ou `projeto` | não | Tipo do espaço (seção 16.1; passo 2.4a). **Ausente: `projeto`**, como nos espaços criados antes do passo 2.4a | `planoDeAcao` |
| `programa` | texto | não | Programa do PEI/PDI que prevê o Plano de Ação. **Obrigatório no Plano de Ação**; no Projeto, vazio. Texto livre provisório, até o catálogo do passo 2.5 | `Programa de Governança de Dados` |
| `aprovacao` | aprovação (4.1.6) | não | Documento que aprovou o Plano de Ação. **Obrigatório no Plano de Ação**, com a identificação; no Projeto, vazio | |
| `modelo` | modelo (4.1.7) | não | Como o espaço define prazos, dependências e simulação. Escolhido na criação e **imutável** (passo 2.4b). **Ausente: cronograma estruturado** (estimativas, dependências e simulação), como nos espaços criados antes do passo 2.4b | |
| `inicio` | data | não | Início do espaço: a partir dele contam os dias úteis | `2026-08-03` |
| `prazoFinal` | data | não | Prazo final, por exemplo o fixado por ato da Diretoria-Geral | `2027-04-14` |
| `datasExcluidas` | lista de data excluída (4.1.1) | não | Datas sem expediente próprias do espaço (feriados locais, exclusões específicas), que complementam o calendário geral (4.1.5) | |
| `datasGeraisDesconsideradas` | lista de data | não | Datas do calendário geral que este espaço não exclui (por exemplo, um ponto facultativo em que a equipe trabalha) | `["2027-02-08"]` |
| `documentos` | lista de documento (4.1.2) | não | Documentos do espaço, como o espaço aprovado e suas revisões | |
| `simulacoes` | inteiro | sim | Número de simulações. Padrão 10.000. Definido na criação e **imutável** (seção 5.7) | `10000` |
| `semente` | inteiro | sim | Semente da simulação. Padrão 20261014. Definida na criação e **imutável** (seção 5.7) | `20261014` |
| `estrutura` | lista de fase (4.1.3) | não | Fases e etapas, na ordem de exibição (seção 8.3) | |
| `camposOpcionais` | campos opcionais (4.1.4) | não | Quais campos opcionais o espaço usa. Ausente: todos ligados | |
| `proximoNumero` | inteiro | não | Número que a próxima ação criada no espaço vai receber (seção 4.2). Mantido pelo sistema, não editável; só cresce, para nenhum número ser reaproveitado. Ausente: 1 | `13` |
| `tons` | mapa de id de responsável → inteiro de 1 a 15 | não | Tom do círculo de cada **pessoa** responsável por alguma ação do espaço (seção 8.3). Mantido pelo sistema, não editável: quem chega recebe o menor tom livre; quem deixa de ser responsável por todas as ações sai, e o tom fica livre; acima de 15 pessoas, repete o tom menos usado. Gravado sem carimbo de alteração | `{"3f2b…": 1, "9c1a…": 2}` |
| `criadoEm` | momento | sim | Criação do espaço. Imutável | `2026-10-19T13:45:00.000Z` |
| `alteradoEm` | momento | sim | Última gravação no espaço | |
| `alteradoPor` | usuário | não | Autor da última gravação | `ana@ufci.edu.br` |
| `excluidoEm` | momento | não | Exclusão lógica (seção 4.7). Vazio: espaço ativo | |
| `excluidoPor` | usuário | não | Quem excluiu | |

Saíram da versão 1: `dist` (escolha de distribuição), `statusDate` (a data de referência é sempre hoje), `baseline` (substituído pelos retratos) e `nearCrit` (seção 7.3).

#### 4.1.1 Data excluída: cada item de `datasExcluidas`

<!-- dicionario: dataExcluida -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `data` | data | sim | Dia sem expediente, que não conta como dia útil | `2026-11-20` |
| `motivo` | texto | não | Motivo, para conferência posterior | `Consciência Negra` |

#### 4.1.2 Documento: cada item de `documentos`

<!-- dicionario: documento -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `nome` | texto | sim | Nome do documento | `Plano aprovado` |
| `data` | data | não | Data do documento | `2026-08-01` |
| `identificacao` | texto | não | Número no sistema de protocolo da instituição (SIPAC/Protocolo) | `23062.001234/2026-11` |
| `link` | texto (endereço web) | não | Endereço para abrir o documento. O envio do arquivo fica para o servidor da UFCI-MG (passo 4.3) | `https://…` |

#### 4.1.3 Fase e etapa: cada item de `estrutura` e de `etapas`

<!-- dicionario: fase -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador da fase. Imutável | `f1` |
| `nome` | texto | sim | Nome da fase | `Planejamento` |
| `etapas` | lista de etapa | sim | Etapas da fase, na ordem de exibição | |

<!-- dicionario: etapa -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador da etapa, usado no campo `etapa` da ação. Imutável | `e1` |
| `nome` | texto | sim | Nome da etapa | `Requisitos e arquitetura` |

#### 4.1.4 Campos opcionais: o objeto `camposOpcionais`

<!-- dicionario: camposOpcionais -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `fasesEtapas` | sim/não | não | Usa fases e etapas. Desligado: lista sem separadores | `true` |
| `descricao` | sim/não | não | Usa o campo descrição das ações | `true` |
| `notas` | sim/não | não | Usa as notas das ações | `true` |
| `codigos` | sim/não | não | Usa os códigos mnemônicos das ações, como `LEV` (seção 4.2). **Ausente: desligado**, ao contrário dos demais | `false` |

Desligar um campo o esconde do formulário, da tabela e das exportações; os dados já gravados são mantidos.

#### 4.1.5 Calendário geral

Um só, para todos os espaços (seção 5.1). Cuidado pelo Administrador do Sistema.

<!-- dicionario: calendarioGeral -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `datasExcluidas` | lista de data excluída (4.1.1) | sim | Feriados nacionais, recessos e outras datas sem expediente na instituição | |
| `alteradoEm` | momento | sim | Última gravação | |
| `alteradoPor` | usuário | não | Autor da última gravação | |

#### 4.1.6 Aprovação: o objeto `aprovacao`

Passo 2.4a. Só no Plano de Ação. Quando o tipo muda para Projeto, `programa` e `aprovacao` são apagados (gravados como vazios).

<!-- dicionario: aprovacao -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `identificacao` | texto | sim | Número do documento de aprovação no SIPAC ou no Protocolo | `23062.001234/2026-11` |
| `link` | texto (endereço web) | não | Endereço para abrir o documento; começa com `https://` ou `http://` | `https://…` |

#### 4.1.7 Modelo: o objeto `modelo`

Passo 2.4b (seção 16.1). Escolhido na criação, entre três modelos, e fixo depois (decisão do responsável, 23/10/2026, a reavaliar com o uso). Os prazos são **ou** por estimativa **ou** por data-limite, nunca os dois no mesmo espaço. O Store recusa gravar o que o modelo desliga: estimativas no espaço com data-limite, data-limite no espaço com estimativas e dependências no espaço sem elas. Regras em `js/modelos.js`.

<!-- dicionario: modelo -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `nome` | texto: `estruturado`, `aberto` ou `personalizado` | sim | Modelo escolhido. Estruturado: estimativa, dependências e simulação. Aberto: data-limite, sem dependências nem simulação. Personalizado: as três escolhas abaixo | `aberto` |
| `prazos` | texto: `estimativa` ou `dataLimite` | sim | Como os prazos das ações são definidos (seção 16.1) | `dataLimite` |
| `dependencias` | sim/não | sim | Usa dependências entre ações. Não: as anteriores não são pedidas nem entram no cálculo | `false` |
| `simulacao` | sim/não | sim | Faz a simulação de Monte Carlo (chance de cumprir o prazo, linha do tempo e índices). Só pode ser sim com prazos por estimativa | `false` |

### 4.2 Ação

Chave: o par (espaço, `numero`).

**Como as ações são identificadas** (decisão do responsável, 20/10/2026). Ferramentas de equipe de uso amplo (Asana, Monday, Notion, Todoist) não mostram código: a dependência é escolhida pelo nome e aparece pelo nome. Códigos poluem a tela e aumentam a carga para o público leigo. Por isso:

- **Número fixo em sequência** (`numero`), como no Jira e no GitHub: 1, 2, 3…, dado pelo sistema ao criar a ação, imutável e nunca reaproveitado (nem depois de exclusões). Não é a posição na lista: inserir uma ação no meio não renumera nada. É ele que liga as dependências. Fica **invisível no uso normal** e aparece só onde é útil: no modo "Editar em planilha" e na importação por planilha, para digitar "depende de 3; 5" num espaço sem códigos.
- **Código mnemônico** (`codigo`), como `LEV`: opcional, ligado em "Configurar o espaço" (campo opcional `codigos`, desligado por padrão). Serve a equipes técnicas e às conversas em reunião ("o LIC atrasou"). Como não liga dependências, pode ser alterado; não pode repetir no espaço.
- Descartado o **número da posição** (MS Project, Smartsheet): inserir uma linha no meio renumera as seguintes, e o que estava escrito em atas passa a apontar para a ação errada.

<!-- dicionario: acao -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `numero` | inteiro | sim | Identificador da ação no espaço: 1, 2, 3…, na ordem de criação. Imutável e nunca reaproveitado; é a referência das dependências | `7` |
| `codigo` | texto | não | Código mnemônico, de 2 a 8 letras maiúsculas ou números, único no espaço. Só aparece com o campo opcional `codigos` ligado | `LEV` |
| `ordem` | inteiro | sim | Posição na "Ordem do espaço" | `3` |
| `etapa` | id | não | Etapa a que a ação pertence (e, por ela, a fase). Vazio: sem fase nem etapa | `e1` |
| `rotulo` | texto | sim | Nome curto, usado no cronograma e no diagrama. Na interface, "Ação" (título de coluna) ou "Nome da ação" (campos e mensagens); "rótulo" é só o nome do campo no banco (decisão do responsável, 23/10/2026) | `Levantar requisitos` |
| `descricao` | texto | não | Descrição completa | |
| `dependeDe` | lista de inteiro | sim | Números das ações anteriores, do mesmo espaço. Lista vazia: sem anteriores | `[1, 4]` |
| `responsaveis` | lista de id | sim | Ids dos responsáveis (4.5). Lista vazia: sem responsável | |
| `estimativas` | lista de estimativa (4.3) | sim | Da primeira à mais recente. A vigente é a última. Sempre vazia no espaço com prazos por data-limite | |
| `dataLimite` | data | não | Data-limite escolhida pela pessoa, só no espaço com prazos por data-limite (passo 2.4b). Vencida e a ação não concluída: carimbo Atrasada. Vazia: a ação não tem prazo | `2026-11-30` |
| `concluidaEm` | data | não | Data de conclusão. Vazio: não concluída | `2026-09-22` |
| `naoAntesDe` | data | não | Data mínima de liberação, "Não começa antes de" (seção 5.1) | `2026-10-19` |
| `notas` | texto (Markdown) | não | Notas da ação (seção 8.5) | |
| `checklist` | lista de item do checklist (4.2.2) | não | Itens a cumprir dentro da ação, na ordem em que foram acrescentados (seção 16.5; passo 2.8). Vazio: sem checklist | |
| `criadaEm` | momento | sim | Criação da ação. Imutável | |
| `alteradaEm` | momento | sim | Última gravação na ação (seção 4.6) | |
| `alteradaPor` | usuário | não | Autor da última gravação | |
| `excluidaEm` | momento | não | Exclusão lógica (seção 4.7). Vazio: ação ativa | |
| `excluidaPor` | usuário | não | Quem excluiu | |

Saíram da versão 1: custo, custo gasto, % concluído, início real e término real separado. O campo `entrega` da ação, previsto antes, foi retirado em 20/10/2026 para não se confundir com as **entregas do Plano de Ação** (seção 16.7); o que a coluna "Entrega" da planilha da PI² dizia passa para a descrição.

#### 4.2.1 Histórico de alterações: um registro por campo alterado

Toda alteração de uma ação gera registros no histórico (seção 16.4; passo 1.16): um por campo que mudou, com o valor antigo e o novo. A criação gera um registro só. Os registros são gravados na mesma operação da alteração (no Firebase, na mesma transação): um não existe sem o outro. Só de acréscimo: ninguém altera nem apaga, nem o Administrador do Sistema. Não entram os carimbos da própria gravação (`criadaEm`, `alteradaEm`, `alteradaPor`, `excluidaPor`), que o registro já guarda em `em` e `por`. A correção de uma estimativa, que não cria item novo em `estimativas` (seção 4.3), também é registrada aqui, com a lista antes e depois.

<!-- dicionario: historico -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador do registro | |
| `entidade` | texto | sim | O que foi alterado. Por enquanto, sempre `acao` | `acao` |
| `chave` | inteiro | sim | Número da ação no espaço | `7` |
| `tipo` | texto | sim | `criacao` ou `alteracao` | `alteracao` |
| `campo` | texto | não | Campo da ação que mudou (seção 4.2). Vazio na criação | `concluidaEm` |
| `antes` | qualquer | não | Valor antes da alteração, no formato do campo. Vazio na criação ou se o campo não existia | `null` |
| `depois` | qualquer | não | Valor depois da alteração. Vazio na criação ou se o campo foi esvaziado | `2026-10-21` |
| `em` | momento | sim | Quando | |
| `por` | usuário | não | Quem. Vazio só em gravações sem login (espaço de exemplo, na memória) | |

#### 4.2.2 Item do checklist: cada item de `checklist`

Passo 2.8 (seção 16.5). Cada item é mudado sozinho, numa operação que lê e grava a ação de uma vez (no Firebase, numa transação): duas pessoas marcando itens ao mesmo tempo não apagam uma à outra (seção 4.6). Cada mudança entra no histórico de alterações (4.2.1), com a lista antes e depois. O checklist não entra no cálculo: marcar itens não conclui a ação nem muda previsões.

<!-- dicionario: checklistItem -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador do item, único na ação | |
| `texto` | texto | sim | O que precisa ser feito | `Enviar minuta à Procuradoria` |
| `feito` | sim ou não | sim | Marcado como feito | `false` |

### 4.3 Estimativa: cada item de `estimativas`

<!-- dicionario: estimativa -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `em` | data | sim | Dia em que a estimativa foi feita | `2026-10-19` |
| `por` | usuário | não | Quem registrou | |
| `o` | dias úteis inteiros | sim | Otimista. A partir de 0 | `3` |
| `m` | dias úteis inteiros | sim | Mais provável. Entre `o` e `p` | `5` |
| `p` | dias úteis inteiros | sim | Pessimista. Maior que 0 | `10` |
| `contaDe` | texto | sim | `liberacao`: conta da liberação (primeira estimativa); `data`: conta do dia `em` (reestimativa) | `data` |
| `motivo` | texto | não | Motivo da reestimativa | `Atraso do fornecedor` |

A primeira estimativa nunca é alterada. Corrigir um erro de digitação logo após cadastrar substitui a estimativa mais recente, sem criar histórico, desde que seja no mesmo dia e antes de qualquer reestimativa. Enquanto a ação não está liberada, a estimativa muda sem histórico (seção 5.3).

### 4.4 Retrato

Chave: id. Pertence a um espaço. Só leitura depois de criado.

**O retrato é uma cópia integral do espaço naquele momento** (decisão de 20/10/2026): o espaço com todos os campos, todas as ações ativas com todos os campos (inclusive notas e o histórico completo de estimativas), os responsáveis citados e os resultados calculados. Assim ele se sustenta sozinho, mesmo que tudo mude ou seja excluído depois, e permite refazer o cálculo exatamente. Só ficam de fora os **comentários** e o **histórico de alterações**, que já são permanentes por conta própria (seções 16.4 e 16.5).

O retrato é guardado em duas partes: o cabeçalho, abaixo, e um registro por ação (4.4.1). Assim, um espaço grande com notas longas não esbarra no limite de tamanho de um documento do Firebase (cerca de 1 MB).

<!-- dicionario: retrato -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador do retrato | |
| `nome` | texto | sim | Nome dado ao retrato | `Plano aprovado` |
| `origem` | texto | sim | `manual` (salvo por um administrador do espaço) ou `automatico` (salvo pelo sistema). Na tela, cada origem tem um selo | `manual` |
| `criadoEm` | momento | sim | Quando foi salvo | |
| `criadoPor` | usuário | não | Quem salvou. Vazio nos automáticos | |
| `semente` | inteiro | sim | Semente usada no cálculo | `20261014` |
| `simulacoes` | inteiro | sim | Número de simulações usado | `10000` |
| `versaoCalculo` | inteiro | sim | Versão do método de cálculo (seção 5.7) | `1` |
| `espaco` | espaço (4.1) | sim | Cópia integral do espaço, com todos os campos de 4.1 | |
| `datasExcluidasEfetivas` | lista de data excluída (4.1.1) | sim | Datas excluídas que valiam no cálculo naquele momento: calendário geral, menos as desconsideradas, mais as do espaço. O calendário geral pode mudar depois; sem esta cópia, refazer o cálculo daria outro resultado | |
| `responsaveis` | lista de responsável (4.5) | sim | Cópia integral dos responsáveis citados nas ações, para os nomes continuarem legíveis | |
| `resumo` | resumo do retrato (4.4.2) | sim | Resultado do espaço naquele momento | |

Os retratos **automáticos não podem ser excluídos** à mão, para o histórico usado no Data Lakehouse não ter buracos. O retrato automático depende de um programa no servidor; chega com o servidor da UFCI-MG (passo 4.4). No Firebase gratuito, só há retratos manuais.

Se um dia for preciso apagar algum texto de um retrato por exigência legal, isso será tratado caso a caso pela equipe de TI, fora do sistema (decisão de 20/10/2026: situação extremamente rara, que não justifica uma função própria).

#### 4.4.1 Ação do retrato: um registro por ação

Cada ação do retrato tem **todos os campos da ação (4.2)**, copiados como estavam, e mais estes valores calculados naquele momento:

<!-- dicionario: retratoAcaoCalculos -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `situacao` | texto | sim | `naoLiberada`, `liberada` ou `concluida` | `liberada` |
| `atrasada` | sim/não | sim | Carimbo Atrasada | `false` |
| `liberacaoPrevista` | data | sim | Data prevista de liberação | `2026-10-05` |
| `conclusaoPrevista` | data | sim | Data prevista de conclusão; no espaço com data-limite, a data-limite (vazia se a ação não tem) | `2026-10-27` |
| `folga` | dias úteis | sim | Folga total no cálculo determinístico; 0 no espaço com data-limite, que não tem caminho crítico | `4` |
| `prioridadeExecucao` | número de 0 a 1 | sim | Índice de criticidade (seção 7.1). Vazio no espaço sem simulação (passo 2.4b) | `0.72` |
| `prioridadeRevisao` | número de 0 a 1 | sim | Contribuição para a variância do prazo (seção 7.2). Vazio no espaço sem simulação (passo 2.4b) | `0.18` |

#### 4.4.2 Resumo do retrato: o objeto `resumo`

<!-- dicionario: retratoResumo -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `conclusaoPrevista` | data | sim | Conclusão prevista do espaço (P50). Sem simulação: a do cálculo determinístico, no espaço com estimativas, ou vazia, no espaço com data-limite (passo 2.4b) | `2026-12-22` |
| `dataSegura` | data | sim | Data com 80% de chance (P80). Vazia sem simulação | `2027-01-15` |
| `p95` | data | sim | Data com 95% de chance. Vazia sem simulação | `2027-02-03` |
| `chancePrazo` | número de 0 a 1 | não | Chance de cumprir o prazo final. Vazio se o espaço não tem prazo final ou não tem simulação | `0.74` |

### 4.5 Responsável

Chave: id. Pertence a um espaço (desde o passo 1.14b), com cadastro livre em "Configurar este espaço".

**Revisto em 21/10/2026 (decisão do responsável; feito no passo 1.14b):** os responsáveis **criados no sistema** passam a ser **de cada espaço**: ficam dentro do espaço (`espacos/{id}/responsaveis/{id}`), aparecem só nele e são cuidados em "Configurar este espaço". A mesma pessoa em dois espaços tem dois cadastros, até a integração com a instituição; o e-mail de login não se repete dentro de um espaço, mas pode aparecer em vários. Só os responsáveis **da instituição** (servidores pela IU e unidades organizacionais do CEFET-MG, Fase 4) formam uma lista geral, só para leitura, vinda de outro sistema. **O Administrador do sistema não cadastra responsáveis.**

<!-- dicionario: responsavel -->
| Campo | Tipo | Obrig. | Significado | Exemplo |
|---|---|---|---|---|
| `id` | id | sim | Identificador do responsável. Imutável | |
| `tipo` | texto | sim | `pessoa` ou `unidade` (unidade organizacional, equipe ou grupo de unidades). Escolhido no cadastro e **imutável**. Define o desenho na tela: pessoa num círculo com as iniciais; unidade num quadrado arredondado com a sigla | `pessoa` |
| `nome` | texto | sim | Nome da pessoa, equipe ou unidade | `Ana Souza` |
| `sigla` | texto | não | Sigla curta, usada em espaços pequenos como o diagrama; numa unidade, é o que aparece no quadrado | `DTI` |
| `setor` | texto | não | Setor ou unidade | `DGDI` |
| `usuario` | usuário | não | E-mail de login ligado a este responsável. Vazio: responsável sem login. Só uma pessoa pode ter login | `ana@ufci.edu.br` |
| `criadoEm` | momento | sim | Cadastro do responsável. Imutável | |
| `alteradoEm` | momento | sim | Última gravação | |
| `alteradoPor` | usuário | não | Autor da última gravação | |
| `excluidoEm` | momento | não | Exclusão lógica (seção 4.7) | |
| `excluidoPor` | usuário | não | Quem excluiu | |

O campo `tipo` (decisão do responsável, 20/10/2026) separa **pessoas** de **unidades**. **O tipo não muda depois do cadastro** (decisão do responsável, 21/10/2026): pessoa e unidade são coisas diferentes, e "converter" uma na outra seria estranho. Um cadastro com o tipo errado é corrigido criando outro, com o tipo certo, e excluindo o errado com a opção "substituir por" (seção 4.7), que passa todas as ações para o novo de uma vez, sem refazê-las à mão. Entre as pessoas, há hoje dois casos, sem campo próprio para distingui-los:

- **Membro da equipe com acesso ao sistema:** tem `usuario`. Para esses, funcionam o filtro "Minhas ações" e, na Fase 2, os papéis por espaço.
- **Responsável diverso:** pessoa de fora do sistema, ou qualquer unidade organizacional, equipe ou grupo de unidades (`tipo: unidade`). Fica sem `usuario`. É cadastrado livremente, inclusive direto no formulário da ação ("Cadastrar … como responsável").

**Quatro tipos de responsável, previstos para o sistema definitivo (antiga Fase 4)** (decisão do responsável, 21/10/2026). O tipo (pessoa ou unidade) e a **origem** (da instituição ou criado no sistema) são duas perguntas separadas:

| | Da instituição | Criado no sistema |
|---|---|---|
| **Pessoa** | (i) usuário do sistema, identificado pela Identificação Única (IU) do CEFET-MG | (ii) etiqueta: pessoa de fora, ou que não usa o sistema |
| **Unidade** | (a) unidade organizacional oficial, do banco de dados da instituição | (b) grupo de pesquisa, comissão temporária ou outro grupo de pessoas |

- Os cadastros **da instituição** vêm de fora e não são editados no sistema: nome, e-mail e sigla seguem o cadastro oficial, sem duplicatas nem nomes escritos de jeitos diferentes. Cada um guarda o identificador oficial (a IU da pessoa; o código da unidade). As unidades oficiais vêm em árvore (subunidades), o que permite, no futuro, filtros como "ações da DGDI e das suas subunidades".
- Os cadastros **criados no sistema** continuam livres, como hoje.
- No protótipo, o e-mail de login (`usuario`) é a forma provisória de ligar uma pessoa a quem entra no sistema (login por e-mail e senha, passo 1.14). Com a IU, a ligação passa a ser pelo identificador da IU.
- Campos previstos (seção 4.10): `origem` (`instituicao` ou `sistema`) e `identificadorInstitucional`. Não entram no protótipo, porque, sem a IU e o banco de unidades, ficariam vazios.

### 4.6 Edição simultânea

Várias pessoas podem editar o mesmo espaço ao mesmo tempo. Nenhuma gravação pode apagar, em silêncio, o trabalho de outra pessoa. A versão 1 já grava só o campo alterado e mostra as mudanças em tempo real; a versão 2 mantém isso e fecha três falhas encontradas na versão 1 em 17/10/2026 (registradas nas pendências da documentação da versão 1).

| Situação | Regra |
|---|---|
| Duas pessoas mudam campos diferentes | Cada gravação leva só o campo alterado, nunca a ação inteira |
| Responsáveis e "depende de" | Acrescentar e retirar itens um a um, nunca regravar a lista inteira. Assim, se duas pessoas acrescentam responsáveis ao mesmo tempo, os dois ficam |
| Reestimativa | Entra no fim do histórico, sem regravar as anteriores. A correção de digitação da seção 4.3, que substitui a mais recente, só grava se ninguém tiver acrescentado outra estimativa nesse meio-tempo |
| Ação nova | O número é reservado no banco (contador do espaço, gravado numa transação), e não na tela de quem cria: duas pessoas criando ao mesmo tempo recebem números diferentes. O código mnemônico, quando usado, é conferido contra o banco; se outra pessoa usou o mesmo código antes, aparece "Já existe uma ação com o código X. Escolha outro." |
| Mesmo campo, mesma ação, quase juntas | Vale a última gravação, mas sem surpresa: se a ação aberta na janela for alterada por outra pessoa, a janela mostra "Fulano alterou esta ação agora" e atualiza os campos que não estão sendo editados. O campo em edição fica como está, e a pessoa decide se grava |
| Importação, restauração e regravação de ações inteiras | Só em operações explícitas, com confirmação, e nunca durante a edição comum |

Os campos `alteradaEm` e `alteradaPor` (seção 4.2) servem para o aviso. As regras dizem o que garantir, não como: cada banco as executa do seu jeito (seção 3.4). No modo local há um usuário só. Cada regra tem um teste em `node --test`, com duas gravações concorrentes simuladas.

### 4.7 Exclusão lógica

Nada é apagado de verdade pelo uso comum do sistema. Excluir um espaço, uma ação ou um responsável grava **quando** e **quem** excluiu (`excluidoEm`/`excluidaEm` e `excluidoPor`/`excluidaPor`), e o item some da tela.

- **Um único filtro, no `Store`.** As operações comuns (listar ações, calcular, exportar) devolvem só itens ativos. Ver os excluídos exige pedir explicitamente: a lixeira, a cópia de segurança e as cargas para o Data Lakehouse. Como nenhuma outra parte do código lê o banco (seção 3.4), o filtro existe num lugar só.
- **Teste automático:** um espaço de exemplo com uma ação excluída; o teste confere que ela não aparece na lista, no quadro, no cálculo, na simulação nem nas exportações, e que aparece na lixeira e na cópia de segurança.
- **Desfazer:** a lixeira do espaço mostra as ações excluídas, com quem e quando, e permite restaurá-las.
- **Exclusão encadeada:** excluir algo que outros itens usam abre uma janela que explica a consequência e oferece alternativas.
  - **Ação de que outras dependem:** (a) ligar as dependentes às anteriores da ação excluída, mantendo a sequência lógica; é a opção já marcada, e só aparece se a excluída tiver anteriores; (b) só retirar a dependência; (c) cancelar e rever a estrutura.
  - **Responsável que está em ações:** (a) substituir por outro responsável; (b) só retirar das ações; (c) cancelar.
  - **Etapa ou fase com ações:** (a) mover as ações para outra etapa; (b) deixar as ações sem etapa; (c) cancelar.
  - Cada mudança feita assim entra no histórico de alterações das ações afetadas. Restaurar o item da lixeira não refaz as ligações alteradas; o histórico mostra como eram.
- **Código ocupado:** o código de uma ação excluída continua reservado. Ao tentar criar uma ação com ele, o sistema oferece restaurar a antiga.
- **Carga incremental:** `alteradaEm` muda também na exclusão, para que a carga perceba.

Motivos da escolha, em vez de uma lista separada de exclusões: uma única consulta para a carga incremental, possibilidade de desfazer, auditoria completa (inclusive o conteúdo do que foi excluído) e retratos antigos que continuam mostrando o nome das ações.

### 4.8 Valores calculados, que não ficam no banco

O banco guarda os fatos: estimativas, dependências, datas de conclusão. O que deriva deles e da data de hoje é calculado na tela, a cada mudança, e **não é gravado**: um valor gravado ficaria velho no dia seguinte e criaria duas fontes de verdade. Quem fizer cargas para o Data Lakehouse encontra esses valores congelados nos retratos (4.4).

| Valor | Onde é definido |
|---|---|
| Situação (Não liberada, Liberada, Concluída) e carimbo Atrasada | Seção 6 |
| Datas previstas de liberação e de conclusão, folga | Seções 5.1 a 5.5 |
| Estimativa vigente, número de reprogramações, deslocamento do término | Seção 5.3 |
| Conclusão prevista (P50), data segura (P80), P95 e chance de cumprir o prazo | Seção 5.7 |
| Prioridade de execução e prioridade de revisão | Seções 7.1, 7.2 e 15 |

### 4.9 Onde cada entidade é guardada

| Entidade | Firebase (versão 2, segundo projeto) | PostgreSQL (servidor da UFCI-MG, proposta) |
|---|---|---|
| Espaço | `espacos/{id}` | tabela `espaco` |
| Data excluída, documento | listas dentro do espaço | tabelas `espaco_data_excluida`, `espaco_documento` |
| Fase, etapa | lista `estrutura` dentro do espaço | tabelas `fase`, `etapa` |
| Ação | `espacos/{id}/acoes/{numero}` | tabela `acao`, chave (`espaco_id`, `numero`) |
| Dependência | lista `dependeDe` dentro da ação | tabela `acao_dependencia` |
| Responsável da ação | lista `responsaveis` dentro da ação | tabela `acao_responsavel` |
| Estimativa | lista `estimativas` dentro da ação | tabela `estimativa` |
| Histórico de alterações | `espacos/{id}/historico/{id}` | tabela `historico`, com `espaco_id` |
| Retrato | cabeçalho em `espacos/{id}/retratos/{id}`; ações em `espacos/{id}/retratos/{id}/acoes/{numero}` | tabelas `retrato`, `retrato_acao` |
| Calendário geral | documento `sistema/calendario` | tabela `data_excluida_geral` |
| Responsável (criado no sistema) | `espacos/{id}/responsaveis/{id}` | tabela `responsavel`, com `espaco_id` |

Os nomes do Firebase passam a ser em português, porque a versão 2 usa um projeto novo (seção 3.3); os nomes da versão 1 (`projects`, `tasks`, `people`) não são usados. No PostgreSQL, as listas viram tabelas de ligação e as regras da seção 4.6 viram restrições do banco (seção 3.4).

### 4.10 Entidades previstas, ainda fora do código

Entram no dicionário, com tabela marcada e teste, no passo em que forem construídas.

- **Fase 2 e seguintes:** campos opcionais da seção 16.8 (`etiquetas`, `posicaoPrioridade`, `documentos` da ação, `justificativa`, `local`, `dataLimite`; depois, `custoPrevisto`, `custosExecutados`, `orcamento` e o registro de riscos).
- **Sistema definitivo (antiga Fase 4):** origem dos responsáveis (`origem`: `instituicao` ou `sistema`) e identificador institucional (`identificadorInstitucional`: a IU da pessoa ou o código da unidade), com a lista de unidades oficiais em árvore (seção 4.5).
- **Fase 2:** entregas do Plano de Ação e registro do alcance, com evidência (seção 16.7); tipo do espaço, visibilidade, espaço aberto ou fechado, encerramento e papéis por espaço (seção 16.3); catálogo do PEI/PDI (seção 16.1); situações personalizadas (seção 16.2); comentários (seção 16.5). O checklist entrou no passo 2.8 (4.2.2).

---

## 5. Regras de cálculo

### 5.1 Contagem do tempo

- Prazos em **dias úteis**: de segunda a sexta, descontadas as datas excluídas, que vêm de dois cadastros (decisão do responsável, 21/10/2026):
  - **Calendário geral**, cuidado pelo Administrador do Sistema em "Configurar o sistema" (menu do usuário): feriados nacionais, recessos e datas da instituição, que valem para todos os espaços. Um botão acrescenta as datas de um ano conforme a lista anual típica do MGI (feriados nacionais e pontos facultativos, inclusive os móveis: Carnaval, Quarta-feira de Cinzas, Paixão de Cristo, Corpus Christi; Dia do Servidor Público, vésperas de Natal e de Ano Novo), para revisão antes de salvar: a lista pode ser corrigida e completada. Os pontos facultativos de parte do dia entram como dia inteiro, por zelo com os prazos. As pontes prováveis (segunda-feira antes de feriado na terça; sexta-feira depois de feriado na quinta) entram com o motivo "⚠️ Ponte provável (ponto facultativo) — confira na portaria do MGI" (decisão do responsável, 21/10/2026). Os anos oferecidos vão do anterior a dois à frente do ano corrente. Até existirem os papéis (Fase 2), qualquer pessoa conectada pode editá-lo.
  - **Datas do espaço**, cuidadas pelo administrador do espaço em "Configurar o espaço": feriados locais e exclusões específicas, que complementam o calendário geral. Ali se vê também a lista geral, sem poder editá-la, e se pode **desconsiderar** uma data geral no espaço (por exemplo, um ponto facultativo em que a equipe trabalha).
  - Datas efetivas do espaço = calendário geral, menos as desconsideradas, mais as do espaço.
  - Nas listas editáveis (datas e documentos), o que ainda não foi salvo fica destacado, com o aviso "Alterações não salvas" junto do botão Salvar; ao salvar, volta à aparência normal.
- Uma ação é **liberada** quando todas as anteriores estão concluídas. Sem ações anteriores, é liberada no início do espaço.
- **"Não começa antes de" (data mínima, opcional).** A ação só é liberada quando todas as anteriores estiverem concluídas **e** essa data tiver chegado. Liberação = a mais tardia entre a conclusão das anteriores e a data mínima. É o mesmo conceito da restrição "não iniciar antes de" do MS Project, numa forma simples.
  - **Nova ação:** o campo já vem preenchido com a data de criação. Assim, uma ação criada depois que as anteriores terminaram não nasce atrasada. O usuário pode apagar a data, se a ação puder começar assim que as anteriores terminarem.
  - **Outros usos:** ações que dependem de uma data externa, como liberação de orçamento, início do semestre ou publicação de um ato.
  - Enquanto a data não chega, a ação fica "Não liberada", com a indicação "a partir de dd/mm".
  - **Na janela da ação:** o campo só aparece quando tem data. Vazio, dá lugar a um link discreto, "+ Definir data mínima de início", que abre o campo. Em ações concluídas, não aparece.
  - **Em reavaliação** (seção 14, item 1).
- **O prazo de uma ação conta da liberação até a conclusão**, incluindo o tempo até alguém começar. A data de início real não é registrada. Isso precisa estar claro no formulário de estimativa e na Ajuda.

### 5.2 Estimativa de cada ação

- Fórmula PERT: (O + 4M + P) / 6, a média da distribuição beta-PERT.
- **Os três pontos são dias úteis inteiros** (decisão do responsável, 20/10/2026): o calendário conta em dias inteiros, e a fração sugeriria uma precisão que a estimativa não tem; a incerteza se expressa pela distância entre otimista e pessimista. O otimista pode ser 0 ("pode terminar no dia em que for liberada"). O prazo PERT resultante pode ter fração, que o calendário arredonda ao virar data.
- **Uma só distribuição em todo o sistema: beta-PERT.** A escolha entre triangular e beta é retirada. Motivos: coerência entre as datas do cronograma e a simulação, simplicidade para o usuário leigo e estabilidade das datas e carimbos. O otimismo nas estimativas será tratado pela previsão por classe de referência, não por troca de fórmula.

- **Ação sem estimativa** (decisão do responsável, 21/10/2026; passo 1.14a): pode existir, para a criação rápida. Conta como zero dias no cálculo e na simulação, só para o fluxo não quebrar; leva a marca **"Falta estimar"** no lugar da conclusão prevista, e o espaço avisa "Previsão incompleta: N ações sem estimativa contam como zero dias". Não recebe o carimbo Atrasada, porque não tem prazo para vencer, e não mostra as prioridades de execução e de revisão, que sairiam de uma duração zero (a faixa de cor fica neutra); como qualquer ação liberada, não termina no passado (seção 5.5). Rejeitados: esconder as previsões enquanto faltar estimativa (o espaço em montagem ficaria sem informação) e pedir um único número de dias (estimativa sem incerteza deixaria a chance de cumprir o prazo otimista sem ninguém perceber).

### 5.3 Reestimativa

- **Antes da liberação**, a estimativa pode ser alterada livremente, sem histórico: ainda é planejamento. A estimativa "original", que vale para o histórico e para a previsão por classe de referência, é a vigente no momento da liberação. Aceita pelo responsável, mas **em reavaliação** (seção 14, item 2).

- Disponível **a qualquer momento** para ação liberada e não concluída. Para ação atrasada, aparece em destaque, com alerta.
- O usuário informa os três pontos do **tempo que falta, a partir de hoje**.
- Cada reestimativa é registrada com data, autor, três pontos e motivo opcional.
- Conclusão prevista de uma ação reestimada: data da reestimativa + PERT dos novos três pontos.
- A tela da ação mostra a estimativa original, o número de reprogramações e quantos dias úteis o término andou desde a primeira estimativa.

### 5.4 Ações concluídas

Entram em todos os cálculos com a **duração real**, da liberação à conclusão, sem sorteio.

### 5.5 Regra interna: nada termina no passado

Para uma ação liberada e não concluída cuja conclusão prevista já passou sem reestimativa, **o cálculo considera conclusão a partir de hoje**. Na simulação, vale o mesmo: um sorteio que terminaria antes de hoje passa a terminar hoje.

A regra não restringe o usuário; só evita previsões otimistas demais. Na tela, quando ela estiver em ação, aparece ao lado da data prevista: "Prazo vencido sem reestimativa: o cálculo considera conclusão a partir de hoje." Ela deve constar na Ajuda e no manual, quando este for refeito.

### 5.6 Recálculo

Tudo é recalculado a cada mudança: conclusão, reestimativa ou edição. A estimativa vigente de cada ação é a mais recente.

### 5.7 Simulação de Monte Carlo

- Distribuição beta-PERT.
- **Semente e número de simulações visíveis, mas imutáveis.** São definidos na criação do espaço (pelo usuário ou com o padrão) e aparecem em "Configurar este espaço" só para leitura. Assim, qualquer pessoa ou IA pode conferir os resultados por fora, em planilha, Python ou R, e ninguém pode trocar a semente até o número "ficar bonito".
- **Conferência por fora:** a seção 15 deve documentar, junto com o código da versão 2, o gerador de números (mulberry32), a ordem dos sorteios e o método de sorteio da beta-PERT, para permitir reproduzir os resultados **exatamente**. Uma ferramenta com outro gerador chega a resultados estatisticamente equivalentes, com diferença da ordem de meio ponto percentual na chance de cumprir o prazo.
- **Versão do cálculo:** se um dia o método de cálculo mudar (por exemplo, a correção de um erro), a mesma semente passa a dar outro resultado. Por isso, o código tem um número de versão do cálculo, guardado em cada retrato.
- Ações concluídas: duração real. Ações reestimadas: a contagem começa na data da reestimativa. Regra da seção 5.5 aplicada.
- **Resultados do espaço:** datas P50, P80 e P95 da conclusão, chance de cumprir o prazo final e distribuição das datas finais (gráfico).
- **Resultados por ação:** índice de criticidade (seção 7.1) e contribuição para a variância do prazo (seção 7.2). Fórmulas e justificativas na seção 15.
- **Saem da tela o SSI e a crucialidade** como números próprios. A contribuição para a variância é a forma padrão e mais comunicável de responder à pergunta que os dois respondiam (seção 15.4).

---

## 6. Situações e carimbo

### 6.1 Situação: exatamente uma

| Situação | Quando |
|---|---|
| **Não liberada** | Alguma ação anterior não foi concluída, ou a data mínima ("Não começa antes de") não chegou. Antes chamada "Aguardando" (seção 16.2) |
| **Liberada** | Todas as anteriores concluídas (ou nenhuma anterior), e esta não concluída |
| **Concluída** | Tem data de conclusão |

### 6.2 Carimbo **Atrasada**

- Aplica-se à ação **liberada** cuja data prevista de conclusão (PERT da estimativa mais recente) já passou.
- O atraso é medido contra a **estimativa mais recente**, de propósito. A reestimativa tira o carimbo. É uma "colher de chá" ao executor, que exige dele uma atitude ativa (assumir uma nova data). O histórico de reprogramações registra a dimensão do problema.
- Uma ação não liberada nunca recebe o carimbo, porque, pela regra da seção 5.5, a previsão das anteriores não fica no passado.
- Não existe mais o carimbo "Prioritária": a prioridade é mostrada pela barra contínua da seção 7.1.

---

## 7. Indicadores por ação

Barras horizontais, com o número em cinza ao lado. A tabela pode ser ordenada por qualquer uma delas.

### 7.1 Prioridade de execução

*Termo técnico: índice de criticidade.*

Legenda: "Quanto um atraso nesta ação atrasa a conclusão prevista. Por exemplo, com 70%, cada dia de atraso nesta ação atrasa a conclusão em cerca de 0,7 dia. Considera só o prazo final; outros motivos de prioridade ficam a critério da equipe."

Fundamento: em cada simulação, um dia a mais numa ação atrasa a conclusão de todas as ações em um dia se ela estiver no caminho crítico, e em zero se não estiver. A média é o índice de criticidade. Por isso ele mede exatamente o efeito esperado de um atraso.

### 7.2 Prioridade de revisão do planejamento

*Termo técnico: contribuição para a variância do prazo.*

Legenda: "Esta ação responde por 18% da incerteza do prazo final. Quanto maior, mais vale revisar as estimativas, dividir a ação ou reduzir riscos." (o número é o da ação)

- **O que mostra:** a parcela da incerteza do prazo final que vem de cada ação. As parcelas de todas as ações não concluídas somam 100%.
- **Número em cinza:** a parcela em porcentagem inteira; abaixo de 1%, aparece "<1%".
- **Barra:** proporcional à parcela, numa escala fixa de 0% a 100%. Assim, a barra e o número dizem a mesma coisa, e o tamanho da barra pode ser comparado entre espaços.
- **Fundamento:** é a medida padrão das ferramentas de análise de risco de cronograma (gráfico "tornado"). Uma ação previsível no caminho crítico tem prioridade de execução alta e parcela quase nula: não há incerteza nela para reduzir. Detalhes matemáticos na seção 15.
- **Natureza relativa:** a parcela compara as ações entre si. Isso é adequado aqui, porque a barra serve para ordenar onde revisar o planejamento, não para disparar alertas.

### 7.3 Cores no fluxo e no cronograma

- **Intensidade contínua pela prioridade de execução:** a cor de cada ação não concluída varia gradualmente do **cinza** (índice de criticidade 0%) ao **vermelho** (100%). Quanto mais vermelha, mais um atraso nela atrasa a conclusão.
- **Verde:** ação concluída.
- Saem as categorias "sem folga", "quase sem folga" e "com folga", o limite de 10 dias (`nearCrit`) e as setas vermelhas do caminho crítico determinístico. Tudo passa a seguir uma única medida, a mesma da barra da seção 7.1. Isso evita que uma ação apareça como "crítica" numa tela e com prioridade baixa em outra.
- A folga em dias úteis continua visível como número, no detalhe da ação e no rótulo do fluxo.
- A legenda mostra a faixa de cores, de cinza a vermelho, com "menos prioritária" e "mais prioritária" nas pontas.
- As cores do gradiente seguem a paleta do logotipo e são ajustadas para o tema escuro.

### 7.4 Símbolos

Os mesmos da planilha da PI², no fluxo, no cronograma e na aba Ações:

| Símbolo | Significado |
|---|---|
| Visto num círculo | Concluída |
| Cadeado aberto | Liberada |
| Cadeado fechado | Não liberada |
| Relógio | Atrasada |

São ícones em SVG, desenhados no mesmo estilo e coloridos pelas variáveis dos temas, e não emojis (seção 16.2). O protótipo ainda usa emojis e "Aguardando"; vale esta seção.

Saem o símbolo "▶ em andamento", porque o sistema não registra mais o início real, e o "❗ prioritária", substituído pela intensidade da cor.

---

## 8. Interface

### 8.0 Como a tela está hoje (resumo)

As seções 8.1 a 8.5 guardam as decisões de interface na ordem em que foram tomadas, com as revisões ("Revisto em…"). Quando duas se contradizem, vale a mais recente. Este resumo descreve o estado em 23/10/2026.

**Barra lateral** (como no Todoist e no Notion): no alto, quem entrou (trocar senha, sair) ou "Entrar"; no meio, os espaços, agrupados por tipo ("Planos de Ação", depois "Projetos", só os tipos que existem; seção 16.1), cada um com a engrenagem de "Configurar este espaço", e "Novo espaço"; no pé, Legenda, Lixeira, "Ajuda e manual" e "Configurar o sistema". No computador, fica ao lado do conteúdo e pode ser recolhida (lembrado no aparelho): o botão de recolher fica no canto superior direito dela. Recolhida, o canto da barra do topo fica vazio, o nome do espaço aparece grande no alto do conteúdo e um **puxador** na borda esquerda da tela abre a barra de novo; **Ctrl+B** (⌘B no Mac) abre e recolhe. No celular, abre por cima, com fundo escurecido, pelo botão de três linhas.

**Barra do topo do espaço, no computador** (três grupos, como no Numbers do Mac; aprovada em 23/10/2026):

| Grupo | Conteúdo |
|---|---|
| Esquerda | Menu **Visualização**, com o nome da atual: Lista, Quadro, Rede, Cronograma, Planilha e Linha do tempo, nessa ordem |
| Centro | **Classificar e filtrar** (ordem: a do espaço, índice de criticidade, contribuição para a incerteza ou conclusão prevista; filtro por situação, com contagens; filtro por responsável e "Minhas ações"; limpar filtros), com um ponto quando a ordem não é a do espaço e o número de filtros ativos. **Exibir** ("Mostrar até" fases, etapas ou ações; identificador antes do nome: nenhum, número ou código; na lista, as colunas Descrição, Participantes e Indicador; na planilha, a escolha das colunas). **Indicador**, onde há barras (quadro, e lista com a coluna Indicador): tempo restante, índice de criticidade ou contribuição para a incerteza e, na barra de tempo, o número ao lado em dias úteis restantes ou data prevista. Cada menu só aparece onde vale: na planilha, no cronograma, na rede e na linha do tempo não há filtros nem ordem, porque as setas e a grade precisam do espaço inteiro |
| Direita | Chip "N atrasada(s)", que filtra as atrasadas, e **Nova ação** |

Os painéis abrem sob o menu, com a transição padrão. Até 1399 px de largura, os menus do centro mostram só o ícone (o nome aparece ao passar o mouse); entre 641 e 1099 px, sem espaço para centralizar, os grupos ficam lado a lado. Entre 641 e 899 px (tablet), a barra lateral abre por cima, como no celular, e o nome do espaço fica na barra do topo. A barra do topo ocupa a largura toda; o conteúdo fica em até 1240 px, salvo planilha, cronograma e rede, que usam a largura toda. Planilha e rede vão até o fim da tela.

**No celular (até 640 px):** à esquerda, o botão da barra lateral e um funil que abre "Filtros e ordem" (painel que sobe de baixo); no meio, o nome do espaço; numa segunda linha, Exibir e os seletores de Indicador e "Mostrar até". O botão (+) cria ações. Só Lista e Quadro.

**Visualizações:**

| Visualização | O que mostra |
|---|---|
| **Lista** | Cartões agrupados por fase e etapa (em qualquer ordem escolhida), com o ícone da situação antes do nome, avisos pequenos sob ele (data mínima, "Falta estimar", reprogramações, progresso do checklist) e as colunas escolhidas: descrição, participantes (em ordem alfabética, pela sigla) e o indicador. Na linha de cada etapa aberta, a legenda do indicador, com explicação ao passar o mouse e link para o glossário. "+ Adicionar ação" no fim de cada etapa |
| **Quadro** | Colunas Não liberadas, Liberadas e Concluídas, com cartões enxutos (nome, etapa, participantes, indicador); arrastar para Concluídas registra a conclusão |
| **Rede** | Fluxo das ações em camadas, com faixas por etapa e marcos, setas em ângulo reto que não passam sobre cartões e salto onde se cruzam; zoom com Ctrl + rolar ou − e +, arraste do fundo; "Ver tudo" |
| **Cronograma** | Gantt por fase e etapa, com dependências, caminho crítico, hoje, prazo final e comparação com um retrato; semanas ou meses |
| **Planilha** | Grade editável, só no computador (seção 8.3, passo 1.11 da seção 12): todos os campos, inclusive os calculados, com Nº e Ação parados à esquerda |
| **Linha do tempo** | Distribuição das datas de conclusão simuladas, com conclusão prevista, data segura (P80), prazo final e chance de cumpri-lo |

**Ação:** a janela da ação mostra situação, conclusão prevista e os dois índices no alto; "Reestimar" e "Registrar conclusão"; campos editáveis no lugar (código, etapa, descrição, data mínima, estimativa enquanto livre); dependências e responsáveis como etiquetas, com busca; checklist; anotações com editor visual; histórico das estimativas e histórico de alterações; excluir. Sem abrir a janela, **Alt+clique** edita no lugar o nome (lista, quadro e rede), a descrição (lista) e os participantes (lista e quadro). "Nova ação" abre uma janela compacta, com o nome e os três pontos; a estimativa pode ficar para depois ("Falta estimar"). Na interface, o campo `rotulo` se chama **Ação** (títulos de coluna) ou **Nome da ação** (campos e mensagens) (decisão do responsável, 23/10/2026).

**Novo espaço:** nome, tipo (Plano de Ação ou Projeto, em dois cartões com a explicação; no Plano de Ação, o Programa do PEI/PDI e o documento de aprovação), início e prazo final.

**Configurar este espaço:** dados (nome, tipo, com o Programa e a aprovação no Plano de Ação, início, prazo final), datas excluídas próprias e desconsideradas do calendário geral, fases e etapas, campos opcionais (fases e etapas, descrição, anotações, códigos), documentos, responsáveis (com importação por planilha e criação das contas de acesso), retratos, importação de ações, exportação e a simulação (semente e número de cenários, só leitura). No fim, "Excluir este espaço". **Configurar o sistema:** calendário geral, com sugestão anual dos feriados, e a cópia de segurança.

**Abertura:** quem não tem espaço vê as boas-vindas (criar espaço, ver o exemplo e, com o banco vazio, restaurar a cópia de segurança); quem tem, vai ao último espaço aberto naquele aparelho.

### 8.1 Topo

*Revisto em 21/10/2026 (passo 1.14c):* o menu do espaço e o menu do usuário deram lugar ao **menu lateral** (`js/telas/navegacao.js`), descrito no passo 1.14c da seção 12. A barra do topo ficou só com o botão do menu lateral, à esquerda, e o nome do espaço, no centro; logotipo, nome do sistema e sigla da instituição saíram da tela de trabalho. O que segue sobre os menus do topo vale como histórico; continua valendo o comportamento da barra ao rolar (cor do fundo no alto da página, vidro ao rolar).

- **Barra do aplicativo compacta, com dois estados**, como no Spotify do iPhone: **no topo da página**, sem rolagem, fica **da cor do fundo da página**, sem linha na base, com os textos na cor normal (o tom levemente mais escuro, testado antes, foi abandonado: pesava no topo); **ao rolar**, transforma-se suavemente em **vidro bem transparente** (cerca de 20% de véu no tema claro e 30% no escuro), que desfoca o conteúdo que passa por baixo, com uma linha fina na base e uma sombra suave. **A ida e a volta são simétricas**: a mesma transição de 0,3 s, com o mesmo desfoque nos dois estados (só a cor, a linha e a sombra mudam), para a volta ao topo ser o inverso exato da descida. Fica fixa no alto, com 48 px de altura. Reúne numa linha: logotipo e nome do sistema, menu do espaço (nome do espaço aberto, com uma setinha) e menu do usuário (iniciais). A Ajuda não tem botão próprio na barra: fica no menu do usuário, para poluir menos a tela. No celular, o nome encolhe para "Planos de Ação"; **no celular na vertical, logotipo e nome somem**, e o menu do espaço ocupa o espaço (KISS). Quem ativou "Reduzir transparência" no sistema, ou usa navegador sem suporte ao desfoque, vê a barra opaca, na cor de fundo da página. Objetivo: o máximo de tela para as ações.
- **Revisto em 21/10/2026 (decisão do responsável):** as ferramentas da lista foram para a **barra do topo, à direita**: seletor de modo (ícones), **Filtrar** (ícone de funil, com o número de filtros ativos; abre um painel pequeno com situação e contagens, responsável, "Minhas ações" e "Limpar filtros"), **Ordenar** (ícone de setas, com um ponto quando a ordem não é a do espaço; abre as ordens e "Recolher fases") e **Nova ação**. Os painéis fecham ao clicar fora ou com Esc. No alto do conteúdo ficam só os avisos: "N ações atrasadas. Ver" (filtra as atrasadas; de novo, mostra todas) e "Previsão incompleta". A **Legenda** virou um item no pé do menu lateral, que a mostra e esconde. No celular, a barra tem só o nome do espaço e um funil, que abre "Filtros e ordem" (modo, situação, responsável, ordem e recolher fases); o (+) flutuante cria ações. O que segue nesta seção sobre as ferramentas vale como histórico.
- **Revisto em 22/10/2026 (pedido do responsável):** a barra do topo do espaço tem três partes: à esquerda, seletor de modo, Filtrar e Ordenar (os painéis abrem sob eles); no meio, o nome do espaço; à direita, **Nova ação**. Abaixo dela, na mesma linha, "Barra" (tempo restante, prioridade de execução, prioridade de revisão ou nenhuma) e "Mostrar até" (fases, etapas ou ações) ficam à esquerda, no mesmo desenho do seletor de modo, e o alerta de ações atrasadas fica à direita.
- **Revisto em 22/10/2026 (decisões do responsável):** na lista, o ícone da situação vem antes do nome. Um botão **Colunas**, no começo da segunda linha, abre caixas de marcar: nome e situação são fixos; **Descrição** (texto inteiro; só se o espaço usa o campo), **Participantes** e **Barras** são opcionais, lembradas no aparelho. "Nenhuma" saiu do seletor Barra; sem a coluna Barras, o seletor não aparece. No quadro, a barra continua sempre visível. Os participantes aparecem em ordem alfabética.
- **Revisto em 22/10/2026 (decisão do responsável, revendo a anterior):** no seletor Barra, as prioridades aparecem pelos nomes técnicos, "Índice de criticidade" e "Contribuição para a variância", por serem medidas matemáticas precisas. Para explicá-las (e também o tempo restante, desde 22/10/2026: dias úteis até a conclusão prevista ou, em vermelho, desde que ela venceu), a linha de cada etapa aberta traz, sobre a coluna das barras, o nome e o que representa; o nome abre, ao passar o mouse, uma caixa com a explicação e, ao clicar, o verbete do glossário, que mostra a equação.
- **Revisto em 22/10/2026 (decisão do responsável):** os nomes técnicos valem em todo o sistema (seletor Barra, ordens, legenda, janela da ação e glossário); "prioridade de execução" e "prioridade de revisão" ficam no glossário como "Em palavras simples". Cada verbete traz a fonte primária, com DOI. *Revisto em 23/10/2026:* na tela, "contribuição para a incerteza" (o glossário explica o termo técnico, contribuição para a variância), com o símbolo de curva de sino; a lupa fica reservada para a busca. O campo "Notas" passa a "Anotações" na tela.
- **Acrescentado em 22/10/2026 (pedido do responsável):** edição no lugar com **Alt+clique**, para quem pode gravar, na lista, no quadro e na rede: nome (nas três), descrição (lista) e participantes (lista e quadro). Campos calculados (situação, datas e barras) não se editam. Com Alt pressionado, os campos editáveis ficam contornados.
- **Revisto em 22/10/2026 (decisão do responsável):** o menu "Colunas" passa a se chamar **Exibir** e vale na lista, no quadro, na rede e no cronograma. Traz o **identificador** antes do nome, na mesma linha: nenhum, número (#1) ou código (este só nos espaços que usam códigos); um ou outro, nunca os dois. Ação sem código mostra o número. Padrão: código onde há códigos; nenhum nos demais. Escolha lembrada no aparelho. Na lista, o mesmo menu mantém as colunas.
- **Aprovado em 23/10/2026, depois de um teste pedido pelo responsável:** no computador, a barra do topo passa a ter o nome do espaço à esquerda e os menus Visualização, Filtrar, Ordenar e Exibir, todos abrindo para baixo; "Barra" vira o item "Indicador" do Exibir, e "Mostrar até" também vai para o Exibir; a segunda linha some, e as atrasadas viram uma etiqueta vermelha ao lado de "Nova ação". Revisto no mesmo dia, em teste: a barra passa a ter três grupos, como no Numbers: à esquerda, o nome do espaço (só com o menu lateral fora de vista) e a visualização; no centro da área de trabalho, Classificar e filtrar, Exibir e Indicador; à direita, atrasadas e Nova ação. Revisto no mesmo dia: Filtrar e Ordenar viram "Classificar e filtrar", como no Excel; o menu de visualização ganhou ícone próprio e continua mostrando o modo atual. O indicador ganhou menu próprio, "Indicador", com ícone de mostrador, à direita do Exibir, só onde há barras; no Exibir, a coluna "Barras" passa a se chamar "Indicador". Largura (revisto no mesmo dia): a barra do topo ocupa a tela toda; lista, quadro e linha do tempo ficam em 1240 px; planilha, cronograma e rede ocupam toda a largura abaixo da barra. No celular, nada muda.
- **Barra lateral recolhida, no computador (decisão do responsável, 23/10/2026):** o nome do espaço sai da barra do topo e aparece grande no alto do conteúdo, e o canto esquerdo da barra fica vazio, com o menu Visualização na ponta. No lugar do botão de painel, um **puxador** na borda esquerda da tela: um traço curto e discreto, no meio da altura; com o mouse perto da borda, a faixa ganha um tom verde-azulado, o traço cresce e aparece "Abrir a barra lateral Ctrl+B". A área de clique é a faixa inteira da borda (14 px). É um botão de verdade: recebe o foco pela tecla Tab e é lido pelo leitor de tela. **Ctrl+B** (⌘B no Mac) abre e recolhe a barra lateral, como no VS Code e no Notion, exceto num texto formatável, onde continua sendo negrito. Com a barra aberta, o botão de recolher continua no canto superior direito dela. No celular, nada muda.
- **Ferramentas da lista no computador:** filtros de situação, Lista ou Editar em planilha, Minhas ações, responsável, ordenação, Recolher fases, Legenda e Nova ação. A legenda de cores e símbolos fica escondida até ser aberta.
- **Ferramentas da lista no celular**, em uma só linha: os filtros de situação numa faixa que rola para o lado e um botão **"Filtros e ordem"**, que mostra quantas opções estão ativas. Ele abre um painel que sobe de baixo, com: Minhas ações, responsável, ordenação, recolher ou expandir fases, legenda e "Limpar filtros e ordem". **Nova ação** vira um botão flutuante (+) no canto inferior direito. A edição em planilha fica só no computador. Nos cartões de ações concluídas, as barras de prioridade, sem uso, não aparecem.

- Logotipo, nome do sistema e instituição.
- **Menu do espaço:** junta o seletor de espaço e "Configurar o espaço", que deixa de ter botão próprio (engrenagem). Ao tocar no nome do espaço, abre uma lista com os espaços (✓ no espaço aberto), uma linha divisória, "Configurar este espaço" e "Novo espaço" (nome, datas e prazo final). Sem login, mostra só a lista de espaços. Segue o padrão de troca de espaço de trabalho do Slack e do Notion. Custo aceito: configurar passa a exigir dois toques, e a lista deixa de ser a nativa do celular. Busca na lista só quando houver muitos espaços (YAGNI).
- **Ajuda:** painel dentro do sistema, aberto pelo item "Ajuda e manual" do menu do usuário ou pelos links "o que é?" da tela. Contém o glossário, que antes era a aba "Entenda os termos", e, futuramente, o manual. Cada "Termo técnico" na tela abre a explicação correspondente.
- **Configurar o espaço** (item "Configurar este espaço" do menu do espaço): painel lateral com: dados do espaço (nome, datas, prazo final, datas excluídas com motivo); campos opcionais em uso; documentos do espaço; retratos (salvar e listar); importar e exportar; cópia de segurança.
- **Menu do usuário:** seus dados (e-mail, nome, responsável ligado), Ajuda e manual, trocar senha (pede a senha atual), sair. Sem login, o lugar das iniciais mostra um ícone de pessoa, e o menu traz só "Ajuda e manual" e "Entrar", para quem só consulta não perder o acesso à Ajuda.
- **Configurar o sistema:** reservado para o futuro (por exemplo, gestão de usuários e permissões). O nome "Configurar o espaço" evita confusão com ele.

### 8.2 Abas

**Ações · Responsáveis**, em ordem de frequência de uso. *Revisto em 21/10/2026:* a aba Visualização sai; o cronograma, a rede e a linha do tempo viram modos do seletor da aba Ações (seção 8.4).

### 8.3 Aba Ações

Reúne o cadastro, o acompanhamento e as previsões por ação, como na planilha da PI².

- **Fases e etapas como separadores**, como na gestão clássica de projetos (estrutura analítica): fase > etapa > ações. Cada separador mostra o nome e, **só quando está recolhido**, o número de ações, quantas foram concluídas, as atrasadas e a data em que o grupo termina, com uma pequena barra de progresso (decisão do responsável, 20/10/2026: aberto, os cartões já mostram tudo, e o resumo poluía a tela). O resumo aparece e some com um esmaecimento curto. **No celular**, para não tumultuar, o grupo recolhido mostra só a barrinha de progresso e, se houver ação atrasada, o relógio vermelho, na linha do nome (decisão do responsável, 20/10/2026). Fases e etapas podem ser **recolhidas e expandidas** com animação suave, e, acima da lista, "Mostrar até: Fases · Etapas · Ações" recolhe ou abre todas de uma vez (22/10/2026). O aninhamento aparece por recuo leve. Ações sem etapa ficam num grupo "Sem fase nem etapa". *Revisto em 22/10/2026 (decisão do responsável):* o agrupamento vale em qualquer ordenação; a ordem escolhida (prioridade, data) vale dentro de cada etapa. Os separadores só somem ao desligar "Fases e etapas" em Campos opcionais.
- **Fases e etapas são cadastradas em "Configurar o espaço"** (criar e renomear; reordenar e excluir na versão final). Na ação, a etapa é escolhida numa lista agrupada por fase. O campo opcional "Fases e etapas" pode ser desligado; nesse caso, a lista fica sem separadores.
- **Animação dos filtros:** ao filtrar ou reordenar, as ações que continuam deslizam até a nova posição e as que entram aparecem suavemente. Respeita a preferência do sistema por menos movimento.
- **Responsáveis no cartão** (decisão do responsável, 20/10/2026): **pessoa** num círculo com as duas iniciais do nome (primeiro e último), num tom só dela dentro do espaço, de uma paleta de 15 tons espaçados por igual no círculo das cores, com a mesma claridade (campo `tons`, seção 4.1; decisão do responsável, 20/10/2026: comissões de até 10 a 12 pessoas, quase sem fotos, precisam reconhecer cada pessoa pela cor; a ordem de distribuição alterna tons distantes, e as 8 primeiras pessoas recebem cores bem diferentes); **unidade** num quadrado de cantos arredondados com a sigla, em tom neutro. É o padrão do GitHub para usuários e organizações. Primeiro as pessoas, depois as unidades, na mesma linha; com mais de três pessoas, os círculos se sobrepõem e terminam em "+N". O nome completo aparece ao passar o mouse ou tocar, e por extenso na janela da ação. Quem entrou com login vê o próprio círculo com um anel verde. A foto da pessoa substitui as iniciais quando houver login institucional (Fase 4).
- **Linha compacta:** código e rótulo; situação e carimbo; responsáveis; conclusão prevista; as duas barras de prioridade. **Sem cabeçalho de tabela** (decisão do responsável, 20/10/2026: com cartões, o cabeçalho confundia e poluía a tela): a data e as barras levam um rótulo pequeno no próprio cartão ("Conclusão prevista" ou "Concluída em", "Prioridade de execução", "Prioridade de revisão"), e os links "o que é?" das prioridades ficam na legenda. Nas ações concluídas, as barras não aparecem.
- **Cada linha é um cartão** com leve sombra e cantos arredondados, para separar visualmente as ações. *Revisto em 22/10/2026 (decisão do responsável):* sem a faixa colorida à esquerda, que repetia a prioridade já mostrada na barra. Também em 22/10/2026: a ação concluída não mostra a data de conclusão; as demais mostram, no lugar da data prevista, quantos dias úteis faltam ("Faltam 6 dias úteis", "Conclui hoje"), e a atrasada, há quantos dias úteis a previsão venceu. A data aparece ao parar o mouse e na janela da ação. *Revisto de novo em 22/10/2026, para a lista ficar menos carregada (decisões do responsável):* a situação aparece só pelo ícone (concluída, ✓; não liberada, cadeado fechado); a liberada, que é o normal, fica sem marca; sai o carimbo "Atrasada" e a seta do canto direito; o prazo é uma barra (decisão do responsável, 22/10/2026, no lugar do número com seta, que não se sustentou no golpe de vista): verde para a direita, com os dias úteis que faltam, e vermelha para a esquerda, com há quantos dias úteis a previsão venceu, numa escala única do espaço, do mais vencido ao que mais falta, com o zero marcado; o número fica ao lado, pequeno; saem os rótulos repetidos de cada cartão ("Conclusão prevista", "Prioridade de…"). Acima da lista e do quadro, "Barra: Tempo restante · Execução · Revisão · Nenhuma" escolhe a única barra de cada cartão, ou nenhuma (revisto em 22/10/2026: antes, o prazo e a prioridade dividiam o cartão); a escolha fica lembrada no aparelho. Cada barra tem símbolo próprio à esquerda e cor própria: tempo restante, cronômetro, barra verde para a direita ou vermelha para a esquerda; prioridade de execução, raio, violeta (cor de destaque forte, sem ser vermelho, pedida pelo responsável e fora da paleta do logotipo); prioridade de revisão, lupa, laranja. No celular, os botões mostram só os símbolos. A ação sem estimativa mostra "Falta estimar" na barra do tempo ou, com outra barra, ao lado da situação; as reprogramações aparecem pequenas, ao lado da situação. *Ajuste de 22/10/2026:* o ícone da situação fica numa coluna estreita, logo à direita dos nomes; "a partir de", "Falta estimar" e as reprogramações passam para baixo do nome, pequenos. Os responsáveis aparecem lado a lado, sem se sobrepor, com duas letras (nome único: as duas primeiras letras, como "HE"), todos os que couberem na largura do cartão e, se faltar espaço, "+N" no fim.
- **Detalhe numa janela sobreposta**, ao tocar na linha, com o fundo escurecido, como no Todoist. Assim nenhum campo da lista fica escondido. A janela abre com uma animação curta. No celular, ela sobe da parte de baixo da tela e ocupa quase toda a altura.
- **Conteúdo da janela:** no topo, etapa e rótulo (e o código, com o campo `codigos` ligado); um resumo com situação, conclusão prevista, responsáveis e as duas barras. Abaixo: descrição, dependências e notas; botões de reestimar e de registrar a conclusão; alerta da regra interna, quando houver; histórico de estimativas, com o resumo das reprogramações.
- **Fica fora da janela** o quadro de estimativa vigente com folga, data de liberação e fórmula: carga cognitiva sem uso prático. A estimativa vigente aparece como último item do histórico, e a fórmula fica na Ajuda.
- **No celular:** cada linha vira um cartão.
- Filtros: situação, responsável, "Minhas ações".
- **Edição no lugar, na janela:** cada campo (rótulo, etapa, descrição, "Não começa antes de" e notas) é editado ao ser clicado, com Salvar e Cancelar. Dependências e responsáveis são etiquetas com ×, acrescentadas e retiradas na hora, item a item (seção 4.6). A estimativa também, enquanto a ação aguarda (seção 5.3).
- **Três jeitos de criar ações** (decisão do responsável, 21/10/2026), separando capturar de detalhar, como no Todoist:
  - **Linha de criação rápida** ("+ Adicionar ação"), no fim de cada etapa (inclusive as vazias), no fim da lista sem fases e no fim da coluna Liberadas do quadro: digita-se o nome e tecla-se Enter; a ação nasce ali, sem estimativa, e a linha fica pronta para a próxima. Só aparece sem filtros, para a ação não sumir da tela ao nascer.
  - **Janela "Nova ação" compacta**, pelo botão "Nova ação" e pelo (+) do celular. À vista, o que o tipo do espaço considera essencial; no tipo com estimativas, o rótulo e os três pontos, que induzem o preenchimento mas podem ficar em branco (a ação nasce com "Falta estimar"; preencher só parte deles não é aceito). O opcional fica recolhido em botões pequenos (etapa, responsáveis, depende de, "Não começa antes de", descrição e, com o campo `codigos` ligado, código), que mostram o valor quando há; "Todos os campos" abre todos. Enter cria a ação e deixa a janela aberta e limpa para a próxima, mantendo a etapa e a data mínima. **Regra geral:** a janela mostra à vista o essencial do tipo de espaço e recolhe o resto; no Quadro de tarefas (passo 3.1), sem estimativas nem dependências, o essencial é o nome (e, se for o caso, responsável e data-limite).
  - **Modo "Editar em planilha"**, para cadastros grandes no computador, disponível também com o espaço vazio.
  - **Código opcional**, só com o campo `codigos` ligado: se vazio, o sistema sugere um a partir do rótulo; se preenchido, precisa ter de 2 a 8 letras ou números e não pode repetir um código existente, com aviso enquanto se digita.
- **Seletores com busca** para dependências e responsáveis: ao digitar, aparecem as opções que contêm o texto (código ou nome da ação; nome, sigla ou setor da pessoa). Setas e Enter escolhem; cada escolha vira uma etiqueta com ×. Nas dependências, ficam de fora a própria ação e as que dependem dela, o que impede ciclos. Nos responsáveis, as últimas opções são "Cadastrar … como pessoa" e "Cadastrar … como unidade" (o tipo é obrigatório, seção 4.5).
- **Seletor de modo** (decisão do responsável, 21/10/2026), sempre no canto esquerdo das ferramentas, no mesmo lugar em todos os modos: só ícones em SVG, no padrão do sistema (lista com marcadores, quadro de colunas, grade de planilha); o modo ativo mostra também o nome, e os demais o mostram ao passar o mouse; o leitor de tela lê o nome de todos. Motivo: o seletor é usado o tempo todo e fica fixo, então os ícones se aprendem em poucos usos (como no seletor de visualização do Finder, no Mac), e o nome do modo ativo evita que quem chega fique perdido. No celular, ficam só Lista e Quadro, no painel "Filtros e ordem"; Planilha, Cronograma e Rede não aparecem.
- **Modo "Editar em planilha"**, ao lado da lista: uma grade com todas as ações e uma coluna por campo, para edição rápida por usuários experientes. Cada célula é salva ao sair dela; Enter desce para a linha de baixo; é possível colar um bloco copiado do Google Planilhas ou do Excel, inclusive criando linhas novas. Dependências e responsáveis são digitados como códigos e siglas separados por vírgula, com validação (código inexistente, ciclo, sigla desconhecida). Células que não podem ser editadas ali ficam cinza, com o motivo ao passar o mouse; por exemplo, a estimativa de uma ação liberada, que só muda por reestimativa.
- **Modo "Quadro"** (estilo Kanban, como o Trello), ao lado de Lista e Editar em planilha: os mesmos cartões em três colunas, **Não liberadas**, **Liberadas** e **Concluídas**, cada uma com a contagem. "Atrasada" não é coluna: é o carimbo (ícone de relógio) no cartão, e o filtro "Atrasadas" continua disponível. O cartão mostra código, rótulo, etapa, responsáveis, conclusão prevista e a barra de prioridade de execução, com a faixa de cor à esquerda; tocar nele abre a janela da ação.
  - **Arrastar** (no computador): de Liberadas para Concluídas abre o registro da conclusão, com a data; de Concluídas para Liberadas desfaz a conclusão. A coluna Não liberadas não aceita cartões, porque a liberação é automática (quando as anteriores terminam e a data mínima chega); a descrição da coluna explica isso.
  - **No celular:** as colunas ficam lado a lado, deslizando para o lado, uma por vez; a escolha entre Lista e Quadro fica no painel "Filtros e ordem". Concluir é feito pela janela da ação.
  - No Quadro, a lista não é separada por fases e etapas; a etapa aparece em cada cartão.
- **Edição nas linhas da lista:** feita pelo modo planilha. Na lista, tocar na linha abre a janela; tornar os campos da linha editáveis causaria edições acidentais, principalmente no celular.
- **O número da ação não muda** depois de criado, porque é a referência usada nas dependências (seção 4.2). O código mnemônico, quando usado, pode ser alterado.
- **Protótipo antes da implementação:** esta aba será prototipada com dados fictícios e publicada como página de teste privada, para avaliação do responsável no computador e no celular.

### 8.4 Modos de visualização interativos

*Revisto em 21/10/2026 (decisão do responsável):* a aba Visualização sai. O cronograma, a rede e a linha do tempo passam a ser **modos do seletor da aba Ações** (seção 8.3), ao lado de Lista, Quadro e Planilha, e são **interativos**, como nos programas comerciais, no mesmo padrão visual e de movimento do resto do sistema. Os desenhos estáticos da versão 1 (diagrama por etapas, Gantt e linha do tempo renderizados) são descartados. Só no computador.

- **Linha do tempo:** do início do espaço ao prazo final, com hoje, a conclusão prevista, a data segura (P80) e o prazo final, este com a chance de cumprir o prazo; interativa. Recebe também o gráfico "Em que data o trabalho pode terminar" (resultado da simulação), por responder à mesma pergunta (decisão do responsável, 21/10/2026). O desenho previsto antes (eixo fino com as datas junto das marcas e faixa entre a conclusão prevista e a data segura) serve de ponto de partida, não de regra.
- **Cronograma** (*Termo técnico: Gantt*): barras das ações no tempo, com as dependências, e opção de comparar com um retrato (linha fina sob cada barra).
- **Rede** ("Fluxo das ações"; *Termo técnico: diagrama de rede PERT/CPM*) *Revista em 22/10/2026 (pedido do responsável):* desenho em camadas, como o do Mermaid (Sugiyama), sem setas sobre os cartões e com poucos cruzamentos; cartões no padrão do quadro, com a borda colorida pela folga. *Revista de novo em 22/10/2026:* marcos (milestones) verticais por etapa, como no Bizagi (antes, raias horizontais), setas em ângulo reto (como no Bizagi), cruzamentos evitados sempre que possível e, quando inevitáveis, com salto da horizontal sobre a vertical (como no Visio). Zoom como nos quadros infinitos: Ctrl + rolar aproxima e afasta em volta do cursor; arrastar o fundo move a rede (22/10/2026).
- **Fora das visualizações** (decisão do responsável, 21/10/2026): o alto do espaço não mostra mais datas nem a chance, que ficam na linha do tempo e no cronograma. O aviso "Previsão incompleta" continua sempre à vista, em qualquer modo.
- **Calendário: a avaliar, sem compromisso.** Faz sentido sobretudo com datas fixas (data-limite, Fase 2); com as datas previstas pelo PERT, que mudam a cada recálculo, o calendário "se mexeria sozinho" e confundiria. Se for feito, aparece também no celular, ao lado de Lista e Quadro.

Construir um Gantt e uma rede interativos sem biblioteca externa é o maior trabalho da versão 2; por isso o passo 1.17 é dividido em três.

### 8.5 Notas

- **Editor visual** (o que se vê é o que se obtém), com botões de negrito, itálico, link e lista, e os atalhos Ctrl+B, Ctrl+I e Ctrl+K. Por trás, a nota é guardada em **Markdown**, que pode ser levado para qualquer lugar. Ao salvar, o conteúdo do editor é convertido para Markdown, e só os elementos permitidos são mantidos. Texto colado entra sem formatação, para não trazer estilos de outros programas. Sem biblioteca externa.
- Aceita negrito, itálico, links, endereços da web automáticos, listas e quebras de linha.
- **Segurança:** o texto é sempre tratado como texto e só esses elementos são convertidos. Nenhum HTML digitado é executado. Links só para `http`, `https` e `mailto`, abrindo em nova aba. Sem biblioteca externa: o conversor é pequeno e próprio, com testes.

### 8.6 Importação, exportação e cópia de segurança

- **Importar ações de planilha** ("Configurar este espaço"): colar a planilha a partir da linha de títulos; as colunas são reconhecidas pelo nome, em qualquer ordem (para o nome da ação, "Ação", "Rótulo", "Nome" ou "Nome da ação"). Antes de gravar, a conferência aponta erros (código inválido ou repetido, nome repetido, dependência que não existe, ciclo) e avisos. Quem importa escolhe entre só criar ações novas ou também atualizar as existentes. Dependências por código da planilha, número ou nome, nessa ordem. Fases e etapas que faltam são criadas. Detalhes no passo 1.19b da seção 12.
- **Importar responsáveis de planilha:** Nome (obrigatório), Tipo, Sigla, Setor e E-mail. Com e-mail, é pessoa e ganha a conta de acesso, criada numa instância separada do Firebase, sem guardar sessão; a senha é sorteada e descartada, e a pessoa recebe o e-mail para definir a sua. Sem e-mail, o tipo precisa vir na planilha. Provisório até os papéis por espaço (seção 12, passo 2.1).
- **Exportar:** "Copiar para planilha" e "Copiar fluxograma" (Mermaid), por cópia para colar.
- **Cópia de segurança** ("Configurar o sistema"): arquivo `sextante-copia-de-seguranca`, versão 2, com todos os espaços (inclusive a lixeira), ações, responsáveis, histórico e retratos, e o calendário geral. A restauração só é feita num banco sem nenhum espaço, para nunca misturar nem sobrescrever dados.

---

## 9. O que saiu da versão 1

| Item | Motivo |
|---|---|
| Valor agregado, Earned Schedule e o indicador "Ritmo" | Exigem % concluído e custos, raramente disponíveis; difíceis para leigos. A pergunta útil ("quando termina, com o que já aconteceu?") é respondida pelo recálculo contínuo |
| Campos de custo, custo gasto, % concluído e início real | Só serviam ao valor agregado, ou não são usados (KISS, "só pedir o necessário") |
| Aba Andamento | O acompanhamento passa a acontecer em cada ação |
| Abas Cronograma, Diagrama e Previsões | Visualizações interativas do espaço (seção 8.4) |
| Aba Entenda os termos | Vai para a Ajuda |
| Escolha triangular/beta | Uma só distribuição (seção 5.2) |
| Crucialidade e SSI como números na tela | Substituídos pela contribuição para a variância, que responde à mesma pergunta de forma padronizada e mais clara (seção 15.4) |
| Carimbo "Prioritária" e símbolo ❗ | Substituídos pela barra contínua e pela intensidade da cor (seções 7.1 e 7.3) |
| Categorias de folga (sem folga, quase sem folga, com folga) e limite `nearCrit` | Substituídas pela intensidade contínua da cor (seção 7.3) |
| Símbolo "▶ em andamento" | O início real não é mais registrado |
| Plano original único (baseline) | Substituído por retratos |
| Modo do artefato do Claude | Versão descontinuada |
| Diagrama pelo dagre | Desenho próprio da rede, que abre mesmo sem acesso ao CDN (seção 8.4) |

---

## 10. Decisões tomadas

Cada decisão de detalhe está registrada, com a data e o motivo, na seção do assunto. As de arquitetura e de método, que orientam o sistema inteiro:

- **Vários arquivos, sem compilação.** Vários arquivos dão separação de responsabilidades, testes automáticos dos cálculos e leitura mais fácil por pessoas e IAs; o custo, um servidor simples para testar localmente, é pequeno. Sem compilação, qualquer pessoa edita e vê o resultado, há menos ferramentas a manter numa instituição em que as equipes mudam e menos riscos de segurança. A checagem de tipos vem dos comentários JSDoc.
- **Protótipo, e não sistema definitivo** (23/10/2026; seção 1.2): a equipe de TI precisa conhecer e controlar o código que mantém; o protótipo vale como modelo conceitual.
- **Número fixo e código opcional** (seção 4.2): o número liga as dependências e nunca muda; o código mnemônico é opcional e pode mudar.
- **Uma só distribuição, a beta-PERT** (seção 5.2), com semente e número de simulações visíveis e imutáveis (seção 5.7).
- **Carimbo Atrasada contra a estimativa mais recente** (seção 6.2), com a regra "nada termina no passado" (seção 5.5).
- **Índice de criticidade e contribuição para a variância**, e não o SSI ou a crucialidade (seção 15.4). Na interface, a segunda se chama "Contribuição para a incerteza" (decisão do responsável, 23/10/2026).
- **Exclusão lógica e lixeira**; histórico de alterações e retratos só de acréscimo (seções 4.7 e 3.6).
- **Responsáveis por espaço**, com o tipo (pessoa ou unidade) fixo depois do cadastro (seção 4.5).
- **Rede desenhada pelo próprio sistema** (camadas, marcos, setas em ângulo reto), sem biblioteca externa, para abrir mesmo sem acesso ao CDN.
- **Simulação reaproveitada** quando nada do que entra nela muda, com resultado idêntico (chave da simulação, seção 5.7).
- **Dados da versão 1 descartados** na troca (23/10/2026; seção 11).

---

## 11. Migração dos dados da versão 1

**Cancelada** (decisão do responsável, 23/10/2026). Os dados da versão 1 foram descartados, e o sistema seguiu com o banco que a versão 2 já usava (projeto `sextante-v2`, com a PI²). O programa de migração, preparado em 22/10/2026, foi retirado na troca; ele e a tabela de correspondência entre os campos das duas versões continuam no histórico do Git (commit `da7b272`).

---

## 12. Plano de trabalho

*Nota da troca (23/10/2026):* nos passos já feitos, o texto foi mantido como estava; neles, "versão atual" e "versão em uso" querem dizer a versão 1, e `v2/` é a pasta em que a versão 2 ficou até a troca (hoje, os arquivos estão na raiz).

Aprovada pelo responsável em 19/10/2026, para execução um passo por vez, com ajustes de ordem ou de escopo combinados no percurso. Cada item é um passo: pequeno, testado, documentado e conferido pelo responsável antes do seguinte (seção 3.3). As fases servem de mapa. Passos concluídos ficam marcados com ✔.

### Fase 0: preparação (nada muda para os usuários)

0.1. ✔ Pasta `/v2/` no site, com página provisória; AGENTS.md ajustado (a regra do arquivo único passa a valer só para a versão atual; testes com `node --test`).
0.2. ✔ Estrutura de arquivos, testes automáticos, banco em memória e `Store` com operações do sistema (seção 3.4).
0.3. ✔ Dicionário de dados completo: modelo lógico, mapeamento físico, diagrama das relações, campos calculados que não ficam no banco, formato das datas e fuso. Teste do dicionário.
0.4. ✔ Espaço de exemplo, com dados fictícios e datas relativas a hoje (`js/exemplo.js`), e cópia do espaço da PI² para o teste de comparação (`testes/dados/pi2-fase1.json`, lida dos dados reais só por leitura, sem responsáveis nem descrições, com conferência por SHA-256). A PI² não é exemplo público: dados reais mudam, e o exemplo precisa ser estável e didático (decisão de 20/10/2026). Este primeiro exemplo serve de base ao tipo Projeto; os exemplos de Plano de Ação e de Quadro de tarefas entram nos passos 2.6 e 3.1.
0.5. ✔ Base visual: cores, temas claro e escuro (`css/estilo.css`), ícones em SVG (`js/icones.js`) e barra do topo, mostrados numa página provisória. Esconder logotipo e nome no celular na vertical fica para o passo 1.5, quando houver o menu do espaço para ocupar o lugar.

### Fase 1: núcleo (substitui a versão atual)

1.1. ✔ Calendário (dias úteis, datas excluídas com motivo; `js/calendario.js`) e caminho crítico, com "Não começa antes de" (`js/calculo.js`). Teste de comparação com a PI²: o cálculo da versão atual é executado no teste, a partir do `index.html` da raiz, e as 29 ações dão as mesmas datas, folgas e ações críticas (conclusão em 22/03/2027, 115 dias úteis). Ações concluídas, reestimativas e a regra "nada termina no passado" entram no passo 1.2.
1.2. ✔ Situações (Não liberada, Liberada, Concluída), carimbo Atrasada e regra "nada termina no passado", mais ações concluídas com a duração real e reestimativas contadas do dia em que foram feitas (`js/calculo.js`, com a data de hoje como parâmetro). A regra do passado vale exatamente para as ações com carimbo Atrasada: prazo vencido sem reestimativa. Conclusão prevista para hoje não é atraso.
1.3. ✔ Simulação beta-PERT, semente imutável, versão do cálculo e as duas prioridades (`js/simulacao.js`). Documentação para conferência por fora (seção 15.6). Referência da PI² registrada na seção 3.2. Desempenho: 29 ações e 10.000 simulações levam cerca de 0,2 s num computador; se, nos testes no celular, a tela travar, a simulação passa a rodar em segundo plano (*Termo técnico: Web Worker*) no passo 1.6, junto com a tela que a usa.
1.4. ✔ Abertura do sistema: quem não tem espaço vê a tela de boas-vindas (criar espaço, "Ver um exemplo" e, com o banco vazio, restaurar a cópia de segurança); quem tem espaços vai direto ao último espaço aberto naquele aparelho; quem chega por um link de espaço abre esse espaço. As boas-vindas continuam acessíveis pelo menu do espaço, e o exemplo, pela Ajuda (passo 1.5). Feito no passo 1.4: boas-vindas com "Criar um espaço de planejamento" (nome, início e prazo final) e "Ver um exemplo"; link de espaço no endereço (`#/espaco/<id>`); lembrança do último espaço no aparelho; e um resumo provisório do espaço aberto (situações, conclusão prevista, data segura e chance), para conferir o cálculo na tela até a lista de ações do passo 1.6. A restauração de cópia entra nas boas-vindas no passo 1.19, junto com a cópia de segurança.
1.5. ✔ Topo: menu do espaço (lista, "Configurar este espaço", "Novo espaço"), menu do usuário e Ajuda (glossário e links "o que é?"). Feito no passo 1.5: menu do espaço com a lista (✓ no aberto), "Configurar este espaço" (avisa que chega no passo 1.13), "Novo espaço" (abre as boas-vindas já com o formulário) e "Boas-vindas", que substitui o botão "Voltar às boas-vindas" do passo 1.4; menu do usuário sem login, com ícone de pessoa, "Ajuda e manual" e "Entrar" (avisa que chega no passo 1.14); Ajuda em painel lateral, que entra e sai deslizando pela direita em 0,25 s (sem animação para quem ativou "Reduzir movimento"), com "Ver um exemplo" e o glossário (`js/glossario.js`), que destaca o termo aberto por um link "o que é?" (`data-termo`; o primeiro está na data segura do resumo provisório); no celular em pé, a marca some e o menu do espaço ocupa a largura. O manual entra na Ajuda quando for refeito.
1.6. ✔ Lista de ações: cartões, fases e etapas recolhíveis, filtros, ordenação, "Minhas ações", legenda e animações; no celular, painel "Filtros e ordem" e botão (+). Feito no passo 1.6: regras da lista em `js/lista.js` (o que cada linha mostra, contagem, filtros, ordenação com empate pela ordem do espaço, agrupamento e resumo de fase e etapa), com testes; tela em `js/telas/espaco.js`. Fase ou etapa recolhida também some para o teclado e o leitor de tela. "Minhas ações" só aparece para quem entrou com login, ligado a um responsável (passos 1.12 e 1.14). Tocar numa ação e "Nova ação" avisam em que passo chegam (1.7 e 1.9). Os modos Quadro e "Editar em planilha" entram nos passos 1.10 e 1.11. A conclusão prevista, a data segura e a chance de cumprir o prazo ficam numa linha provisória acima da lista, até a linha do tempo da aba Visualização (passo 1.17). Desempenho: a simulação do exemplo levou 88 ms no celular do responsável; abaixo de 100 ms a tela não chega a parecer travada, e a simulação continua na tela, sem rodar em segundo plano.
1.7. ✔ Janela da ação: edição no lugar, seletores com busca (sem ciclos), reestimativa, conclusão e histórico de estimativas. Feito no passo 1.7: janela no centro da tela no computador e subindo de baixo no celular (`js/telas/janela-acao.js`), com a faixa de cor da prioridade no alto; regras em `js/acao.js` (estimativa livre, anteriores possíveis sem ciclo, busca sem acentos, resumo das estimativas, o que falta para liberar), com testes. Rótulo, etapa, descrição, "Não começa antes de" e a estimativa livre são editados no lugar, com Salvar e Cancelar (Esc cancela). Dependências e responsáveis mudam item a item, na hora, sem Salvar, como etiquetas com ×; a busca de responsáveis oferece "Cadastrar … como pessoa" e "como unidade". Reestimar e Registrar conclusão abrem um formulário na própria janela; a ação concluída mostra "Desfazer conclusão". O `Store` ganhou operações item a item (`acrescentarResponsavelNaAcao`, `acrescentarDependencia` e as de retirar), `reestimar`, `corrigirEstimativa`, `concluir` e `desfazerConclusao`; o banco ganhou `acrescentarNaLista`, `retirarDaLista`, `acrescentarEstimativa` e `trocarUltimaEstimativa`, com testes de contrato de gravações simultâneas (seção 4.6). O teste encontrou uma falha no banco em memória, que lia e gravava em dois tempos; corrigida. A tela do espaço passou a acompanhar o banco: cada gravação recalcula a lista e a janela aberta, mantendo filtros, grupos e o que está sendo digitado. O aviso "Fulano alterou esta ação agora" entra com o Firebase (passo 1.14); as notas aparecem como texto até o editor do passo 1.8.
1.8. ✔ Notas com editor visual (Markdown seguro). Feito no passo 1.8: conversor próprio em `js/notas.js` (Markdown para HTML e o conteúdo do editor de volta para Markdown), com testes de segurança (HTML digitado vira texto; links só http, https e mailto); na janela da ação, a nota aparece formatada e, ao clicar, vira um editor com os botões N (negrito), I (itálico), Link e Lista e os atalhos Ctrl+B, Ctrl+I e Ctrl+K; texto colado entra sem formatação; dentro do editor, clicar num link não o abre.
1.9. ✔ Nova ação: janela central, código opcional. Feito no passo 1.9: janela em `js/telas/nova-acao.js`, aberta por "Nova ação", pelo botão (+) do celular e pela tela do espaço sem ações; regras do código em `js/acao.js` (normalização, problema e sugestão a partir do rótulo, como "Publicar o edital de seleção" → PES, ou PE2 se PES estiver ocupado), com testes; o `Store` passou a recusar, na criação, estimativa inválida e anterior inexistente. A estimativa é obrigatória. "Não começa antes de" já vem com a data de hoje quando o espaço já começou, para a ação não nascer atrasada (como no protótipo); pode ser apagada. A ação criada vai para o fim da ordem do espaço e fica destacada na lista. O seletor com busca virou peça comum (`js/telas/seletor.js`), usado aqui e na janela da ação; depois de cada escolha, a lista de sugestões se recolhe até a pessoa voltar a digitar. **Revisto em 20/10/2026, depois do passo 1.9:** as ações passaram a ser identificadas por um número fixo em sequência, invisível no uso normal, e o código mnemônico virou campo opcional do espaço, desligado por padrão (seção 4.2). Dependências aparecem pelo nome (com a etapa na busca, para distinguir nomes parecidos); o banco ganhou `reservarNumero` (contador `proximoNumero` do espaço, com teste de contrato de criações simultâneas); o código, quando usado, pode ser alterado na janela da ação. O exemplo guarda os códigos, mas com o campo desligado. Ligar e desligar os códigos fica em "Configurar o espaço" (passo 1.13).
1.10. ✔ Modo Quadro. Feito no passo 1.10: botões "Lista | Quadro" junto dos filtros (no celular, no painel "Filtros e ordem"); três colunas com contagem e uma dica curta; cartões com etapa, responsáveis, conclusão prevista, carimbo Atrasada e a barra de prioridade de execução; no quadro, os filtros de situação se reduzem a Todas e Atrasadas, e o filtro de responsável e a ordenação continuam valendo dentro das colunas. Arrastar de Liberadas para Concluídas abre a janela da ação já no registro da conclusão; de Concluídas para Liberadas desfaz a conclusão; os cartões não liberados não se arrastam. No celular, as colunas deslizam para o lado, uma por vez.
1.11. ✔ Modo "Editar em planilha", no computador. Feito no passo 1.11: terceiro botão em "Lista | Quadro | Editar em planilha", só no computador (`js/telas/editar-planilha.js`; regras em `js/planilha.js`, com testes). Colunas: Nº (o número da ação, só leitura), Código (com os códigos ligados), Rótulo, Etapa (lista), Descrição, Depende de (números ou códigos, separados por ponto e vírgula), Responsáveis (siglas ou nomes), Não começa antes de, os três pontos da estimativa e Concluída em (preencher registra a conclusão; apagar desfaz). Cinza, com o motivo ao passar o mouse: o número; a estimativa de ação liberada ou concluída; a conclusão de ação não liberada. Dependências e responsáveis são gravados item a item (seção 4.6), com as mesmas recusas da janela (ciclo, inexistente, sigla desconhecida). Colar um bloco do Google Planilhas ou do Excel aceita células entre aspas com quebra de linha e cria ações novas para as linhas que passarem do fim; a etapa colada é reconhecida pelo nome. A última linha, vazia, cria uma ação ao receber um rótulo. No modo planilha, os filtros, a ordenação e a legenda ficam escondidos: a grade mostra todas as ações, na ordem do espaço. Revisão de 23/10/2026 (pedido do responsável: a planilha é para quem usa muito o sistema e mostra todos os campos, inclusive os calculados): colunas na ordem Nº, Código, Ação (o rótulo; nome da coluna mudado a pedido do responsável), Fase (só leitura, vem da etapa), Etapa, Descrição, Depende de, Responsáveis, Não começa antes de, os três pontos, Concluída em, Anotações (editável quando tem uma linha só) e Checklist ("feitos/total", só leitura); depois de uma linha mais forte, os calculados, só leitura: Situação, Atrasada desde, Liberação prevista, Conclusão prevista, Folga (dias úteis), Índice de criticidade, Contribuição para a incerteza, Reestimativas, Criada em, Alterada em e Alterada por. Cada coluna mantém a sua largura e a grade rola para o lado; Nº, Código e Ação ficam parados à esquerda. Em "Exibir", a pessoa escolhe as colunas (a coluna Ação fica sempre), e a escolha é lembrada no aparelho. Ajustes de 23/10/2026 (aprovados pelo responsável): setas, Enter e Shift+Enter andam entre as células (num texto, ← e → só saem da célula com o cursor na ponta); data vazia sem a máscara até receber o cursor; células bloqueadas com fundo mais escuro que o dos calculados; explicação do alto numa linha, com "Mais dicas"; a grade vai até o fim da tela e mantém a rolagem quando uma gravação a redesenha.
1.12. ✔ Aba Responsáveis, com a ligação ao usuário que faz funcionar "Minhas ações". Feito no passo 1.12: abas do espaço, por enquanto Ações e Responsáveis (Visualização chega no passo 1.17); aba Responsáveis em `js/telas/responsaveis.js`, com busca, pessoas e unidades em grupos separados, quantas ações cada um tem no espaço aberto e cadastro e edição no lugar (tipo, nome, sigla, setor e, só para pessoas, o e-mail de login). O `Store` passou a validar o e-mail de login (formato e um responsável por e-mail). O tipo é escolhido só no cadastro e não muda depois (revisto em 21/10/2026; seção 4.5). O banco avisa todos os espaços acompanhados quando um responsável muda, porque a lista é a mesma para todos. "Minhas ações" já usa o e-mail de login, mas só aparece depois da entrada com login (passo 1.14). A exclusão de responsáveis chega com a lixeira (passo 1.15).
1.13. ✔ Configurar o espaço: dados, datas excluídas, fases e etapas, campos opcionais, documentos (identificação no SIPAC/Protocolo e link) e semente visível. Feito no passo 1.13: painel lateral aberto por "Configurar este espaço", no menu do espaço (`js/telas/configurar.js`), com seções recolhíveis (só os dados do espaço começam abertos): dados do espaço (nome, início, prazo final); datas excluídas com motivo; fases e etapas (criar, renomear, reordenar com ↑ e ↓ e retirar as que não têm ações; a retirada das que têm ações chega com a exclusão encadeada, no passo 1.15); campos opcionais, gravados na hora, incluindo "Códigos das ações"; documentos (nome, data, identificação no SIPAC/Protocolo e link, com botão Abrir); e a simulação (semente, cenários e versão do cálculo), visível e fixa. Cada seção grava pelo seu botão Salvar. O `Store` passou a conferir o espaço inteiro a cada gravação: prazo final não antes do início, datas excluídas sem repetir, fases e etapas com nome e identificadores únicos, documentos com nome e link só http ou https, e os campos de cada item contra o dicionário de dados. Ao renomear, o nome muda também no topo. Retratos, importação, exportação e cópia de segurança entram nos passos 1.18 e 1.19. **Revisto em 21/10/2026:** calendário em dois níveis (seção 5.1). "Configurar o sistema", no menu do usuário (`js/telas/configurar-sistema.js`), cuida do calendário geral, agrupado por ano, com o botão que sugere os feriados nacionais de um ano (`js/feriados.js`, com a Páscoa calculada; fixos e móveis, inclusive os pontos facultativos de Carnaval e Corpus Christi), destacados para revisão antes de salvar. Em "Configurar o espaço", a seção de datas excluídas mostra as datas gerais a partir do início do espaço, cada uma com "desconsiderar", e as datas próprias do espaço. O cálculo usa as datas efetivas (`datasEfetivas`, em `js/calendario.js`). O exemplo continua com os feriados na lista própria, por ser fictício e não poder alterar o calendário geral.
1.14. ✔ Firebase: área de dados separada, login, troca de senha e edição simultânea com aviso (seção 4.6). Feito no passo 1.14: os espaços passam a ficar no projeto "sextante-v2" do Firebase (`v2/config.js`), separado do sistema em uso; o exemplo continua num banco em memória à parte e nunca vai ao Firebase. Banco do Firestore em `js/banco/firestore.js`, que passa nos mesmos testes de contrato do banco em memória, rodados sobre um Firebase falso (`testes/firebase-falso.js`): número da ação por transação no contador do espaço, responsáveis e dependências com `arrayUnion` e `arrayRemove`, estimativas por transação (o `arrayUnion` juntaria duas estimativas idênticas), responsáveis e calendário geral acompanhados por um ouvinte só, sem reler tudo a cada mudança. Regras provisórias em `v2/firestore.rules`, como na versão em uso: qualquer pessoa consulta, só quem entrou cria e altera, ninguém apaga; os papéis chegam no passo 2.1. Login por e-mail e senha (`js/banco/firebase.js` e `js/telas/acesso.js`), com "Esqueci a senha", como na versão em uso; usuários são cadastrados pelo administrador, no console. Menu do usuário com login: iniciais do responsável ligado ao e-mail, nome e e-mail, "Configurar o sistema", "Trocar senha" (pede a atual) e "Sair". Sem login: o `Store` recusa gravações com "Entre com seu e-mail e senha para fazer alterações", "Nova ação", "Configurar este espaço" e "Novo espaço" somem, e as boas-vindas oferecem "Entrar para criar um espaço". A tela inteira só para leitura (sem os campos editáveis) fica para os papéis do passo 2.1. Na janela da ação, quando outra pessoa grava, aparece por 10 segundos "Fulano alterou esta ação agora" (nome do responsável ligado ao e-mail, ou o e-mail), e o campo em edição fica como está. Se o Firebase não carregar, o sistema abre só na memória, com aviso.
1.14a. ✔ Criação rápida de ações (incluído em 21/10/2026, a pedido do responsável). Feito no passo 1.14a: o espaço vazio já mostra as ferramentas (Lista, Quadro, Editar em planilha) e a linha de criação rápida; linhas "+ Adicionar ação" no fim de cada etapa, da lista e da coluna Liberadas do quadro (`js/telas/espaco.js`; etapas vazias aparecem com `agrupar(…, {vazias: true})`, em `js/lista.js`), que mantêm o cursor e o texto quando a lista é redesenhada; janela "Nova ação" compacta (`js/telas/nova-acao.js`), com rótulo e três pontos à vista e os demais campos em botões; ações sem estimativa com a marca "Falta estimar" na lista, no quadro e na janela da ação, e aviso de previsão incompleta no alto do espaço (seção 5.2). O cálculo já contava a ação sem estimativa como zero dias; passou a não lhe dar o carimbo Atrasada. A versão do cálculo não muda: até aqui, toda ação tinha estimativa.
1.14b. ✔ Responsáveis por espaço (seção 4.5): banco, regras, seção em "Configurar este espaço" e fim das abas do espaço; os responsáveis criados antes passam para o espaço em que foram usados. Feito no passo 1.14b: o banco guarda os responsáveis dentro do espaço (no Firestore, `espacos/{id}/responsaveis/{id}`; no banco em memória, uma lista por espaço), e `acompanharEspaco` entrega também os responsáveis do espaço; o `Store` pede o espaço em `criarResponsavel`, `listarResponsaveis` e `alterarResponsavel`, e o e-mail de login não se repete dentro do espaço. A tela dos responsáveis virou a seção "Responsáveis" de "Configurar este espaço", atualizada enquanto o painel está aberto; a tela do espaço ficou sem abas. Regras novas em `v2/firestore.rules`. Os quatro responsáveis da lista geral antiga foram copiados para o único espaço real, e a coleção antiga foi excluída pelo responsável, no console. O nome de quem entrou, no topo, é o do responsável ligado ao e-mail no espaço aberto.
1.14c. ✔ Menu lateral recolhível, como no Todoist e no Notion (decisão do responsável, 21/10/2026): no alto, quem entrou (trocar senha, sair ou entrar); no meio, a lista de espaços, cada um com engrenagem para "Configurar este espaço", e "+ Novo espaço"; no pé, "Ajuda e manual" e "Configurar o sistema". No celular, abre pelo botão ☰. A barra de cima fica só com o nome do espaço, no centro; logotipo, nome do sistema e sigla da instituição saem da tela de trabalho e ficam nas boas-vindas, na Ajuda e na aba do navegador. Feito no passo 1.14c: `js/telas/navegacao.js` (no lugar de `js/telas/topo.js`); no computador, a partir de 900 px, o menu fica ao lado do conteúdo e recolhe pelo botão ☰, deslizando, com a escolha lembrada no aparelho; abaixo disso, abre por cima, com fundo escurecido, e fecha ao escolher algo, ao tocar fora ou com Esc. A engrenagem aparece no espaço aberto e, no computador, ao passar o mouse nos outros (abre o espaço e a configuração dele). O item "Boas-vindas" saiu: o exemplo fica na Ajuda, e "Novo espaço" abre as boas-vindas com o formulário. O nome do espaço também saiu do alto do conteúdo e foi para a barra e para o título da aba do navegador. O logotipo virou o ícone da aba e aparece, com o nome e a sigla, nas boas-vindas e na Ajuda.
1.14d. ✔ Cadastro provisório de logins pelo Administrador do sistema, só durante a prototipagem, no lugar do console do Firebase. Feito em 22/10/2026, junto com a importação de responsáveis (decisão do responsável): em "Configurar este espaço" > Responsáveis > "Importar responsáveis de planilha", colar Nome (obrigatório), Tipo, Sigla, Setor e E-mail; conferir antes de gravar; gravar. Com e-mail, é uma pessoa e ganha a conta de acesso; sem e-mail, o tipo (pessoa ou unidade) precisa vir na planilha, porque não muda depois. A conta é criada numa segunda instância do Firebase, sem guardar sessão, para quem está cadastrando continuar logado; a senha é sorteada e descartada, e o Firebase manda à pessoa um e-mail para ela definir a própria. Conta que já existe só é ligada. Ninguém digita nem vê senhas. Responsável que já existe no espaço (mesmo e-mail, sigla ou nome) fica como está, ou ganha o e-mail, se for pessoa sem e-mail. No exemplo, as contas não são criadas. Provisório: até os papéis (passo 2.1), qualquer pessoa com login pode criar contas. Regras em `js/importar-responsaveis.js`; `importarResponsaveis` no `Store`; `criarConta` em `js/banco/firebase.js`.
1.15. ✔ Exclusão lógica e lixeira, para espaços, ações e responsáveis, com as regras de exclusão encadeada. Feito no passo 1.15: o `Store` filtra os excluídos em um lugar só (listas, leitura do espaço e acompanhamento) e ganhou `excluirAcao` (com `religar`: as dependentes passam às anteriores da excluída), `excluirResponsavel` (com `substituto`), `excluirEtapas` (com `destino` ou sem etapa), `excluirEspaco`, os `restaurar…` correspondentes e `listarLixeira`; o código de uma ação na lixeira continua reservado. Na tela (`js/telas/exclusao.js`, `js/telas/lixeira.js`): "Excluir ação" no pé da janela da ação; "Excluir" no formulário do responsável; o × de fase e etapa com ações; "Excluir este espaço" no fim de "Configurar este espaço". Exclusão sem itens afetados acontece na hora, com "Desfazer" no aviso (decisão do responsável, 21/10/2026); exclusão que afeta outros itens abre uma janela por cima do painel, com as alternativas da seção 4.7 e a primeira marcada. "Lixeira" no pé do menu lateral: o que foi excluído no espaço aberto e os espaços excluídos, com quem, quando e "Restaurar". Restaurar não refaz as ligações alteradas; o registro delas chega com o histórico (passo 1.16).
1.16. ✔ Histórico de alterações (seção 16.4). Primeira versão, feita em lote (21/10/2026; detalhes em `docs/registro-de-execucao.md`): registro por campo alterado (seção 4.2.1), gravado na mesma operação da alteração (no Firebase, na mesma transação), em `espacos/{id}/historico/{id}`, só de acréscimo; seção "Histórico de alterações" na janela da ação, em frases simples; o histórico entra na cópia de segurança (formato versão 2). Regras do banco atualizadas em `v2/firestore.rules`.
1.17. Modos de visualização interativos, no seletor da aba Ações, só no computador (seção 8.4; revisto em 21/10/2026, no lugar da aba Visualização), em três passos:
1.17a. ✔ Linha do tempo interativa, com a chance de cumprir o prazo e o gráfico da data final. Primeira versão, feita em lote (21/10/2026; detalhes e decisões provisórias em `docs/registro-de-execucao.md`): modo "Linha do tempo" no seletor, só no computador; regras em `js/linha-do-tempo.js`, com testes; tela em `js/telas/linha-do-tempo.js`.
1.17b. ✔ Cronograma (Gantt) interativo, com comparação de retrato. Primeira versão, feita em lote (21/10/2026; detalhes em `docs/registro-de-execucao.md`): modo "Cronograma", só no computador, com barras por fase e etapa, setas das dependências, caminho crítico, hoje e prazo final, aproximação em semanas ou meses; regras em `js/cronograma.js`, com testes; tela em `js/telas/cronograma.js`. A comparação com retrato chegou no passo 1.18.
1.17c. ✔ Rede (fluxo das ações) interativa. Primeira versão, feita em lote (21/10/2026; detalhes em `docs/registro-de-execucao.md`): modo "Rede", só no computador, com cartões em colunas na ordem em que as ações podem acontecer, setas (vermelhas no caminho crítico), destaque do que vem antes e depois ao passar o mouse e "Ver tudo"; regras em `js/rede.js`, com testes; tela em `js/telas/rede.js`.
1.18. ✔ Retratos manuais. Primeira versão, feita em lote (21/10/2026; detalhes em `docs/registro-de-execucao.md`): seção "Retratos" em "Configurar este espaço" (salvar com um nome e listar, com o resultado de cada um); cópia integral conforme a seção 4.4, com cabeçalho e ações em documentos próprios, gravados numa transação; no cronograma, "Comparar com" um retrato, com uma linha fina sob cada barra (completa o passo 1.17b). Regras em `js/retrato.js`; regras do banco em `v2/firestore.rules`. Enquanto não houver papéis, qualquer pessoa com login salva retratos.
1.19. Importação e exportação (planilha e Mermaid), cópia de segurança e restauração. *Dividido em dois na execução em lote (21/10/2026, provisório, à espera do responsável):* o que só lê os dados (1.19a) e o que grava (1.19b).
1.19a. ✔ Exportação e cópia de segurança. Primeira versão, feita em lote (21/10/2026; detalhes e formato do arquivo em `docs/registro-de-execucao.md`): em "Configurar este espaço", seção Exportar, com "Copiar para planilha" e "Copiar fluxograma" (Mermaid); em "Configurar o sistema", "Baixar cópia de segurança" de todos os espaços, inclusive a lixeira. Regras em `js/exportar.js` e `copiaDeSeguranca` no `Store`, com testes.
1.19b. ✔ Importação por planilha e restauração da cópia de segurança. A importação por Mermaid foi cancelada (decisão do responsável, 22/10/2026). Feito no passo 1.19b:
- **Importar ações de planilha** (nome dado pelo responsável em 22/10/2026), em "Configurar este espaço": colar as linhas com a linha de títulos, no formato de "Copiar para planilha" (as colunas calculadas são ignoradas); escolher entre "Só criar ações novas" e "Também atualizar as que já existem" (decisão do responsável, 22/10/2026); conferir antes de gravar, linha a linha, com avisos; gravar. Uma ação já existe quando tem o mesmo número, código ou nome. Ao atualizar, célula vazia não muda nada. Fases e etapas que faltam são criadas. Dependências podem citar ações existentes (número, código ou nome) e outras linhas da planilha (nome, ou o número da coluna Número quando ele não existe no espaço, como ao levar ações para um espaço novo). Ação já liberada não tem a estimativa mudada pela importação (aviso: use "Reestimar"). Responsável não cadastrado fica de fora, com aviso. Também na conferência (ajuste de 22/10/2026): dependência que criaria um ciclo, código inválido ou já usado (no espaço ou em outra linha) e nome repetido na planilha. Dependências pelo código (ajuste de 22/10/2026, planilha da PI²): o código de cada linha é guardado mesmo com "Códigos das ações" desligado, e "Depende de" procura primeiro os códigos (da planilha e do espaço), depois os números e os nomes; assim, códigos só de algarismos, como "001", não se confundem com números. Títulos aceitos também: "ID" e "Cod" para o código; "Predecessoras" para as dependências. Cada linha é gravada pelas operações comuns, com validação e histórico; uma linha que falhe não impede as outras. Regras em `js/importar.js` e `importarAcoes` no `Store`.
- **Restaurar uma cópia**, em "Configurar o sistema" (e, com o banco vazio, pelo link nas boas-vindas): confere o arquivo, mostra o resumo, pede confirmação e recria tudo exatamente como estava (ids, números, lixeira, histórico, retratos e calendário geral). Só com login e só num banco sem nenhum espaço, nem na lixeira: nunca mistura nem sobrescreve. `conferirCopia` e `restaurarCopia` no `Store`; teste de ida e volta (a cópia do banco restaurado é igual à original).
1.20. ✔ Troca, feita em 23/10/2026: a versão 2 foi da pasta `/v2/` para a raiz do site, com o banco que ela já usava (projeto `sextante-v2`, com a PI²); os dados da versão 1 foram descartados, sem migração (seção 11); `/v2/` passou a redirecionar para a raiz; a cópia da versão 1 ficou só como dado do teste de comparação; esta documentação foi refeita a partir da especificação, do rascunho e da documentação da versão 1, sem revisão do responsável, que pediu rigor; AGENTS.md, README e CONTRIBUTING atualizados; a especificação foi apagada.
1.21. Piloto: usar a versão 2 de verdade num plano real, a PI², por algumas semanas: registrar as conclusões e reestimativas à medida que acontecem e conferir se as previsões, os avisos e as telas ajudam no acompanhamento. O que o uso mostrar vira correção ou entra nos pontos para reavaliação (seção 14).
1.22. Manual do usuário, **parado** até o responsável liberar (reafirmado em 23/10/2026). Deve trazer as tabelas de decisão desta documentação, como a das situações das entregas (seção 16.7); as que chegarem depois entram no manual junto com o passo que as implementar.

### Fase 2: organização e permissões (obrigatória antes do uso oficial; continua no protótipo, decisão do responsável de 23/10/2026)

2.1. Papéis por espaço (Administrador do espaço, Usuário, Leitor) e espaço aberto ou fechado, com as regras de acesso do banco correspondentes (seção 16.3).
2.2. Visibilidade: pública, institucional ou restrita.
2.3. Encerrar e reabrir; regra do último administrador; telas mínimas de administração (espaço órfão).
2.4. Tipos de espaço e modelos prontos; estimativas opcionais e previsões desligáveis (seção 16.1). No menu lateral, os espaços passam a ser agrupados por tipo, cada grupo com o nome do tipo no plural ("Planos de Ação", "Projetos", "Quadros de Tarefas"), só para os tipos que existirem; até lá, um grupo só, "Espaços" (decisão do responsável, 21/10/2026). Dividido em dois em 23/10/2026 (decisão do responsável):
2.4a. ✔ Tipos de espaço. Feito em 23/10/2026: campos `tipo`, `programa` e `aprovacao` do espaço (seção 4.1, com 4.1.6); regras em `js/tipos.js`, com testes; escolha do tipo na criação e em "Configurar este espaço" (`js/telas/tipo-espaco.js`), em dois cartões com a explicação de cada tipo; no Plano de Ação, o Programa do PEI/PDI (texto livre até o passo 2.5) e o documento de aprovação (identificação obrigatória, link opcional); no Projeto, os dois são apagados. Os espaços que já existiam, como a PI², ficam como Projeto, sem gravação: o tipo ausente vale `projeto` (decisão do responsável). Menu lateral agrupado por tipo; sem espaço nenhum, o grupo "Espaços". Mudar o tipo em "Configurar este espaço" muda o grupo na hora.
2.4b. Modelos prontos na criação (seção 16.1): "Cronograma estruturado", "Cronograma aberto" e "Personalizado". Inclui a data-limite opcional, antecipada do passo 2.10a (decisão do responsável, 23/10/2026). Decisões do responsável (23/10/2026): os prazos são por estimativa **ou** por data-limite, nunca os dois no mesmo espaço; o personalizado escolhe os prazos, as dependências e a simulação (só com estimativa); o modelo fica fixo depois de criado, a reavaliar (seção 14, item 5); no cronograma aberto, o indicador "Tempo restante" conta até a data-limite. Em partes:
- ✔ Parte 1, dados e cálculo: campo `modelo` do espaço (4.1.7) e `dataLimite` da ação (4.2); regras em `js/modelos.js`; o cálculo (`caminhoCritico`), a lista, o retrato, a exportação e a conferência da importação seguem o modelo; o Store recusa o que o modelo desliga. Sem tela ainda: os espaços existentes continuam como cronograma estruturado.
- Parte 2, telas: escolha do modelo na criação; campos, visualizações e indicadores conforme o modelo.
2.5. Catálogo do PEI/PDI e Gestor da Estratégia.
2.6. Entregas dos Planos de Ação: cadastro obrigatório das entregas e registro do alcance, com evidência (seção 16.7). Exemplo de Plano de Ação, com entregas e evidências.
2.7. Situações personalizadas, aviso de nova dependência, volta à situação inicial e nome renomeável da situação inicial (seção 16.2).
2.8. ✔ Checklist. Feito no lote de 22/10/2026 (antes dos passos 2.1 a 2.7, por não depender deles nem de regras novas no banco): campo `checklist` da ação (4.2.2); na janela da ação, "Adicionar checklist", itens com caixa de marcar, texto editável com um clique e ×; progresso "feitos/total" nos cartões da lista e do quadro.
2.9. Comentários.
2.10. Extração personalizada (seção 16.6).
2.10a. Campos opcionais: etiquetas, prioridade da equipe (lista ordenada), links e documentos da ação, justificativa e local; forma de prazo "data-limite opcional" (seções 16.1 e 16.8).
2.11. Proteção da `main`: com o uso oficial, mudanças só por *pull request* (gatilho do AGENTS.md).

### Fase 3: quadro de tarefas (continua no protótipo)

3.1. Tipo "Quadro de tarefas": sem dependências nem previsões, com colunas criadas no dia a dia e experiência no estilo Trello, Planner e Todoist. Exemplo de Quadro de tarefas.
3.2. Recorrência de tarefas (seção 16.8).

### Fase 4: passagem do protótipo à equipe de TI da UFCI-MG

*Revista em 23/10/2026 (decisão do responsável):* o protótipo não vai para o servidor da instituição (veja "Natureza do sistema", no alto). Os antigos passos desta fase (PostgreSQL e programa do servidor; login institucional pela Identificação Única; envio de arquivos dos documentos; retratos automáticos; carga para o Data Lakehouse por Apache Spark ou Apache Hop) deixam de ser passos do protótipo e passam a ser **requisitos do sistema definitivo**, a combinar com a equipe de TI. Onde este texto citar passos 4.1 a 4.5 antigos (IU, unidades oficiais, PostgreSQL, envio de arquivos, retratos automáticos, Data Lakehouse), leia "sistema definitivo". Conteúdo aprovado pelo responsável em 23/10/2026:

4.1. Documentação conceitual completa para a equipe de TI: regras de cálculo com as fontes, dicionário de dados, telas e comportamentos, decisões com os motivos.
4.2. Casos de referência: planos de exemplo com os resultados esperados (datas, chances, índices), com a semente fixa, para conferir a nova implementação contra o protótipo.
4.3. Apresentação do protótipo à equipe de TI e acompanhamento do novo desenvolvimento, como fonte das regras.

### Futuro, sem fase

- Previsão por classe de referência (seção 13).
- Custos: custo previsto e lançamentos executados por ação, orçamento do espaço e curvas de previsto contra executado (seção 16.8).
- Registro de riscos do espaço (seção 16.8).
- Aplicativo instalável no celular (PWA; seção 13).
- Avaliar baixar o diagrama como imagem.
- Editor visual do fluxo dentro do sistema, que torne desnecessárias a importação e a exportação por Mermaid (desejo do responsável).
- Reavaliar os pontos da seção 14 com o sistema em uso.
- Revisar o nome do sistema, já que "Planos de Ação" deixa de abranger todos os tipos de espaço (decisão do responsável). Nome provisório adotado: **Sextante**, instrumento de navegação, em harmonia com o logotipo; continua sob avaliação. Antes de torná-lo definitivo: pesquisar marcas registradas no INPI ("Sextante" já é o nome de uma editora conhecida no Brasil, o que pode gerar confusão, embora de outro ramo). Outro candidato considerado: **Dira** ("bússola" em suaíli), sujeito às mesmas verificações e à de não coincidir com sigla de unidade da instituição.

### Decisões pendentes, com o passo em que precisam estar tomadas

- **Nome padrão da situação inicial** nos espaços sem dependências, como "A fazer" (passo 2.7).
- **Integração com os cadastros da instituição** (servidores pela IU e unidades organizacionais): protocolo de comunicação desconhecido; passa a ser requisito do sistema definitivo (fase 4, revista em 23/10/2026).

---

## 13. Pendências e ideias futuras

### 13.1 Pendências

- **Piloto (passo 1.21):** uso real na PI² por algumas semanas, registrando conclusões e reestimativas, para conferir previsões, avisos e telas.
- **Manual do usuário (passo 1.22):** parado até o responsável liberar. O arquivo `docs/manual-do-usuario.md` ainda descreve a versão 1.
- **Fases 2 e 3** (seção 12): papéis e visibilidade, encerramento, tipos de espaço, catálogo do PEI/PDI, entregas dos Planos de Ação, situações personalizadas, comentários, extração de dados, campos opcionais e quadro de tarefas.
- **Fase 4** (seção 12): passagem à equipe de TI, com a documentação conceitual, os casos de referência e o acompanhamento do novo desenvolvimento.
- **Pontos para reavaliação** (seção 14), com o sistema em uso.
- **Velocidade:** com 200 ações, a simulação leva cerca de 1 s no ambiente de teste. Se travar no celular, levá-la para segundo plano (*Web Worker*).

### 13.2 Ideias futuras


- **Previsão por classe de referência** (*reference class forecasting*). Objetivo: combater a **falácia do planejamento**, a tendência de subestimar prazos ao olhar só para o caso em mãos (a "visão de dentro"), descrita por Kahneman e Tversky. A correção proposta por Kahneman e Lovallo, e transformada em método por Flyvbjerg, é a "visão de fora": partir do que de fato aconteceu em casos semelhantes. Proposta em dois níveis:
  1. **Alerta:** ao estimar uma ação, o sistema mostra quanto, nas ações já concluídas, o prazo real superou o estimado. Exemplo: "Nas ações concluídas, o prazo real foi, em média, 40% maior que o mais provável."
  2. **Sugestão de estimativa:** o sistema propõe os três pontos já corrigidos pela razão entre prazo real e estimado, observada em ações semelhantes (mesma equipe, responsável ou tipo de ação). Quando houver poucos dados de um grupo, usa a média geral e se aproxima do grupo conforme os dados aumentam (estimativa bayesiana hierárquica).
  - **Dados necessários:** as estimativas originais e as datas reais de liberação e conclusão. O histórico de estimativas da ação (seção 4.3) já guarda a estimativa original e todas as revisões.
  - Referências: KAHNEMAN, D.; TVERSKY, A. Intuitive prediction: biases and corrective procedures (1979); LOVALLO, D.; KAHNEMAN, D. Delusions of success. *Harvard Business Review* (2003); FLYVBJERG, B. From Nobel Prize to project management: getting risks right. *Project Management Journal* (2006); KAHNEMAN, D. *Rápido e devagar* (2011).
- **Aplicativo para celular, com acesso restrito à instituição.** Objetivo: distribuição gratuita, com uso só por pessoas da UFCI-MG. Proposta em etapas:
  1. **Primeiro, aplicativo instalável pelo navegador** (*Termo técnico: PWA, progressive web app*): manifesto e ícones para instalar o site na tela inicial do Android e do iPhone, sem lojas, sem custo e sem revisão da Apple ou do Google.
  2. **Restrição pelo login, não pela loja.** Mesmo a distribuição "não listada" da Apple deixa o app disponível para quem tiver o link. O controle de acesso fica no Firebase: mudar o `firestore.rules` para exigir login também na leitura (hoje pública, seção 3.6) e, se desejado, aceitar só e-mails do domínio institucional.
  3. **Lojas, se necessárias:** empacotar o site (por exemplo, com o Capacitor). **iPhone:** distribuição não listada, que exige aprovação na revisão da Apple, conta de teste para os revisores e funções além de um site embrulhado. **Android:** publicação comum na Play Store, com login obrigatório; a opção "privada" exige celulares gerenciados pela instituição.
  - **Custos e conta:** o programa de desenvolvedor da Apple é anual (US$ 99), com isenção para instituições de ensino e órgãos públicos só em alguns países; verificar se o Brasil está incluído. O Google cobra taxa única. As contas devem ser da instituição (CNPJ), não pessoais.
  - **Quando:** a avaliar; com o protótipo, talvez só o primeiro passo. A restrição da leitura depende de decisão do responsável, porque muda a regra atual de consulta aberta (seção 3.6).

---

## 14. Pontos para reavaliação

Decisões aceitas para seguir em frente, mas que o responsável pediu para **reavaliar depois**, com o sistema em uso. Quem mexer nessas regras deve ler esta seção antes.

1. **Data de liberação de ações criadas depois (seção 5.1).** Problema: hoje toda ação começa a contar no dia em que a anterior termina. Uma ação criada no meio do espaço, cujas anteriores já terminaram, nasceria atrasada. Solução adotada: campo opcional "Não começa antes de", preenchido com a data de criação. Alternativas consideradas: (a) contar sempre da data de criação, regra invisível e confusa; (b) permitir defasagem entre ações, como "começa 5 dias após a anterior" no MS Project, mais complexa (YAGNI). A reavaliar: se o campo é compreendido pelos usuários e se a data de criação é o padrão certo.
2. **Estimativa livre antes da liberação (seção 5.3).** Enquanto a ação aguarda, a estimativa muda sem histórico; a "original" passa a ser a vigente na liberação. A reavaliar: se isso esconde o otimismo do planejamento inicial, o que prejudicaria a previsão por classe de referência. Alternativa: registrar também essas mudanças, sem contá-las como reprogramação.

3. **Distribuição beta-PERT (seção 5.2).** Adotada por coerência com a fórmula das datas, por ser padrão de mercado e fácil de explicar. Crítica conhecida: concentra os sorteios perto do mais provável e dá pouco peso aos extremos, o que pode deixar a previsão otimista. Alternativas: a triangular, mais pessimista com os mesmos três pontos (na PI², 74% contra 89,5% de chance de cumprir o prazo); ou tratar o otimista e o pessimista como "10% e 90% de chance", e não como limites absolutos, o que engorda as caudas. A reavaliar: comparar previsões e conclusões reais quando houver histórico.
4. **Durações independentes entre ações (seção 5.7).** A simulação supõe que o prazo de uma ação não influencia o das outras. Na prática, uma mesma causa (falta de pessoal, greve, troca de gestão) atrasa várias ações juntas, e ignorar isso deixa o resultado otimista; costuma ser o efeito mais forte. Alternativas, em ordem de complexidade: correlação entre ações de uma mesma etapa ou responsável; causas comuns modeladas explicitamente (*Termo técnico: risk drivers*). A reavaliar com o sistema em uso. A correção principal do otimismo continua prevista na previsão por classe de referência, com o histórico real da instituição.
5. **Modelo fixo depois de criado (seção 4.1.7; passo 2.4b).** O modelo (prazos por estimativa ou data-limite, dependências e simulação) é escolhido na criação e não muda, porque algumas coisas são necessariamente diferentes entre os modelos (decisão do responsável, 23/10/2026). A reavaliar com o uso: se faz falta mudar o modelo de um espaço existente, e com que conversão dos dados.

### 14.1 Decisões da execução em lote (21 e 22/10/2026)

Tomadas sem consulta durante a execução em lote (seção 3.3). **Todas aprovadas pelo responsável em 23/10/2026**, por estarem em uso sem problemas; ficam como regras dos passos correspondentes. Exceção: o item 29 (migração) perdeu o objeto, porque a migração foi cancelada (seção 11). O diário técnico (`docs/registro-de-execucao.md`) guarda os detalhes de cada passo.

**Aprovadas antes, em 22/10/2026:**
- Linha do tempo (passo 1.17a): eixo do início do espaço (ou de hoje, se for antes) até a última data simulada ou o prazo final, com uma semana de folga; barras por semana, de segunda a domingo; em cada cenário, o trabalho termina no dia útil em que a última ação acaba (a mesma regra da conclusão prevista); faixa do cartão "Prazo final" vermelha quando a chance é menor que 50%; modo só no computador; termo "Chance de cumprir o prazo" no glossário.
- Aviso de falta de conexão na barra do topo, inclusive para a rede ligada sem internet.

Os itens abaixo mantêm a numeração original (1 a 4, da linha do tempo, aprovados em 22/10/2026); de 5 a 28, aprovados em 23/10/2026.

**Cronograma (passo 1.17b)**
5. Sem filtros nem ordem: mostra sempre o espaço inteiro, na ordem do espaço, porque as setas ligariam ações escondidas.
6. Uma ação pode começar no mesmo dia em que a anterior termina, quando a anterior termina no meio do dia (o cálculo usa frações de dia).
7. Cores: vermelho sem folga, verde-azulado com folga, verde concluída; ação sem estimativa como um pequeno retângulo tracejado.
8. Duas aproximações, semanas e meses. Sem arrastar barras: as datas vêm das estimativas e das dependências.

**Rede (passo 1.17c)**
9. Sem filtros nem ordem, como no cronograma.
10. Sem cartões de "Início" e "Fim".
11. Uma seta que pula colunas passa por trás dos cartões do meio, sem desvio.
12. Cartões de tamanho fixo, com o nome em até duas linhas; o nome inteiro aparece ao parar o mouse.

**Exportação e cópia de segurança (passo 1.19a)**
13. O passo 1.19 foi dividido em 1.19a (só leitura) e 1.19b (importação e restauração, que gravam).
14. Exportar fica em "Configurar este espaço"; a cópia de segurança, de todos os espaços, em "Configurar o sistema".
15. Planilha por cópia (colar), sem gerar arquivo .xlsx; colunas como no diário técnico; sem as prioridades calculadas.
16. Nome do arquivo da cópia: nome do sistema, "copia" e a data.

**Histórico de alterações (passo 1.16)**
17. Um registro por campo alterado; nas listas (dependências, responsáveis, estimativas), a lista inteira antes e depois.
18. Só as ações têm histórico (seção 16.4); o espaço e os responsáveis, não.
19. A correção de estimativa também entra no histórico de alterações.
20. A seção começa recolhida na janela da ação; o autor aparece pelo nome do responsável ligado ao e-mail.

**Retratos (passo 1.18)**
21. Qualquer pessoa com login salva retratos, até existirem os papéis (passo 2.1).
22. Não há como excluir retrato, nem os manuais.
23. A comparação com retrato fica só no cronograma, com uma linha cinza fina sob cada barra.

**Lote de 22/10/2026, à noite (detalhes no diário de execução)**
24. Quadro: cartões sem data nem carimbo "Atrasada"; a coluna diz a situação e a barra, o prazo.
25. Círculo da pessoa com a sigla só quando ela tem até três letras; sem sigla, as iniciais.
26. Textos pequenos em `--muted` (contraste mínimo de 4,5:1); `--faint` fica para traços e enfeites.
27. Simulação reaproveitada quando nada do que entra nela muda; sem *Web Worker* por enquanto.
28. Checklist sem "feito por" e "feito em" no item (o histórico guarda) e sem reordenar itens.
29. ~~Migração a partir da cópia de segurança da versão 1 (seção 11).~~ Sem objeto: migração cancelada em 23/10/2026.

**Já combinado para o passo 1.19b:** na importação, quem importa escolhe entre atualizar as ações que já existem ou só criar novas (responsável, 22/10/2026).

---

## 15. Fundamentos matemáticos dos indicadores por ação

Esta seção registra as fórmulas, as hipóteses e as razões de cada escolha, para revisão por especialistas. As decisões foram discutidas com o responsável em 16/10/2026, inclusive à luz da conversa "Schedule Sensitivity Index".

### 15.1 Notação

- A simulação gera *K* cenários (padrão: 10.000), com semente fixa.
- Em cada cenário *k*: dᵢ⁽ᵏ⁾ é a duração sorteada da ação *i*, em dias úteis (distribuição beta-PERT; ações concluídas têm duração fixa, igual à real); T⁽ᵏ⁾ é a duração total, do início à conclusão de todas as ações.
- σᵢ e σ_T são os desvios-padrão de dᵢ e de T entre os cenários.
- 𝟙ᵢ⁽ᵏ⁾ vale 1 se a ação *i* está no caminho crítico do cenário *k* (folga total zero), e 0 caso contrário.

### 15.2 Prioridade de execução: índice de criticidade

**Fórmula:** CIᵢ = (1/K) · Σₖ 𝟙ᵢ⁽ᵏ⁾

**Por que é a medida certa para "o que não pode atrasar":** em cada cenário, T é o máximo das somas de durações sobre todos os caminhos da rede. Quando o caminho crítico é único (o que ocorre com probabilidade 1 em distribuições contínuas), a derivada de T em relação a dᵢ é 1 se *i* está nesse caminho e 0 se não está: ∂T⁽ᵏ⁾/∂dᵢ = 𝟙ᵢ⁽ᵏ⁾. Logo, um atraso pequeno δ, imposto à ação *i*, aumenta a duração esperada do espaço em aproximadamente E[∂T/∂dᵢ] · δ = CIᵢ · δ. Ou seja, CIᵢ é o **efeito médio, em dias do espaço, de cada dia de atraso na ação**. Daí a legenda "com 70%, cada dia de atraso atrasa o espaço em cerca de 0,7 dia".

**Limitação conhecida:** numa rede muito sequencial, quase todas as ações têm CI perto de 100%, e o indicador diferencia pouco. Não é erro: nessa rede, qualquer atraso atrasa a conclusão. A ordem de execução entre ações igualmente críticas fica a critério da equipe, como diz a legenda.

**Alternativa considerada e descartada: inclinação da regressão** de T sobre dᵢ, βᵢ = Cov(dᵢ, T) / Var(dᵢ), que também estima "dias de conclusão por dia da ação". Ela mede a resposta da conclusão à **variação natural** da ação; o CI mede a resposta a um **atraso imposto**, que é a pergunta do gestor. Além disso, βᵢ é instável quando Var(dᵢ) é pequena (divisão por um número próximo de zero) e indefinida para ações de duração fixa. Em redes com caminho dominante, βᵢ ≈ CIᵢ, e o CI é mais estável.

**Por que não usar um corte (por exemplo, "prioritária se CI ≥ 50%"):** cortes tratam como diferentes casos praticamente iguais (49% e 51%), o problema do paradoxo de sorites. O indicador é mostrado como barra contínua.

### 15.3 Prioridade de revisão: contribuição para a variância

**Fórmula, em três passos:**

1. Correlação de Pearson entre a duração da ação e a duração total, nos *K* cenários: rᵢ = Cov(dᵢ, T) / (σᵢ · σ_T).
2. Parcela bruta: qᵢ = max(rᵢ, 0)². Correlações negativas, que em redes só com dependências término→início vêm de ruído amostral, são tratadas como zero.
3. Normalização: CVᵢ = qᵢ / Σⱼ qⱼ, somando sobre as ações não concluídas. Assim, Σᵢ CVᵢ = 100%.

Ações concluídas e ações de duração fixa (σᵢ = 0, em que rᵢ fica indefinida) recebem CVᵢ = 0.

**Interpretação:** se T fosse uma função linear das durações, T ≈ a + Σᵢ bᵢ dᵢ, com durações independentes, teríamos Var(T) = Σᵢ bᵢ² σᵢ² e rᵢ² = bᵢ² σᵢ² / σ_T². Então rᵢ² seria exatamente a **fração da variância do prazo explicada pela ação *i***, e as frações somariam 1. Como a rede tem trechos em paralelo, T é o máximo entre caminhos e não é linear; a soma dos rᵢ² fica abaixo de 1. A normalização reparte a parte explicada entre as ações, preservando a ordem e dando um número fácil de comunicar: "responde por X% da incerteza".

**Precisão:** com K = 10.000, o erro-padrão de rᵢ é aproximadamente (1 − rᵢ²)/√K ≤ 0,01. É mais que suficiente para ordenar as ações.

**Relação com o SSI:** SSIᵢ = CIᵢ · σᵢ / σ_T. No modelo linear com bᵢ ≈ CIᵢ, rᵢ ≈ CIᵢ · σᵢ / σ_T = SSIᵢ. Logo, a ordem das ações pela contribuição para a variância é, em geral, a mesma que pelo SSI; as duas medidas respondem à mesma pergunta.

### 15.4 Por que a contribuição para a variância, e não o SSI ou a crucialidade

- **SSI (índice de sensibilidade do cronograma):** responde à pergunta certa, mas o número ("0,28") não tem leitura direta para leigos e não tem nome comum fora da literatura acadêmica.
- **Crucialidade (correlação de Pearson ou de Spearman):** é o passo 1 do cálculo acima. Sozinha, também não tem leitura direta, e seus valores não somam nada interpretável. O defeito apontado antes, a instabilidade em ações de prazo pouco incerto, pesa pouco aqui, porque essas ações ficam com parcelas quase nulas de qualquer forma.
- **Contribuição para a variância:** mesma ordem, leitura direta ("18% da incerteza") e é a medida padrão das ferramentas comerciais de análise de risco de cronograma, reconhecível por gestores e auditores.
- **Conferência por dois índices (SSI e crucialidade de Spearman),** recomendada para analistas: fica fora da tela, para não mostrar dois números parecidos a leigos. Ideia futura: calcular a crucialidade de Spearman internamente e só mostrar um aviso quando a ordem divergir muito, o que costuma indicar caminhos paralelos competindo.

### 15.5 Referências

- VAN SLYKE, R. M. Monte Carlo methods and the PERT problem. *Operations Research*, v. 11, n. 5, p. 839–860, 1963. DOI: [10.1287/opre.11.5.839](https://doi.org/10.1287/opre.11.5.839). Texto completo (relatório técnico, Universidade da Califórnia em Berkeley): [DTIC AD0412731](https://apps.dtic.mil/sti/pdfs/AD0412731.pdf). (Fonte primária do índice de criticidade: probabilidade de a ação estar no caminho mais longo.)
- WILLIAMS, T. M. Criticality in stochastic networks. *Journal of the Operational Research Society*, v. 43, n. 4, p. 353–357, 1992. DOI: [10.1057/jors.1992.50](https://doi.org/10.1057/jors.1992.50) (resumo público). (Discute o índice de criticidade e propõe a crucialidade, base da contribuição para a variância; o SSI.)
- ELMAGHRABY, S. E. On criticality and sensitivity in activity networks. *European Journal of Operational Research*, v. 127, 2000.
- VANHOUCKE, M. Using activity sensitivity and network topology information to monitor project time performance. *Omega*, v. 38, 2010. (Compara CI, SSI e crucialidade.)
- HULETT, D. *Practical Schedule Risk Analysis*. Gower, 2009. (Análise de risco de cronograma e gráficos de sensibilidade.)

### 15.6 Como reproduzir a simulação por fora

Com a semente, o número de simulações e a versão do cálculo de um retrato, qualquer pessoa ou IA pode refazer a simulação, em Python, R ou outra linguagem, e obter **exatamente** os mesmos números, desde que siga estes passos (versão do cálculo 1; código em `js/simulacao.js`):

1. **Gerador:** mulberry32, iniciado com a semente (inteiro de 32 bits sem sinal). Cada chamada soma 0x6D2B79F5 ao estado e devolve um número em [0, 1), pelas operações de 32 bits do código.
2. **Normal padrão:** Box-Muller, com dois sorteios (u, v), repetidos enquanto valem 0: √(−2 ln u) · cos(2πv).
3. **Gama(forma, 1):** método de Marsaglia e Tsang; para forma < 1, Gama(1 + forma) · U^(1/forma), com um sorteio U depois.
4. **Beta-PERT:** se P ≤ O, a duração é M, sem sorteio. Senão, α = 1 + 4(M − O)/(P − O), β = 1 + 4(P − M)/(P − O), X = Gama(α), Y = Gama(β), nessa ordem, e a duração é O + (P − O) · X/(X + Y).
5. **Ordem dos sorteios:** cenário por cenário; dentro de cada cenário, ação por ação na ordem de cálculo, que é a ordem topológica (algoritmo de Kahn, com fila) partindo das ações ordenadas por `ordem` e, nos empates, por código. Ações concluídas não sorteiam.
6. **Em cada cenário:** as regras do cálculo determinístico (seções 5.1 a 5.5), com a duração sorteada no lugar do PERT. Uma ação liberada cuja conclusão sorteada caia em dia anterior a hoje passa a terminar hoje.
7. **Resultados:** quantis pela posição mais próxima para cima (o valor de posição ⌈q·K⌉ na lista ordenada); chance de cumprir o prazo = fração dos cenários com conclusão até o prazo final, inclusive; prioridades pelas fórmulas das seções 15.2 e 15.3, com folga menor que 10⁻⁶ dia considerada zero.

Com outro gerador, os resultados são estatisticamente equivalentes, com diferença da ordem de meio ponto percentual na chance de cumprir o prazo.

---

## 16. Ampliação do escopo (em discussão)

Decisões acordadas com o responsável em 19/10/2026. A fase em que cada uma entra (versão 2 ou depois) ainda será definida. Quando for, cada item migra para a seção correspondente desta documentação.

### 16.1 Finalidades e tipos de espaço

**Nomes na tela (decisão de 20/10/2026):** cada tipo é chamado pelo próprio nome, para não se confundir com o "Plano de Entregas" e o "Plano de Trabalho" do PGD. **Palavra geral: Espaço de Planejamento** (decisão de 20/10/2026), o conjunto que reúne um Plano de Ação, um Projeto ou um Quadro de tarefas. Na fala do dia a dia, "espaço"; na tela, o nome completo sempre que couber, e "Espaço" nas telas estreitas. Exemplos: "Meus espaços"; "Novo espaço de planejamento: Plano de Ação, Projeto ou Quadro de tarefas". O qualificativo "de Planejamento" afasta o sentido físico e as colisões com outros "espaços", como os do Google Chat. Foram descartados: Espaço (colide com o PGD), Projeto (errado para o quadro), Painel (já significa *dashboard*), Rota (não combina com o quadro de tarefas, de destinos difusos) e outros. Nesta documentação, o conjunto é sempre chamado de "espaço"; no código e no banco, `espaco`. Na criação, escolhe-se o tipo, com explicação clara de cada um na tela:

1. **Plano de Ação:** só os estrategicamente formalizados, derivados do PEI/PDI. Mantém o sentido institucional exato. Exige escolher o Programa que o prevê, num catálogo (Objetivo Estratégico → Objetivo de Desenvolvimento → Política → Portfólio, opcional → Programa → Plano de Ação; cadeia confirmada pelo responsável), e informar o documento que o aprovou: a identificação no SIPAC/Protocolo e, opcionalmente, o link. Enviar o arquivo só será possível no servidor da UFCI-MG.
2. **Projeto:** os de propósito geral; mesmo motor do tipo 1, sem vínculo obrigatório ao catálogo.
3. **Quadro de tarefas:** gestão de tarefas no estilo Trello, Planner e Todoist. Sem dependências nem previsões. Experiência a mais simples e fluida possível. Pode ser **individual** (uma pessoa organiza as próprias tarefas) e ser compartilhado depois, quando alguém chega à equipe: é só um espaço restrito em que o criador convida outras pessoas (papéis e visibilidade, seção 16.3). O nome era "Quadro de equipe" até 21/10/2026; mudou porque "de equipe" excluía o uso individual.

**Ação e tarefa são a mesma coisa** (decisão do responsável, 21/10/2026). No Plano de Ação e no Projeto, o item do espaço se chama **ação**; no Quadro de tarefas, **tarefa**, porque é assim que se pensa num quadro (como no Planner e no Todoist) e porque "ação" soa formal para o uso diário. Só a palavra na tela muda conforme o tipo do espaço: a entidade, os campos, o código e o banco são os mesmos (`acao`, seção 4.2). Os textos da tela ficam centralizados, para a troca ser feita num lugar só.

**Formas de prazo** (decisão do responsável, 21/10/2026). Cada espaço escolhe como os prazos são definidos:

1. **Estimativa em dias úteis:** três pontos por ação, cálculo, previsões, prioridades e datas excluídas (seção 5). É a única forma até a Fase 2. Uma ação sem estimativa não entra nas previsões.
2. **Data-limite opcional:** cada ação pode ter uma data-limite escolhida pela pessoa, como no Planner e no Todoist, sem cálculo nem previsões. A ação com data-limite vencida e não concluída recebe o carimbo "Atrasada"; a ação sem data-limite simplesmente não tem prazo. Ter e não ter data-limite convivem no mesmo espaço.

As **datas excluídas** só fazem sentido na forma 1: em "Configurar o espaço", a seção aparece só nela (não é um campo opcional próprio). A escolha da forma entra entre as opções dos modelos de configuração, na Fase 2, quando a forma 2 for construída (novo campo `dataLimite` na ação, com regra própria de "Atrasada" e telas sem as barras de prioridade). O Quadro de tarefas (Fase 3) usa só a forma 2.

Nos tipos 1 e 2, a criação oferece **modelos prontos de configuração**, como na escolha de opções no início de um jogo: "Cronograma estruturado" (dependências, estimativas e previsões ligadas; por exemplo, obras e eventos), "Cronograma aberto" (sem dependências, estimativas opcionais; por exemplo, projetos de TI) e "Personalizado". Escolhido o modelo, cada opção pode ser ajustada. No tipo 3, não há modelo: as colunas são criadas no dia a dia.

Uma ação sem estimativa não entra nas previsões. Desligar as previsões é um campo opcional do espaço.

**Cronograma aberto, definido em 23/10/2026 (decisão do responsável):** é um projeto **sem estimativas**, de trabalho em ritmo contínuo, parecido com o Scrum na prática, mas sem a metodologia (sem ciclos nem cerimônias). Sem dependências, sem estimativas e sem previsões: ficam a lista, o quadro e a planilha; somem a rede, o cronograma e a linha do tempo, que dependem de cálculo. Sem estimativa por natureza, a ação não leva a marca "Falta estimar" nem gera o aviso de previsão incompleta. O prazo de cada ação, quando houver, é a **data-limite opcional** (forma 2, acima). Com isso, "previsões desligáveis" deixa de ser uma escolha à parte: quem não quer previsões escolhe o cronograma aberto, ou desliga no modelo "Personalizado". **Diferença para o Quadro de tarefas** (fase 3): o modo de usar. O cronograma aberto é para **projetos** de uma equipe, com fases, etapas e responsáveis; o quadro de tarefas é para as **tarefas do dia a dia**, misturando assuntos, com colunas livres e uso individual.

### 16.2 Situações das ações

- **Não liberada** (substitui "Aguardando"): calculada pelo sistema; só existe em espaços com dependências. Símbolo: cadeado fechado.
- **Liberada:** base das ações não bloqueadas. Símbolo: cadeado aberto. Nos espaços sem dependências, o nome padrão na tela é outro, para não confundir (como "A fazer"), e o administrador do espaço pode renomeá-lo, como no Planner.
- **Situações personalizadas:** criadas pelo administrador do espaço, como "Selecionada", "Em andamento", "Em teste" e "Em revisão". São subtipos de Liberada e viram colunas do quadro.
- **Concluída:** obrigatória em todos os tipos. Símbolo: visto (✓) num círculo.

O carimbo **Atrasada** continua independente das situações.

**Volta à liberação:** quando as anteriores de uma ação Não liberada terminam, ela volta sempre para a situação inicial (Liberada ou o nome dado a ela), e não para a situação personalizada em que estava antes. É mais simples e previsível.

**Nova dependência numa ação liberada:** se alguém acrescenta como anterior uma ação ainda não concluída, abre-se um aviso antes de gravar: a ação passará para Não liberada e sairá da sua situação atual (por exemplo, "Em teste"). A pessoa confirma ou desiste.

**Símbolos, não emojis.** Emojis mudam de desenho e de cor conforme o aparelho e não combinam com um sistema institucional. Situações, carimbos e filtros usam um conjunto único de ícones em SVG, desenhados no mesmo estilo e coloridos pelas variáveis de cor dos temas claro e escuro.

### 16.3 Papéis e visibilidade

- **Login institucional** (Identificação Única) quando houver o servidor da UFCI-MG. Todo usuário institucional pode criar espaços e é administrador dos espaços que cria.
- **Papéis por espaço:** Administrador do espaço, Usuário do espaço, Leitor. Sem papel no espaço, a pessoa vê o espaço só se a visibilidade permitir.
- **Responsáveis sem login** continuam existindo: pessoa, equipe ou unidade.
- **Administrador do Sistema:** sem passe livre. Acessa as telas de administração e, nos espaços, tem os mesmos papéis de qualquer usuário. Única exceção: nomear um novo administrador para um espaço órfão, com registro de quem fez e quando.
- **Gestor da Estratégia:** mantém o catálogo do PEI/PDI.
- **Todo espaço tem pelo menos um administrador.** O último não pode ser removido.
- **Encerrar e reabrir** (decisão de 20/10/2026, no lugar de "arquivar"): disponível para os administradores do espaço. "Encerrar" diz o que aconteceu com o espaço, que terminou; é o que justifica as exigências sobre as entregas (seção 16.7). Um espaço encerrado fica só para leitura, sai da lista principal e continua acessível. Encerrar é diferente de excluir.
- **Visibilidade, escolhida pelo administrador:** Público (qualquer pessoa com o link, sem login), Institucional (qualquer usuário com login) ou Restrito (só quem tem papel no espaço).
- **Espaço aberto ou fechado,** chave do administrador. Aberto: usuários do espaço atualizam todas as ações. Fechado: cada um atualiza só as ações em que é responsável. Atualizar inclui estimar, reestimar, alterar o escopo, concluir e escrever notas. Criar e excluir ações e configurar o espaço são exclusivos dos administradores.

### 16.4 Histórico de alterações

Toda alteração de uma ação é registrada, **por qualquer pessoa, inclusive administradores**: quem, quando, campo, valor antigo e valor novo. O histórico aparece na janela da ação.

Ninguém altera nem apaga o histórico, nem o Administrador do Sistema. O registro é gravado junto com a alteração, de forma que um não exista sem o outro. Fica numa coleção (ou tabela) própria, só de acréscimo, e não dentro da ação. Serve à transparência, à auditoria e às cargas para o Data Lakehouse.

### 16.5 Checklist e comentários

- **Checklist:** lista simples de itens dentro da ação, como no Planner. Não ocupa espaço até alguém tocar em "Adicionar checklist". O cartão mostra o progresso, como "2/5".
- **Comentários:** espaço de conversa na ação, com autor e data. Aparece sempre que o espaço tem mais de um usuário com login (um administrador e um único responsável já formam duas pessoas).
  - **Histórico próprio:** cada edição de um comentário guarda a versão anterior; a tela mostra a última, com a indicação "editado".
  - **Apagar é só esconder:** o autor do comentário ou o administrador do espaço pode "apagar", e o comentário some da tela de todos os usuários. Mas ele **nunca é apagado do banco**, com todas as versões: uma eventual injúria, calúnia ou difamação precisa poder ser recuperada pelas autoridades competentes, por pedido formal à equipe de TI, fora do sistema. No lugar, a conversa mostra "Comentário apagado pelo autor" ou "Comentário apagado pelo administrador do espaço", com a data, para ninguém esconder nada em silêncio.
  - **Fora dos retratos:** os comentários já são o próprio histórico, por isso não são copiados nos retratos.

### 16.6 Relatórios e extração de dados

- **No sistema, "Extração personalizada":** escolher os espaços, os campos (com os nomes do dicionário de dados) e os filtros, e exportar em Excel (.xlsx), LibreOffice (.ods), CSV com ponto e vírgula, ou PDF pela impressão do navegador. Inclui exportar um espaço com o histórico de alterações.
- **No Data Lakehouse, não no sistema:** painéis entre espaços (por programa, objetivo ou unidade) e análises livres, com ferramentas próprias de painel (por exemplo, Superset ou Metabase), alimentadas por ETL com Apache Spark ou Apache Hop a partir do PostgreSQL. Construir um "Power BI interno" no sistema foi descartado: seria um produto à parte.

### 16.7 Entregas dos Planos de Ação

Pedido do responsável em 19/10/2026; detalhado em 20/10/2026.

- **Cadastro obrigatório:** todo Plano de Ação (tipo 1, seção 16.1) precisa ter as **entregas** que se quer alcançar. O espaço pode ser criado sem entregas, como rascunho, com o aviso fixo "sem entregas cadastradas"; o vínculo ao Programa só se conclui depois de haver pelo menos uma entrega. Assim, ninguém precisa cadastrar uma entrega de mentira só para criar o espaço (decisão de 20/10/2026).
- **Só um sentido para "entrega":** as entregas são resultados do Plano de Ação como um todo, os que importam para o PEI/PDI. O antigo campo `entrega` da ação foi retirado (seção 4.2), para não haver dois sentidos para a mesma palavra. Produtos intermediários continuam descritos nas próprias ações.
- **Tipo de meta, como no Programa de Gestão e Desempenho (PGD) da instituição:**
  - **Percentual:** taxas e proporções. Exemplo: "95% dos pedidos atendidos em até 24 horas".
  - **Quantitativa:** número absoluto. Exemplo: "10 Procedimentos-Padrão publicados".
  - **Entrega padrão:** sim ou não. Exemplo: "Relatório de Gestão 2025 homologado até 30/04/2026".
- **Alcance parcial, sem cortes arbitrários:** nas metas percentuais e quantitativas, o alcance é contínuo: valor alcançado comparado à meta (por exemplo, 150 de 200, ou 75%), mostrado como barra (princípio dos números contínuos, seção 2). Quem precisa medir o parcial escolhe meta percentual ou quantitativa ao planejar.
- **Situação da entrega: uma lista única**, válida a qualquer momento do espaço, sem uma fase separada de encerramento (KISS; decisão de 20/10/2026):

  | Situação | Algo foi feito? | O que se obteve | A busca da entrega… | Evidência | Justificativa |
  |---|---|---|---|---|---|
  | **Não iniciada** | não | nada | continua, ou o espaço foi encerrado | não | só ao encerrar o espaço |
  | **Em andamento** | sim | nada ou parte | continua | só ao encerrar o espaço | não |
  | **Alcançada** | sim | tudo | terminou | sim | não |
  | **Parcialmente alcançada** | sim | parte | terminou | sim | sim |
  | **Não alcançada** | sim | nada | terminou | não | sim |
  | **Cancelada** | qualquer | qualquer | foi interrompida por decisão, por exemplo por mudança de estratégia | não | sim |

  A tabela serve também de **tabela de decisão** para a Ajuda e o manual: respondendo às três perguntas (algo foi feito? o que se obteve? a busca continua?), chega-se a uma única situação. Uma entrega cancelada continua visível e não conta como não alcançada. "Nada feito" é sempre "Não iniciada", inclusive no encerramento; "Não alcançada" pressupõe que algo foi feito.

  "Em andamento" e "Parcialmente alcançada" podem ter o mesmo avanço; a diferença é se a busca continua. Uma entrega "Em andamento" no fim do espaço é a porta para continuá-la no espaço seguinte (caminho A, abaixo).
- **Encerrar o espaço** exige completar o registro das entregas que ficaram pelo caminho: justificativa para cada uma "Não iniciada" (nesse momento, elas se igualam às não alcançadas e às canceladas) e evidência para cada uma "Em andamento". Durante a execução, "Em andamento" não exige evidência, para não travar o trabalho nem estimular evidências de faz de conta (decisão de 20/10/2026).
- **Metas numéricas:** a situação também é escolhida pelo administrador; o valor alcançado aparece ao lado, como barra. Se os dois não combinarem (por exemplo, "Alcançada" com valor abaixo da meta), o sistema avisa antes de gravar.
- **Entregas que atravessam espaços (caminho A, decisão de 20/10/2026):** a entrega pertence a um espaço, que responde pelo seu período. Ao criar o espaço seguinte, é possível "continuar" uma entrega do anterior: ela é trazida para o novo espaço com uma ligação "continua a entrega X". A cadeia de ligações mostra a trajetória completa ao painel do Programa e ao Data Lakehouse. Foi descartado o caminho B (entrega independente, ligada a vários espaços), pela dificuldade de definir quem a administra, onde se registra o alcance e como conciliar visibilidades diferentes.
- **Registro do alcance:** feito pelo administrador do espaço, numa tela própria. Cada registro tem data, valor alcançado (ou sim/não), descrição e **pelo menos uma evidência**. Os registros se acumulam como histórico (um registro novo não apaga o anterior); o mais recente é o alcance atual.
- **Evidência:** descrição obrigatória e, pelo menos, um entre link ou arquivo. O envio de arquivo, o ideal, vem com o servidor da UFCI-MG (passo 4.3); até lá, link e identificação no SIPAC/Protocolo.
- **Quem registrou × quem realizou:** quem registrou é o usuário logado, gravado automaticamente. Quem realizou é uma lista livre de responsáveis (pessoas, equipes ou unidades, seção 4.5), sem limite de tamanho.
- **Sem validação por terceiros:** o registro é uma declaração do administrador do espaço. A confiabilidade vem da evidência, aberta a quem quiser conferir, e do histórico, que ninguém altera nem apaga (seção 16.4).
- **Ligação com as ações:** opcional e discreta. Na janela da ação, um campo "Entrega do Plano de Ação", escondido sob "Mais opções", como os atributos avançados dos cartões do Trello.
- **Estrutura:** duas entidades novas, **Entrega** e **Registro de alcance**, que entram no dicionário de dados (seção 4), com tabela e teste, no passo 2.6. Esboço: Entrega (título, descrição, tipo de meta, meta, unidade, prazo, ordem, responsáveis, situação de cancelamento com justificativa, ligação "continua a entrega"); Registro de alcance (entrega, data, valor alcançado, descrição, evidências, quem realizou, registrado em, registrado por).

### 16.8 Campos opcionais previstos (decisão do responsável, 21/10/2026)

Os campos opcionais servem à **adesão** (o espaço começa simples) e à **sofisticação gradual** do uso. Todos são desligados por padrão, salvo indicação, e nenhum pode atrapalhar as demais funções. Como o banco aceita campos novos sem migração, entram quando forem construídos; aqui fica o desenho, para ninguém construir algo que o contrarie.

- **Etiquetas** (Fase 2). Catálogo **por espaço** (nome e cor da paleta), como no Trello e no Planner; cada equipe usa as suas. A ação guarda os ids das etiquetas (`etiquetas`), gravados item a item (seção 4.6); filtro por etiqueta. Previsto: campo `etiquetas` no espaço (lista de {`id`, `nome`, `cor`}) e na ação (lista de id).
- **Prioridade da equipe** (Fase 2). Sem níveis (P1 a P4, "urgente", "importante"), que sofrem inflação (tudo vira o mais alto) e envelhecem sem revisão; nem estrela, que destaca mas não ordena. Adota-se a **lista ordenada** (o Guia do Scrum fala em backlog ordenado; Linear, Jira e Notion priorizam pela posição): a equipe arrasta as ações na ordenação "Prioridade da equipe", revista a cada mudança de contexto. É separada da "Ordem do espaço" (estrutura de fases e etapas). Nos espaços com cálculo, convive com as prioridades calculadas (seção 7). A posição é guardada como uma chave de ordenação fracionária (campo previsto `posicaoPrioridade`, texto): mover uma ação grava só ela, sem regravar a lista, o que evita conflito entre duas pessoas reordenando ao mesmo tempo. A estrela fica como possibilidade futura, só se a prática pedir. Usos principais: Quadro de tarefas e projetos sem dependências.
- **Links e documentos da ação** (Fase 2): identificação no SIPAC/Protocolo e link, como nos documentos do espaço (4.1.2). Campo previsto `documentos` na ação.
- **Justificativa** (por quê) e **Local** (onde), do 5W2H (Fase 2): textos opcionais, pouco usados no geral. Campos previstos `justificativa` e `local`.
- **Recorrência** (Fase 3, Quadro de tarefas): tarefas que se repetem (por exemplo, relatório mensal), como no Todoist e no Planner.
- **Custos** (futuro, sem fase; para quando houver amadurecimento):
  - na ação, custo previsto (`custoPrevisto`) e uma lista de **lançamentos executados** (`custosExecutados`: data, valor, descrição e, opcionalmente, o número do empenho ou de outro documento), porque a execução acontece ao longo do tempo;
  - no espaço, o orçamento total (`orcamento`);
  - acompanhamento: curva prevista (o custo de cada ação distribuído pelo seu prazo) contra a executada, em gráfico e tabela, no espírito do valor agregado da versão 1;
  - valores em centavos (inteiros), para evitar erros de arredondamento;
  - ligação futura com o orçamento institucional (ação orçamentária, natureza de despesa, fonte), quando essa integração for desenhada.
- **Registro de riscos do espaço** (futuro, sem fase): risco, probabilidade, impacto e resposta, como no PMBOK e na gestão de riscos cobrada pelo TCU.
- **Continuam fora, de propósito:** percentual concluído, data de início real e horas de esforço (seções 4.2 e 5.1): geram trabalho de registro sem melhorar as previsões.

---

## 17. Histórico de versões da página

As linhas até a 120 são da documentação da versão 1, em que a versão 2 era registrada como "Versão 2: …"; "versão atual", nelas, quer dizer a versão 1.

| Versão | Mudança |
|---|---|
| 1 | Primeira versão: CPM, PERT, Monte Carlo, Gantt, linha de base, valor agregado, importação TSV e Mermaid, base compartilhada |
| 2 | Setas de dependência no Gantt |
| 3 | Paleta do Relatório de Gestão |
| 4–5 | Nome "Sistema de Gerenciamento de Planos de Ação" e identificação da UFCI-MG |
| 6 | Linguagem simples, termos técnicos em itálico e aba "Entenda os termos" |
| 7 | Legenda do índice de criticidade esclarecida; ações 100% exibidas como concluídas sem data de status |
| 8 | Índice de criticidade retirado do Gantt |
| 9 | SSI ("prioridade de atenção") como ordenação da aba Previsões |
| 10 | Campo "Depende de" com busca por código ou nome e bloqueio de dependência circular |
| 11 | Lista global de responsáveis (nome, sigla, setor) e campo "Responsáveis" com busca; responsáveis da PI² migrados do texto para a lista |
| 12 | Cadastro de responsáveis em lote |
| 13 | Botão Ajuda (manual ilustrado); rótulos do gráfico de previsões escalonados para não se sobrepor |
| 14 | Código da ação opcional: geração automática pelas palavras da ação ou sorteio |
| 15 | Botão "Sortear" retirado; restam código digitado ou gerado automaticamente |
| 16 | Aba Diagrama (rede PERT/CPM com etapas); limite de "quase sem folga" em Configurar; exportação Mermaid com etapas, Início/Fim e cores |
| 17 | Diagrama: novo traçado de setas (sem voltas e sem atravessar caixas) e blocos de etapa sem sobreposição |
| 18 | Diagrama: setas em leque a partir da origem e proibição de trechos compartilhados entre setas sem relação |
| 19 | Diagrama: roteamento por canais (portas distribuídas, trilhos exclusivos, alargamento de corredores, cantos arredondados) |
| 20 | Diagrama: setas longas pelas vagas do dagre ou por traçado alternativo com menos cruzamentos; ordem de trilhos e de portas otimizada |
| 21 | Campos Etapa, Ação (descrição) e Rótulo no cadastro e na tabela de ações; importação reconhece Etapa, Rótulo, Descrição, PRE e Principais responsáveis; exportação com etapa e rótulo; glossário com Rótulo e Etapa |
| 22 | Suporte ao Firebase (Firestore + login por e-mail e senha), `config.js`, `firestore.rules`; cópia de segurança e restauração de todos os dados; licença GPL v3 |
| 23 | Restauração da cópia de segurança disponível também na tela inicial de banco vazio (função `restoreBlock`) |
| 24 | Sistema publicado no GitHub Pages com Firebase; dados migrados do artefato do Claude por cópia e restauração (14/10/2026) |
| 24.1 | Novo logotipo (rosa dos ventos, `logo.png`, embutido no cabeçalho e usado como ícone da aba); paleta refeita a partir do logotipo: verde-azulado (destaque e ações com folga), vermelho (sem folga), dourado (quase sem folga), laranja (faixa e histograma); fundos neutros quentes; tema escuro equivalente; cores das etapas no diagrama e do Mermaid atualizadas |
| 24.2 | Arquivo `CLAUDE.md` com as regras de trabalho para sessões do Claude no repositório (uma mudança por vez, documentação a cada mudança, testes, publicação, cópia da documentação no claude.ai). Sem mudança no sistema |
| 24.3 | Documentação atualizada para a hospedagem atual (GitHub Pages + Firebase): situação, componentes, modos, limitações, permissões e pendências. Sem mudança no sistema |
| 24.4 | Pendência registrada: níveis de permissão, obrigatórios antes da fase de produção. Sem mudança no sistema |
| 24.5 | Regras de contribuição movidas para `AGENTS.md`, fonte única para qualquer pessoa ou IA; `CLAUDE.md` passa a importá-lo e guarda só a cópia da documentação no claude.ai; gatilho para proteger a `main` registrado. Sem mudança no sistema |
| 24.6 | `AGENTS.md`: descrição do sistema reescrita em linguagem simples, com o termo técnico entre parênteses. Sem mudança no sistema |
| 24.7 | Ideia futura registrada: previsão por classe de referência, contra a falácia do planejamento. Sem mudança no sistema |
| 24.8 | Especificação da reescrita (versão 2) registrada em `docs/especificacao-reescrita.md`, para revisão. Sem mudança no sistema |
| 24.9 | Especificação da reescrita: tipos de responsável, campos opcionais por plano, "Configurar o plano", cores contínuas por prioridade de execução e símbolos da planilha da PI². Sem mudança no sistema |
| 24.10 | Especificação da reescrita: linhas da aba Ações como cartões e detalhe em janela sobreposta, conforme avaliação do protótipo. Sem mudança no sistema |
| 24.11 | Especificação da reescrita: editor visual das notas, nova ação em janela central, seletores com busca, código opcional, edição no lugar, modo planilha e regra de liberação de ações criadas depois. Sem mudança no sistema |
| 24.12 | Especificação da reescrita: fases e etapas como separadores recolhíveis, linha do tempo no topo, animação dos filtros, campo "Não começa antes de" e seção de pontos para reavaliação. Sem mudança no sistema |
| 24.13 | Especificação da reescrita: linha do tempo fina, com as datas em legenda. Sem mudança no sistema |
| 24.14 | Especificação da reescrita: barra do aplicativo compacta com fundo próprio, datas sobre a linha do tempo, ferramentas da lista compactas. Sem mudança no sistema |
| 24.15 | Especificação da reescrita: linha do tempo movida para a aba Visualização. Sem mudança no sistema |
| 24.16 | Especificação da reescrita: ferramentas da aba Ações no celular (uma linha, painel "Filtros e ordem", botão flutuante de nova ação). Sem mudança no sistema |
| 24.17 | Especificação da reescrita: "Prioridade de revisão" passa a mostrar a contribuição para a variância do prazo, no lugar do SSI; fundamentos matemáticos de todos os indicadores por ação documentados (seção 15 da especificação). Sem mudança no sistema |
| 24.18 | Especificação da reescrita: barra da "Prioridade de revisão" em escala fixa de 0% a 100%. Sem mudança no sistema |
| 24.19 | Especificação da reescrita: modo Quadro (Kanban) na aba Ações, com colunas Aguardando, Liberadas e Concluídas. Sem mudança no sistema |
| 24.20 | Especificação da reescrita: efeito vítreo na barra superior ao rolar. Sem mudança no sistema |
| 24.21 | Especificação da reescrita: campo "Não começa antes de" escondido quando vazio, com link para defini-lo. Sem mudança no sistema |
| 24.22 | Especificação da reescrita: barra superior vítrea e neutra; sem logotipo no celular na vertical. Sem mudança no sistema |
| 24.23 | Especificação da reescrita: barra superior escura no topo da página e vidro transparente ao rolar. Sem mudança no sistema |
| 24.24 | Especificação da reescrita: escurecimento leve da barra no topo da página. Sem mudança no sistema |
| 24.25 | Especificação da reescrita: volta da barra ao estado do topo quase instantânea. Sem mudança no sistema |
| 24.26 | Especificação da reescrita: transição da barra simétrica (substitui a volta rápida da 24.25, que ficou desigual). Sem mudança no sistema |
| 25 | Especificação da reescrita: Ajuda e manual saem da barra e passam para o menu do usuário; sem login, o menu traz Ajuda e Entrar. Sem mudança no sistema |
| 26 | Especificação da reescrita: seletor de plano e "Configurar o plano" fundidos num menu do plano, com "Novo plano"; a engrenagem sai da barra. Sem mudança no sistema |
| 26.1 | Ideia futura registrada: aplicativo para celular (instalável pelo navegador e, se necessário, nas lojas), com acesso restrito à instituição pelo login. Sem mudança no sistema |
| 27 | Especificação da reescrita: regras de edição simultânea (seção 4.6), que fecham três falhas da versão 1: listas regravadas inteiras, código de ação nova conferido só na tela e sobrescrita silenciosa. Sem mudança no sistema |
| 28 | Especificação da reescrita: preparação para a troca de banco (seção 3.4): `Store` com operações do sistema, um arquivo por banco em `js/banco/`, testes como contrato e cópia de segurança como ponte; seção 4.6 sem termos do Firestore. Sem mudança no sistema |
| 29 | Regra do dicionário de dados: toda mudança na estrutura do banco é registrada na seção 5 (e, na versão 2, na seção 4 da especificação) no mesmo commit; teste automático do dicionário previsto para a versão 2. Sem mudança no sistema |
| 30 | Especificação da reescrita: exclusão lógica de planos, ações e responsáveis (seção 4.7), com lixeira e teste automático. Sem mudança no sistema |
| 31 | Especificação da reescrita: semente e simulações imutáveis e visíveis, com versão do cálculo; retratos manuais e automáticos. Sem mudança no sistema |
| 32 | Especificação da reescrita: seção 16, ampliação do escopo em discussão (tipos de plano, situações personalizadas, papéis e visibilidade, arquivamento, histórico de alterações, checklist, comentários, relatórios). Sem mudança no sistema |
| 32.1 | Especificação da reescrita, seção 16: "Não liberada" no lugar de "Aguardando", aviso ao criar dependência numa ação liberada, ícones SVG no lugar de emojis, regra dos comentários. Sem mudança no sistema |
| 33 | Especificação da reescrita: ordem de trabalho em fases e passos (seção 12, em aprovação), construção passo a passo na pasta `/v2/` (seção 3.3), documentos com identificação no SIPAC/Protocolo, "Não liberada" e ícones em todas as seções, extração personalizada e volta à situação inicial. Sem mudança no sistema |
| 33.1 | Especificação da reescrita: segundo projeto Firebase para a versão 2, abertura do sistema pelo último plano, exclusão encadeada com janela de alternativas, troca simplificada, nome candidato "Dira". Sem mudança no sistema |
| 34 | Especificação da reescrita: nome provisório "Sextante" para a versão 2, como variável única no código. Sem mudança no sistema |
| 35 | Versão 2, passo 0.1: pasta `v2/` publicada com página provisória; AGENTS.md ajustado (regra 9, um passo por vez; arquivos separados só em `v2/`); ordem de trabalho aprovada. Sem mudança na versão atual |
| 36 | Versão 2, passo 0.2: estrutura de arquivos em `v2/` (identidade, Store, banco em memória), 16 testes automáticos com `node --test`, contrato dos bancos; AGENTS.md com o comando de teste da versão 2. Sem mudança na versão atual |
| 37 | Versão 2, passo 0.3: dicionário de dados completo na seção 4 da especificação (convenções, diagrama das relações, tabelas com tipo e obrigatoriedade, valores calculados, mapeamento para Firebase e PostgreSQL, entidades previstas); `v2/js/modelo.js`; Store recusa campos fora do dicionário; teste do dicionário (31 testes no total). Sem mudança na versão atual |
| 38 | Especificação da reescrita: entregas obrigatórias nos planos formalizados e registro do alcance com evidência (seção 16.7, passo 2.6 da ordem de trabalho). Sem mudança no sistema |
| 39 | Especificação da reescrita: campo `entrega` da ação retirado (só as entregas do plano usam o termo); entregas com tipos de meta do PGD, alcance contínuo, histórico de registros, evidência obrigatória e sem validação por terceiros (seção 16.7). Versão 2: `v2/js/modelo.js` e dicionário sem o campo. Sem mudança na versão atual |
| 39.1 | Especificação da reescrita: entregas exigidas para concluir o vínculo ao Programa, e não para criar o plano (seção 16.7). Sem mudança no sistema |
| 40 | Especificação da reescrita e versão 2: retrato como cópia integral do plano (dicionário e `v2/js/modelo.js`); comentários com histórico e apagamento só da tela; entregas com situações Não iniciada, Em andamento, Alcançada e Cancelada, e continuidade entre planos (caminho A). Sem mudança na versão atual |
| 40.1 | Especificação da reescrita: situação da entrega numa lista única de seis valores, válida a qualquer momento; justificativa para "Não iniciada" ao arquivar o plano (seção 16.7). Sem mudança no sistema |
| 40.2 | Especificação da reescrita: "Em andamento" exige evidência só ao arquivar o plano; tabela de decisão das situações das entregas, a incluir na Ajuda e no manual (seção 16.7 e passo 1.22). Sem mudança no sistema |
| 41 | Especificação da reescrita: tabela única das situações das entregas, com "Algo foi feito?" e função de tabela de decisão; "encerrar e reabrir" no lugar de "arquivar"; tipos com nomes próprios (Plano de Ação, Projeto, Quadro de equipe), palavra geral em escolha. Sem mudança no sistema |
| 41.1 | Especificação da reescrita: palavra geral "Espaço de Planejamento" (seção 16.1). Sem mudança no sistema |
| 42 | Versão 2: "plano" (o conjunto) passa a se chamar "espaço" em todo o código (`espaco`, `criarEspaco`, coleção `espacos`), no dicionário de dados e em toda a especificação; "Plano de Ação" fica só para o tipo formalizado. Legendas de prioridade passam a falar em "conclusão". Sem mudança na versão atual |
| 43 | Versão 2, passo 0.4: espaço de exemplo fictício (`v2/js/exemplo.js`) e cópia da PI² para testes, lida só por leitura e conferida por SHA-256 (`v2/testes/dados/pi2-fase1.json`); 39 testes. Exemplos de Plano de Ação e de Quadro de equipe previstos nos passos 2.6 e 3.1. Sem mudança na versão atual |
| 44 | Versão 2, passo 0.5: base visual em `v2/css/estilo.css` (cores nos três blocos de tema, barra do topo com os dois estados e transição simétrica) e ícones em SVG em `v2/js/icones.js`; página provisória com a vitrine. Sem mudança na versão atual |
| 45 | Versão 2, passo 1.1: calendário de dias úteis (`v2/js/calendario.js`) e caminho crítico com "Não começa antes de" (`v2/js/calculo.js`); teste de comparação que executa o cálculo da versão atual e confirma as mesmas datas para as 29 ações da PI²; 55 testes. Sem mudança na versão atual |
| 46 | Versão 2, passo 1.2: situações, carimbo Atrasada, regra "nada termina no passado", ações concluídas com duração real e reestimativas contadas do dia em que foram feitas; 62 testes. Sem mudança na versão atual |
| 47 | Versão 2, passo 1.3: simulação de Monte Carlo com beta-PERT, prioridades de execução e de revisão, versão do cálculo (`v2/js/simulacao.js`); roteiro de reprodução por fora (seção 15.6 da especificação); referência da PI²: chance de 89,5% de cumprir o prazo (74% na versão atual, com a triangular); 73 testes. Sem mudança na versão atual |
| 47.1 | Especificação da reescrita: dois novos pontos para reavaliação (seção 14): a distribuição beta-PERT, que pode deixar a previsão otimista, e a hipótese de durações independentes entre ações. Sem mudança no sistema |
| 48 | Versão 2, passo 1.4: abertura do sistema (boas-vindas, criar espaço, ver exemplo, link de espaço, último espaço do aparelho) e resumo provisório calculado do espaço (`v2/js/telas/abertura.js`, `v2/js/telas/espaco.js`); a vitrine do passo 0.5 saiu. Sem mudança na versão atual |
| 49 | Versão 2, passo 1.5: barra do topo com menu do espaço (lista, configurar, novo espaço, boas-vindas) e menu do usuário (Ajuda e manual, Entrar), Ajuda em painel lateral com glossário e links "o que é?" (`v2/js/telas/topo.js`, `v2/js/telas/ajuda.js`, `v2/js/telas/painel.js`, `v2/js/glossario.js`). Sem mudança na versão atual |
| 49.1 | Versão 2: a barra do topo, parada no alto da página, passa a ter a cor do fundo, sem linha na base; ao rolar, continua o vidro com linha fina e sombra. Sem mudança na versão atual |
| 49.2 | Versão 2: o painel da Ajuda entra e sai deslizando pela direita, com o fundo escurecendo aos poucos (0,25 s); sem animação com "Reduzir movimento". Sem mudança na versão atual |
| 49.3 | Histórico de versões da página: a linha 26.1 voltou para depois da 26 (as linhas 27 a 49.2 tinham entrado antes dela). Sem mudança no sistema |
| 50 | Versão 2, passo 1.6: lista de ações com cartões, fases e etapas recolhíveis, filtros de situação e de responsável, ordenação, legenda e animações; no celular, painel "Filtros e ordem" e botão (+) (`v2/js/lista.js`, `v2/js/telas/espaco.js`, `v2/js/formato.js`). O resumo provisório do passo 1.4 virou uma linha acima da lista. Sem mudança na versão atual |
| 50.1 | Versão 2: sai o cabeçalho de tabela da lista de ações; a data e as barras ganham um rótulo pequeno no cartão, os links "o que é?" das prioridades vão para a legenda, e as ações concluídas deixam de mostrar barras. Sem mudança na versão atual |
| 50.2 | Versão 2: o resumo de cada fase e etapa (ações, concluídas, atrasadas, término e barra de progresso) só aparece com o grupo recolhido. Sem mudança na versão atual |
| 50.3 | Versão 2: no celular, a fase ou etapa recolhida mostra só a barrinha de progresso e, se houver atraso, o relógio vermelho; no computador, as atrasadas do resumo passam a ser escritas por extenso. Sem mudança na versão atual |
| 51 | Versão 2: responsáveis no cartão como no GitHub, pessoa num círculo com as iniciais e um tom tirado do nome, unidade num quadrado com a sigla, pessoas antes das unidades e "+N" acima de três pessoas (`v2/js/responsaveis.js`). Dicionário de dados da versão 2 (especificação, seção 4.5): novo campo `tipo` do responsável, `pessoa` ou `unidade`, obrigatório; só pessoa pode ter login. Sem mudança na versão atual |
| 52 | Versão 2: cada pessoa tem um tom só seu dentro do espaço, de uma paleta de 15, guardado no novo campo `tons` do espaço (dicionário, seção 4.1 da especificação) e mantido pelo sistema: menor tom livre para quem chega, tom liberado quando a pessoa deixa de ser responsável, repetição só acima de 15 pessoas (`ajustarTons` em `v2/js/responsaveis.js`, chamado pelo `Store` ao gravar responsáveis de uma ação). Sem mudança na versão atual |
| 53 | Versão 2, passo 1.7: janela da ação com edição no lugar, dependências e responsáveis item a item com busca (sem ciclos), reestimativa, registro e desfazer da conclusão e histórico de estimativas (`v2/js/telas/janela-acao.js`, `v2/js/acao.js`, `v2/js/telas/pessoas.js`). Novas operações no `Store` e no banco, com testes de contrato de gravações simultâneas; corrigida no banco em memória uma leitura e gravação em dois tempos. A tela do espaço passou a acompanhar o banco e a recalcular a cada gravação. Sem mudança na versão atual |
| 53.1 | Versão 2: os três pontos das estimativas passam a ser dias úteis inteiros (o `Store` recusa fração; dicionário de dados atualizado; na migração, frações arredondadas para cima). Sem mudança na versão atual |
| 54 | Versão 2, passo 1.8: notas das ações com editor visual (negrito, itálico, link e lista, com atalhos) guardadas em Markdown seguro, por um conversor próprio com testes de segurança (`v2/js/notas.js`). Sem mudança na versão atual |
| 55 | Versão 2, passo 1.9: nova ação numa janela central, com código opcional sugerido a partir do rótulo e aviso enquanto se digita, dependências e responsáveis com busca e "Não começa antes de" com a data de hoje (`v2/js/telas/nova-acao.js`, `v2/js/telas/seletor.js`). Sem mudança na versão atual |
| 56 | Versão 2: as ações passam a ser identificadas por um número fixo em sequência (`numero`, reservado pelo banco num contador do espaço, `proximoNumero`), invisível no uso normal; o código mnemônico (`codigo`) vira opcional, ligado pelo novo campo opcional `codigos` do espaço (desligado por padrão), e pode ser alterado. Dependências passam a guardar números e aparecem pelo nome. Dicionário de dados, mapeamento para Firebase e PostgreSQL e migração atualizados (especificação, seções 4.1, 4.2, 4.6, 4.9 e 11). Sem mudança na versão atual |
| 57 | Versão 2, passo 1.10: modo Quadro, com colunas Não liberadas, Liberadas e Concluídas, arrastar para concluir ou desfazer a conclusão no computador e colunas deslizantes no celular (`v2/js/telas/espaco.js`). Sem mudança na versão atual |
| 58 | Versão 2, passo 1.11: modo "Editar em planilha", no computador, com gravação por célula, Enter para descer, colagem de blocos (criando ações novas) e células bloqueadas com o motivo (`v2/js/telas/editar-planilha.js`, `v2/js/planilha.js`). Sem mudança na versão atual |
| 59 | Versão 2, passo 1.12: abas do espaço (Ações e Responsáveis) e aba Responsáveis, com busca, cadastro e edição de pessoas e unidades e o e-mail de login (validado e único), que fará funcionar "Minhas ações"; ao corrigir o tipo de um responsável, os tons são refeitos em todos os espaços (`v2/js/telas/responsaveis.js`). Sem mudança na versão atual |
| 59.1 | Versão 2: o tipo do responsável (pessoa ou unidade) passa a ser fixo depois do cadastro; a correção será por exclusão com "substituir por" (passo 1.15). Especificação: registrados os quatro tipos de responsável previstos para a Fase 4 (pessoa da IU, pessoa etiqueta, unidade oficial, grupo criado no sistema) e os campos `origem` e `identificadorInstitucional`. Sem mudança na versão atual |
| 60 | Versão 2, passo 1.13: "Configurar este espaço", com dados e datas, datas excluídas, fases e etapas, campos opcionais (inclusive os códigos), documentos e a simulação visível e fixa; validação do espaço inteiro no `Store` (`v2/js/telas/configurar.js`). Sem mudança na versão atual |
| 61 | Versão 2: calendário em dois níveis. Calendário geral em "Configurar o sistema" (menu do usuário), com sugestão dos feriados nacionais de um ano para revisão; datas próprias do espaço e opção de desconsiderar datas gerais em "Configurar o espaço". Dicionário: nova entidade `calendarioGeral` e campos `datasGeraisDesconsideradas` (espaço) e `datasExcluidasEfetivas` (retrato). Especificação: "Quadro de equipe" passa a "Quadro de tarefas" (também individual); ação e tarefa são a mesma coisa, com nomes diferentes por tipo de espaço; formas de prazo (estimativa em dias úteis ou data-limite opcional) previstas para a Fase 2 (`v2/js/feriados.js`, `v2/js/telas/configurar-sistema.js`). Sem mudança na versão atual |
| 61.1 | Versão 2: a sugestão do calendário geral segue a lista anual típica do MGI (inclusive Quarta-feira de Cinzas, Dia do Servidor Público, vésperas de Natal e de Ano Novo, como dias inteiros) e acrescenta as pontes prováveis marcadas com ⚠️ para conferência; nas listas de datas e documentos, o que não foi salvo fica destacado, com o aviso "Alterações não salvas" (`v2/js/telas/pendencias.js`). Sem mudança na versão atual |
| 61.2 | Especificação da reescrita: campos opcionais previstos (seção 16.8): etiquetas por espaço, prioridade da equipe como lista ordenada (sem níveis), links da ação, justificativa e local (Fase 2); recorrência (Fase 3); custos com orçamento e curvas e registro de riscos (futuro). Sem mudança no sistema |
| 62 | Versão 2, passo 1.14: espaços gravados no projeto próprio do Firebase ("sextante-v2"; `v2/config.js`), com o exemplo sempre em memória; banco do Firestore (`v2/js/banco/firestore.js`) testado com os mesmos testes de contrato, sobre um Firebase falso em memória (`v2/testes/firebase-falso.js`); regras provisórias em `v2/firestore.rules` (consulta livre, gravação com login, nada se apaga); login, "Esqueci a senha", troca de senha e saída; sem login, gravações recusadas com aviso; aviso "Fulano alterou esta ação agora" na janela da ação. Sem mudança na versão atual |
| 63 | Versão 2, passo 1.14a: criação rápida de ações. Espaço vazio com as ferramentas e a planilha; linha "+ Adicionar ação" no fim de cada etapa, da lista e da coluna Liberadas do quadro; janela "Nova ação" compacta (rótulo e três pontos à vista, demais campos recolhidos, Enter cria e continua); ação sem estimativa com a marca "Falta estimar", sem carimbo Atrasada, e aviso de previsão incompleta (`v2/js/telas/nova-acao.js`, `v2/js/telas/espaco.js`). Sem mudança na versão atual |
| 63.1 | Versão 2: a ação sem estimativa não mostra as prioridades de execução e de revisão (calculadas com duração zero), na lista, no quadro e na janela; a faixa de cor fica neutra. Sem mudança na versão atual |
| 63.2 | Versão 2, correção: ao acrescentar uma dependência ou um responsável, o banco do Firestore copiava a operação de lista (`arrayUnion`/`arrayRemove`) antes de gravar, e a cópia era gravada como um objeto no lugar da lista, o que travava a tela do espaço. O banco deixou de copiar nas alterações, e o Firebase falso dos testes passou a imitar o SDK nesse ponto (a operação é um objeto de classe própria), de modo que o teste de contrato agora acusa essa falha. Sem mudança na versão atual |
| 63.3 | Versão 2, correção: um responsável recém-cadastrado podia fazer outros sumirem da tela até recarregar a página (os dados no banco ficavam corretos). Os ouvintes dos responsáveis e do calendário geral passaram a ficar ligados enquanto a página está aberta, a lista guardada só é aceita quando confirmada pelo servidor, e uma falha do ouvinte faz as leituras irem direto ao banco, com registro no console. Sem mudança na versão atual |
| 64 | Versão 2: princípio "Movimento com sentido" (especificação, seção 2; AGENTS.md): transições curtas e padronizadas (`--mov`, `--mov-rapido`, `--mov-curva`; `v2/js/telas/movimento.js`) em tudo que aparece ou some, respeitando "Reduzir movimento". Na aba Responsáveis, o tipo virou um alternador com a marca deslizante, e os formulários de cadastro e de edição abrem e fecham com animação, assim como o campo de e-mail ao voltar para "Pessoa". Sem mudança na versão atual |
| 64.1 | Versão 2, movimento padrão aplicado a mais telas: na janela "Nova ação", os campos abertos pelos botões crescem; na janela da ação, "Reestimar" e "Registrar conclusão" abrem e fecham deslizando, e os editores no lugar surgem suavemente; em "Configurar este espaço" e "Configurar o sistema", as seções abrem e fecham deslizando (`surgir` e `ligarSecoesSuaves`, em `v2/js/telas/movimento.js`). Sem mudança na versão atual |
| 64.2 | Versão 2, correção do movimento: dentro de janelas e painéis com rolagem, o bloco que abria ou fechava era espremido até a altura mínima e só aparecia inteiro no fim, o que dava a impressão de animação truncada (por exemplo, em "Reestimar"). O bloco animado deixou de encolher (`flexShrink: 0`), e a curva padrão ficou mais suave no começo (`cubic-bezier(.2, 0, 0, 1)`). Sem mudança na versão atual |
| 64.3 | Versão 2: na janela da ação, os botões "Reestimar" e "Registrar conclusão" encolhem enquanto o formulário cresce no lugar deles, e o contrário ao cancelar (`trocarSuave`). Abrir e fechar passaram a levar também as folgas, as bordas e o espaço entre itens, para não sobrar salto no fim do movimento. Sem mudança na versão atual |
| 64.4 | Versão 2: ao salvar uma reestimativa ou uma conclusão, o formulário também encolhe no lugar enquanto os botões (ou "Desfazer conclusão") voltam a crescer, em vez de sumir de uma vez quando a janela se atualiza com o dado gravado. Sem mudança na versão atual |
| 65 | Versão 2: seletor de modo sempre à esquerda das ferramentas, com ícones em SVG (lista, quadro, planilha); o modo ativo mostra também o nome, e os demais o mostram ao passar o mouse; no celular, só Lista e Quadro. Especificação revista: a aba Visualização sai; cronograma, rede e linha do tempo viram modos interativos do seletor (passo 1.17 dividido em 1.17a, 1.17b e 1.17c); calendário registrado como "a avaliar". Sem mudança na versão atual |
| 66 | Versão 2: o alto do espaço deixa de mostrar datas e a chance de cumprir o prazo (irão para a linha do tempo e o cronograma); o aviso "Previsão incompleta" fica sempre à vista. Especificação: responsáveis criados no sistema passam a ser de cada espaço (passo 1.14b), menu lateral (1.14c), cadastro provisório de logins (1.14d), linha do tempo com a chance e o gráfico da data final, e a integração com os cadastros da instituição como decisão pendente. Sem mudança na versão atual |
| 67 | Versão 2, passo 1.14b: responsáveis de cada espaço. Banco: `espacos/{id}/responsaveis/{id}` (dicionário, seções 4.5 e 4.9 da especificação); `Store` com o espaço nas operações de responsáveis; e-mail de login único dentro do espaço. Tela: seção "Responsáveis" em "Configurar este espaço"; fim das abas do espaço. Regras do Firestore novas (`v2/firestore.rules`), a publicar no console. Sem mudança na versão atual |
| 67.1 | Versão 2: responsáveis antigos copiados para o espaço em uso; a coleção geral `responsaveis` foi excluída no console e saiu das regras do Firestore. Sem mudança na versão atual |
| 68 | Versão 2, passo 1.14c: menu lateral (conta, espaços com engrenagem de configuração, novo espaço, Ajuda e Configurar o sistema), recolhível no computador e por cima no celular (`v2/js/telas/navegacao.js`, no lugar de `topo.js`); barra do topo só com o botão do menu e o nome do espaço; logotipo, nome do sistema e sigla da instituição saem da tela de trabalho (ficam nas boas-vindas, na Ajuda e no ícone da aba). Sem mudança na versão atual |
| 68.1 | Versão 2: a aba do navegador mostra só o nome do sistema; saiu o aviso "Em construção"; no menu lateral, o espaço aberto deixa de parecer clicável (clicar nele não fazia nada). Sem mudança na versão atual |
| 68.2 | Versão 2: fonte dos títulos trocada de Barlow Semi Condensed para Manrope (Google Fonts), escolhida pelo responsável entre seis amostras. Sem mudança na versão atual |
| 68.3 | Especificação da reescrita: no passo 2.4, o menu lateral agrupa os espaços por tipo, com o nome do tipo no plural. Sem mudança no sistema |
| 68.4 | Versão 2: a barra do topo encosta no menu lateral, sem o vão que aparecia ao rolar; "Novo espaço" mostra só o formulário "Novo espaço de planejamento", sem o quadro de boas-vindas, e "Cancelar" volta ao espaço que estava aberto. Sem mudança na versão atual |
| 69 | Versão 2: ferramentas da lista na barra do topo, à direita: seletor de modo, Filtrar e Ordenar (painéis pequenos sob o botão) e Nova ação; aviso fixo de ações atrasadas, que filtra ao ser tocado; Legenda no pé do menu lateral; no celular, um funil abre "Filtros e ordem", agora também com a situação. Sem mudança na versão atual |
| 70 | Versão 2, passo 1.15: exclusão lógica e lixeira. Ações, responsáveis e espaços vão para a lixeira com autor e data, e podem ser restaurados; fases e etapas com ações saem movendo as ações para outra etapa ou deixando-as sem etapa. Exclusão simples com "Desfazer"; exclusão com consequências pergunta antes (ligar dependentes às anteriores; substituir responsável). Lixeira no menu lateral. Sem mudança na versão atual |
| 70.1 | Especificação da reescrita: execução em lote dos passos 1.16 a 1.19, com etiqueta por passo no GitHub e diário em `docs/registro-de-execucao.md` (novo). Sem mudança no sistema |
| 71 | Versão 2, passo 1.17a (primeira versão, em lote): modo "Linha do tempo" no computador, com a conclusão prevista, a data segura, a chance de cumprir o prazo final, as barras da parte dos cenários que termina em cada semana, a curva da chance acumulada e a chance em qualquer data ao passar o mouse. Termo novo no glossário: "Chance de cumprir o prazo". Sem mudança na versão atual |
| 72 | Versão 2, passo 1.17b (primeira versão, em lote): modo "Cronograma" no computador, com as barras das ações agrupadas por fase e etapa, setas das dependências, ações sem folga em vermelho, hoje e prazo final, aproximação em semanas ou meses, detalhes ao passar o mouse e abertura da ação ao clicar. Termos novos no glossário: "Folga e caminho crítico" e "Cronograma". Sem a comparação com retrato, que depende do passo 1.18. Sem mudança na versão atual |
| 73 | Versão 2, passo 1.17c (primeira versão, em lote): modo "Rede" (fluxo das ações) no computador, com as ações em cartões arrumados em colunas, na ordem em que podem acontecer, setas das dependências (vermelhas no caminho crítico), destaque de tudo o que vem antes e depois da ação apontada, abertura da ação ao clicar e "Ver tudo". Arrumação própria, sem biblioteca: colunas pela anterior mais distante e ordem que reduz cruzamentos. Termo novo no glossário: "Rede (fluxo das ações)". Sem mudança na versão atual |
| 74 | Versão 2, passo 1.19a (primeira versão, em lote): exportação de um espaço para planilha (texto com tabulações, com as datas previstas, a folga e a situação) e em fluxograma Mermaid (fases e etapas como grupos, ações sem folga destacadas), em "Configurar este espaço"; cópia de segurança de todos os espaços, inclusive a lixeira, em arquivo JSON de formato próprio, em "Configurar o sistema". Só leitura. A importação e a restauração ficam no passo 1.19b. Sem mudança na versão atual |
| 75 | Versão 2, passo 1.16 (primeira versão, em lote): histórico de alterações das ações. Cada alteração grava, na mesma operação, um registro por campo que mudou (quem, quando, valor antigo e novo), em coleção própria e só de acréscimo; na janela da ação, "Histórico de alterações" em frases simples. No Firebase, toda mudança de ação passa a ser feita por transação. Regras do banco novas (`v2/firestore.rules`), a publicar no console antes de juntar à `main`. Cópia de segurança no formato versão 2, com o histórico. Sem mudança na versão atual |
| 76 | Versão 2, passo 1.18 (primeira versão, em lote): retratos manuais. Em "Configurar este espaço", salvar um retrato com nome e ver a lista, com a conclusão prevista, a data segura e a chance de cada um. O retrato é a cópia integral do espaço, com as ações e os resultados calculados, e não muda depois. No cronograma, "Comparar com" um retrato: linha fina sob cada barra e a diferença no término. Regras do banco novas (`v2/firestore.rules`). A cópia de segurança passa a levar os retratos. Sem mudança na versão atual |
| 76.1 | Versão 2: no "Histórico de estimativas" da janela da ação, a data, o autor e o selo "vigente" voltam a ficar na mesma linha (antes, cada um numa linha). Sem mudança na versão atual |
| 77 | Versão 2: aviso de falta de conexão (decisão do responsável, 22/10/2026). Sem internet, aparece na barra do topo, visível em qualquer ponto da página, o aviso "Sem conexão. As alterações não serão gravadas até a internet voltar."; os botões de criar, salvar retrato e excluir somem, e qualquer tentativa de gravar recebe uma mensagem clara. Quando a conexão volta, o aviso some e aparece "Conexão restabelecida". O espaço de exemplo, que fica na memória, continua editável. Detecção pelo navegador (`navigator.onLine`): uma rede sem saída para a internet não é percebida. Sem mudança na versão atual |
| 78 | Versão 2: o modo celular (botão (+), seletor de modos escondido, painéis que sobem de baixo) passa a valer só até 640 px de largura, e não mais até 820 px; janelas médias de computador ficam no modo computador. Os cartões da lista passam a ficar em duas linhas pela largura da própria lista (consulta de contêiner, até 820 px), e não da janela: com o menu lateral aberto numa janela média, a lista também se arruma. Sem mudança na versão atual |
| 79 | Versão 2: o aviso "Sem conexão" passa a perceber também a rede ligada sem internet, a falha mais comum (pedido do responsável, 22/10/2026). O sistema sonda o próprio site a cada 10 segundos, com um pedido pequeno e sem cache (`js/conexao.js`); duas sondas seguidas sem resposta declaram a queda (em até uns 15 segundos), e, sem conexão, sonda a cada 5 segundos para perceber a volta. Sem rede no aparelho, o aviso continua imediato. Sem mudança na versão atual |
| 79.1 | Especificação da reescrita: as decisões provisórias da execução em lote passam para a seção 14.1 ("Pontos para reavaliação"), com as já aprovadas pelo responsável; o diário técnico aponta para lá. Sem mudança no sistema |
| 79.2 | Especificação da reescrita, seção 14.1: aprovadas pelo responsável as quatro decisões provisórias da linha do tempo (passo 1.17a). Sem mudança no sistema |
| 80 | Versão 2, passo 1.19b: importar de planilha, em "Configurar este espaço", com a escolha entre só criar ações novas ou também atualizar as existentes e a conferência linha a linha antes de gravar; restaurar uma cópia de segurança, em "Configurar o sistema" e pelas boas-vindas, só num banco vazio. A importação por Mermaid foi cancelada pelo responsável. Sem mudança na versão atual |
| 80.1 | Versão 2, importação por planilha: a conferência passa a avisar, antes de gravar, também a dependência que criaria um ciclo, o código inválido ou já usado e o nome repetido na planilha (antes, os dois primeiros só apareciam como falha na gravação). Sem mudança na versão atual |
| 81 | Versão 2, passo 1.14d, com a importação de responsáveis: em "Configurar este espaço" > Responsáveis > "Importar de planilha", cadastro de responsáveis em lote, com a conferência antes de gravar; quem tem e-mail é pessoa e ganha a conta de acesso, criada sem tirar da sessão quem está cadastrando, com um e-mail do Firebase para a pessoa definir a própria senha. Sem e-mail, o tipo precisa vir na planilha. Provisório até os papéis: qualquer pessoa com login cria contas. Sem mudança na versão atual |
| 81.1 | Versão 2, importação de ações por planilha: "Depende de" passa a reconhecer os códigos das próprias linhas da planilha, mesmo com "Códigos das ações" desligado (antes, só os códigos de ações já existentes), e procura o código antes do número, para códigos só de algarismos. O código importado é guardado (escondido enquanto o campo estiver desligado). Corrige a importação da planilha da PI². Sem mudança na versão atual |
| 81.2 | Versão 2: a seção "Importar de planilha" de "Configurar este espaço" passa a se chamar "Importar ações de planilha" (pedido do responsável). Sem mudança na versão atual |
| 81.3 | Versão 2: na seção Responsáveis, "Importar de planilha" passa a se chamar "Importar responsáveis de planilha" (pedido do responsável). Sem mudança na versão atual |
| 82 | Versão 2: acima da lista agrupada, "Mostrar até: Fases · Etapas · Ações" recolhe de uma vez todas as fases, só as etapas ou nada (pedido do responsável, 22/10/2026). Substitui o botão "Recolher fases / Expandir tudo", que tinha ficado escondido no painel de ordenação depois da mudança da barra do topo. No computador e no celular. Sem mudança na versão atual |
| 83 | Versão 2: os separadores de fases e etapas da lista ficam em qualquer ordenação (antes, só em "Ordem do espaço"); a ordem escolhida vale dentro de cada etapa. Só somem ao desligar "Fases e etapas" em Campos opcionais (decisão do responsável, 22/10/2026). Sem mudança na versão atual |
| 83.1 | Versão 2: "Mostrar até" passa para a mesma linha do alerta de ações atrasadas, à direita (pedido do responsável); no celular, sem o rótulo "Mostrar até", para caber. Sem mudança na versão atual |
| 84 | Versão 2: os cartões da lista e do quadro perdem a faixa colorida à esquerda, que repetia a prioridade já mostrada na barra (pedido do responsável). Sem mudança na versão atual |
| 85 | Versão 2: na lista, a ação concluída não mostra mais a data de conclusão (pedido do responsável: a lista é minimalista). A data continua na janela da ação. Sem mudança na versão atual |
| 86 | Versão 2: na lista, no lugar da data da conclusão prevista, os dias úteis que faltam ("Faltam 6 dias úteis", "Conclui hoje"); na atrasada, "Venceu há N dias úteis", em vermelho (decisões do responsável, 22/10/2026). A data aparece ao parar o mouse e na janela da ação. O cálculo guarda o dia em que a previsão da atrasada venceu (`vencidaEm`, valor calculado, fora do banco). Sem mudança na versão atual |
| 87 | Versão 2: lista menos carregada (pedido do responsável). Situação só pelo ícone, e a liberada sem marca; sem o carimbo "Atrasada", a seta do canto e os rótulos repetidos; prazo como número com seta (↑ faltam, ↓ venceu, em vermelho; zero sem seta, em cor neutra) e "d úteis" pequeno embaixo. Escolha "Prioridade: Execução · Revisão · Nenhuma" acima da lista e do quadro, lembrada no aparelho. Sem mudança na versão atual |
| 87.1 | Versão 2: a barra da prioridade de execução passa a ser sempre vermelha, sem a matiz de cinza para vermelho (pedido do responsável), na lista, no quadro e na janela da ação. Sem mudança na versão atual |
| 87.2 | Versão 2: na lista, a ação não liberada fica só com o cadeado, sem o texto "Não liberada" (pedido do responsável); o texto aparece ao parar o mouse. Sem mudança na versão atual |
| 88 | Versão 2: na lista, o prazo vira barra (decisão do responsável): verde para a direita com os dias úteis que faltam, vermelha para a esquerda com há quantos dias a previsão venceu, numa escala única do espaço (do mais vencido ao que mais falta), com o zero marcado; o número fica ao lado, pequeno. Substitui o número com seta. Sem mudança na versão atual |
| 88.1 | Versão 2: no computador, o botão do menu lateral passa a usar o ícone de barra lateral (retângulo com uma divisão à esquerda, como no Jira, no Todoist e no Planner), no lugar das três linhas, que ficam só no celular, onde o menu é uma gaveta (pedido do responsável). Sem mudança na versão atual |
| 89 | Versão 2: cada cartão da lista e do quadro mostra uma só barra, à escolha em "Barra: Tempo restante · Execução · Revisão · Nenhuma" (pedido do responsável), com símbolo próprio à esquerda (cronômetro, raio, lupa) e cor própria (verde/vermelho; violeta, nova variável `--execucao` nos três blocos de cores; laranja). A barra da prioridade de execução deixa de ser vermelha. Na janela da ação, as barras usam as mesmas cores. Legenda atualizada. Sem mudança na versão atual |
| 90 | Versão 2: na lista, o ícone da situação passa a uma coluna estreita logo à direita dos nomes, e os avisos pequenos ("a partir de", "Falta estimar", reprogramações) vão para baixo do nome. Responsáveis com duas letras também no nome único ("Hebert" → "HE"), lado a lado, e todos os que couberem na largura do cartão, com "+N" só quando faltar espaço; a conta é refeita quando a janela muda de tamanho (pedido do responsável). Sem mudança na versão atual |
| 90.1 | Versão 2: o botão do menu lateral sai da barra do topo e fica fixo, como no Todoist (pedido do responsável): com o menu aberto, dentro dele, no canto superior direito; recolhido, na extremidade esquerda da tela. No celular, com a gaveta aberta, também vai para dentro dela. Sem mudança na versão atual |
| 91 | Versão 2: nova arrumação da barra do topo do espaço (pedido do responsável): seletor de modo, Filtrar e Ordenar à esquerda; nome do espaço no meio; Nova ação à direita. Na linha de baixo, "Barra" e "Mostrar até" ganham o mesmo desenho do seletor de modo (botões agrupados numa cápsula; na Barra, só o símbolo, com o nome no escolhido; "Nenhuma" ganhou símbolo próprio) e ficam à esquerda; o alerta de ações atrasadas vai para a direita. Sem mudança na versão atual |
| 92 | Versão 2: os participantes de cada ação aparecem em ordem alfabética do nome, da esquerda para a direita, na lista e no quadro (pedido do responsável). Sem mudança na versão atual |
| 93 | Versão 2: na lista, o ícone da situação (cadeado ou conclusão) passa para antes do nome. Novo botão **Colunas** na segunda linha: nome e situação ficam fixos; Descrição (texto inteiro), Participantes e Barras entram e saem, e a escolha fica lembrada no aparelho (`sextante.colunas`). A opção "Nenhuma" saiu do seletor Barra: quem não quer barra desliga a coluna Barras, e o seletor some junto (decisões do responsável). A Descrição só é oferecida quando o espaço usa esse campo. Sem mudança na versão atual |
| 94 | Versão 2: volta dos nomes técnicos no seletor Barra (revisão de decisão do responsável): "Índice de criticidade" e "Contribuição para a variância". Na lista, com uma dessas barras, a linha de cada etapa aberta mostra, sobre a coluna das barras, o nome e o que ele representa; passar o mouse no nome abre uma caixa com a explicação do glossário, e clicar leva a "Entenda os termos", cujos verbetes ganharam a equação (seções 15.2 e 15.3 da especificação). Em lista estreita, a legenda desce para baixo do nome da etapa. Sem mudança na versão atual |
| 95 | Versão 2: "Índice de criticidade" e "Contribuição para a variância" substituem "prioridade de execução" e "prioridade de revisão" em todo o sistema (ordens, legenda, cartões, janela da ação e glossário), por decisão do responsável; os nomes simples ficam no glossário. Os verbetes ganharam a fonte primária com link permanente: Van Slyke (1963), com texto completo público no DTIC, e Williams (1992), com resumo público. Referências também na lista de referências. Sem mudança na versão atual |
| 96 | Versão 2: **edição no lugar** (pedido do responsável). Na lista, no quadro e na rede, quem pode gravar edita com **Alt+clique** o nome (Enter grava, Esc cancela), a descrição (lista, com a coluna ligada; Ctrl+Enter grava) e os participantes (lista e quadro: lista de caixas de marcar que grava a cada marca), sem abrir a janela da ação. Com Alt pressionado, os campos editáveis ficam contornados. Enquanto um texto está em edição, os redesenhos esperam o fim. Código em `js/telas/edicao-no-lugar.js`; a dica entrou na Legenda. Sem mudança na versão atual |
| 97 | Versão 2: a legenda sobre a coluna das barras, na linha da etapa aberta, vale também para o **tempo restante** (pedido do responsável): "dias úteis até a conclusão; em vermelho, desde que venceu", com caixa de explicação e novo verbete no glossário (dias úteis até a conclusão prevista ou desde ela, quando já passou). Para a caixa não ficar cortada, o conteúdo da fase aberta deixa de esconder o que passa da borda depois da animação de abrir. Sem mudança na versão atual |
| 98 | Versão 2: o menu "Colunas" vira **Exibir** (símbolo de olho) e passa a valer também no quadro, na rede e no cronograma. Nele, o **identificador** antes do nome: nenhum, número (#1) ou código (só se o espaço usa códigos), nunca os dois, por servirem ao mesmo fim (decisão do responsável). Ação ainda sem código mostra o número. Padrão: código nos espaços que usam códigos; nenhum nos demais. A escolha fica guardada no aparelho (`sextante.identificador`); usar ou não códigos continua em "Configurar este espaço". O identificador fica na mesma linha do nome, só na exibição. Sem mudança na versão atual |
| 99 | Versão 2: **rede refeita** (pedido do responsável), pelo mesmo método de desenho em camadas do Mermaid (Sugiyama), sem biblioteca externa: setas longas ganham pontos de passagem com lugar próprio nas colunas do meio, e por isso nunca passam por cima de cartões; a ordem em cada coluna minimiza cruzamentos (média dos vizinhos e trocas); a altura de cada cartão fica perto da média dos vizinhos, sem sair da ordem (regressão isotônica), o que deixa cadeias retas; as setas de um mesmo cartão se espalham pela lateral. Ação sem anteriores fica logo antes da primeira seguinte. Cartões no padrão do quadro (situação, nome, responsáveis, data e folga), mantendo a borda colorida pela folga. "Ver tudo" passa a caber também na altura. Testes conferem, no exemplo e na PI² real, que cartões não se sobrepõem e que nenhuma seta cruza um cartão. Sem mudança na versão atual |
| 100 | Versão 2: rede no estilo do Bizagi (pedido do responsável). **Raias** horizontais, uma por etapa, com o nome na cabeça, à esquerda; cada ação fica na raia da sua etapa (decisão do responsável, entre raias e caixas em volta dos grupos). **Setas em ângulo reto**, de cantos secos: as subidas e descidas ficam nos vãos entre colunas, cada uma num trilho, na ordem de trilhos que cruza menos (custo de cruzamento por par e trocas sucessivas). A ordem dos cartões continua minimizando cruzamentos, agora dentro de cada raia. Onde duas setas ainda se cruzam, a horizontal dá um **salto** (semicírculo) sobre a vertical, como no Visio. Testes: no exemplo e na PI², cartões dentro das suas raias, setas só com trechos horizontais e verticais, nenhuma passando por cartão, e saltos só onde há cruzamento. Sem mudança na versão atual |
| 101 | Versão 2: na rede, as raias dão lugar aos **marcos** (milestones), como no Bizagi (pedido do responsável): uma faixa vertical por etapa, da esquerda para a direita na ordem do espaço, com o nome no alto. Cada ação fica no marco da sua etapa; dentro dele, as regras de coluna continuam. Seta para uma etapa anterior (rara) passa por baixo de tudo, tracejada. Setas longas passam a correr retas, numa altura só, sempre que cabem entre os cartões das colunas do meio. Sem mudança na versão atual |
| 102 | Versão 2: **zoom na rede**, como nos quadros infinitos (pedido do responsável): Ctrl + rolar o mouse (ou o gesto de pinça do touchpad) aproxima e afasta em volta do cursor, de 20% a 250%; botões − e + com a porcentagem; arrastar o fundo move a rede. "Normal" volta a 100% e "Ver tudo" faz caber na área, que agora tem altura fixa. O zoom escolhido se mantém quando a rede é redesenhada. Sem mudança na versão atual |
| 103 | Versão 2, lote de 22/10/2026 (item 4): cartões do quadro no estilo enxuto da lista (sem data nem carimbo "Atrasada": a coluna diz a situação e a barra, o prazo; todos os responsáveis que couberem); círculos das pessoas com a sigla, quando tem até três letras, no lugar das iniciais, que podiam repetir; na rede, seta reta quando um dos lados tem só ela e a altura cabe no outro cartão (menos degraus perto das pontas). Sem mudança na versão atual |
| 104 | Versão 2, lote de 22/10/2026 (item 5): revisão de acessibilidade com o axe-core (regras WCAG 2 A e AA) nos seis modos, nos temas claro e escuro, no computador e a 400 px. Corrigido: contraste insuficiente de textos pequenos em `--faint` (números das barras, etapa no cartão, folga na rede, datas do cronograma), que passaram a `--muted`; `--faint` do tema escuro clareado para #86978F; células bloqueadas da planilha com papel de caixa de texto só de leitura; o "+N" de responsáveis só aparece quando há o que esconder. Conferido pelo teclado: menu Exibir abre com Enter e fecha com Esc, a caixa de explicação da legenda aparece com o foco, cartões da rede abrem com Enter e o zoom responde aos botões. Nenhuma rolagem horizontal a 400 px. Sem mudança na versão atual |
| 105 | Versão 2, lote de 22/10/2026 (item 6): teste de velocidade com planos sintéticos de 50 a 300 ações (`v2/testes/desempenho.mjs`, rodado à mão). No ambiente de teste, com 200 ações: caminho crítico 1 ms, simulação de 10.000 cenários cerca de 1 s, arrumação da rede cerca de 0,5 s e desenho da rede na tela cerca de 0,5 s. Para não refazer a simulação sem necessidade, a tela passou a reaproveitar o resultado anterior quando muda só o que não entra no cálculo (nome, descrição, responsáveis, notas): `chaveDaSimulacao`, em `js/simulacao.js`, com testes. Resultados idênticos (mesma semente, mesmo sorteio). Sem mudança na versão atual |
| 106 | Versão 2, lote de 22/10/2026 (item 3): **checklist da ação** (passo 2.8; especificação, seções 4.2.2 e 16.5). Campo novo `checklist` na ação, com itens `id`, `texto` e `feito` (dicionário de dados atualizado). Cada item muda sozinho, numa transação (`mudarChecklist` nos dois bancos, com teste de contrato de gravações simultâneas); operações do `Store`: acrescentar, marcar, mudar o texto e retirar item; cada mudança entra no histórico, em frase simples. Na janela da ação: "Adicionar checklist", itens com caixa de marcar, texto editável com um clique e ×, barra de progresso; nos cartões da lista e do quadro, o progresso "feitos/total". Não precisa de regra nova no banco (o campo fica no documento da ação). Sem mudança na versão atual |
| 107 | Versão 2, lote de 22/10/2026 (item 1): **programa da migração** preparado para a troca (passo 1.20), sem executar. `v2/js/migracao.js` converte a cópia de segurança da versão atual na cópia de segurança da versão 2 (seção 11 da especificação), com relatório de avisos; ensaio por `v2/testes/migrar-copia.mjs`. Testado com a cópia real da PI²: restaurada na versão 2, dá as mesmas datas do caminho crítico da versão atual; o plano original vira o retrato "Plano original". Nada foi gravado em banco. Sem mudança na versão atual |
| 108 | Versão 2, lote de 22/10/2026 (item 2): **rascunho da documentação técnica da versão 2**, em `docs/documentacao-tecnica-v2-rascunho.md`, para o passo 1.20. Visão geral, arquitetura, funcionalidades, indicadores, importação e exportação, permissões, decisões e pendências escritos a partir do sistema como está; dicionário de dados, regras de cálculo, situações e fundamentos matemáticos copiados da especificação (o teste do dicionário passa também contra o rascunho). Não substitui esta documentação até a troca |
| 109 | Versão 2, **teste** pedido pelo responsável (23/10/2026): barra do topo com menus que abrem para baixo, no computador. Nome do espaço à esquerda; menus Visualização (mostra o modo atual), Filtrar (com o número de filtros ativos), Ordenar (com um ponto quando a ordem não é a do espaço) e Exibir (indicador da barra, "Mostrar até", identificador e colunas, cada um só onde se aplica); à direita, etiqueta vermelha "N atrasadas" (filtra as atrasadas) e Nova ação. A segunda linha some no computador; no celular, fica como antes. Entre 641 e 1399 px, os menus ficam só com o ícone, exceto o da visualização. Área do conteúdo alargada de 1240 para 1600 px. Sem mudança na versão atual |
| 109.1 | Versão 2: largura por modo (pedido do responsável). A barra do topo passa a ocupar a largura toda da tela; lista, quadro e linha do tempo voltam à largura de leitura (1240 px); planilha, cronograma e rede ocupam toda a largura abaixo da barra. Sem mudança na versão atual |
| 109.2 | Versão 2: a rede vai até o fim da tela (altura recalculada ao redimensionar a janela), e a explicação de uso subiu para a linha das ferramentas, no espaço livre ao lado da legenda (pedido do responsável). Sem mudança na versão atual |
| 110 | Versão 2: no indicador **tempo restante**, opção de mostrar ao lado da barra a **data prevista** (dd/mm; com o ano, quando é outro) no lugar dos dias úteis restantes; na ação vencida, a data em que venceu (pedido do responsável). Fica em Exibir > "Ao lado da barra de tempo", lembrada no aparelho (`sextante.tempoNumero`); a legenda da etapa acompanha a escolha. Corrigido junto: a marca da largura por modo, posta no `body` na versão 109.1 com o atributo `data-modo`, fazia os cliques nas opções do Exibir trocarem de visualização; passou a `data-vista-atual`. Sem mudança na versão atual |
| 110.1 | Versão 2: datas ao lado da barra de tempo uniformes (pedido do responsável): se todas as datas mostradas no espaço são do ano corrente, ficam como dd/mm; se ao menos uma é de outro ano, todas levam o ano (dd/mm/aa). Sem mudança na versão atual |
| 111 | Versão 2: o indicador ganhou **menu próprio** na barra do topo, com ícone de mostrador (pedido do responsável): "Indicador" fica entre Ordenar e Exibir e só aparece onde há barras (quadro, e lista com a coluna Barras ligada); traz o indicador e, para o tempo restante, o que mostrar ao lado da barra. Essas opções saíram do Exibir. Sem mudança na versão atual |
| 111.1 | Versão 2: o menu Indicador passa para a direita do Exibir; a coluna "Barras" do Exibir passa a se chamar "Indicador", como o rótulo da segunda linha no celular (pedido do responsável). Sem mudança na versão atual |
| 112 | Versão 2 (pedidos do responsável): (1) o símbolo da contribuição para a incerteza passa da lupa, reservada para uma futura busca, a uma curva de sino; (2) na tela, "contribuição para a variância" passa a "contribuição para a incerteza" (menus, ordens, cartões, janela da ação, legenda); o verbete do glossário ganhou o termo técnico e um parágrafo com o significado técnico (incerteza medida pela variância); (3) o campo "Notas" passa a se chamar "Anotações" na tela e no histórico (no banco, continua `notas`). Sem mudança na versão atual |
| 113 | Versão 2 (pedido do responsável, em teste): o menu de visualização ganhou ícone próprio (janela dividida em painéis) e continua mostrando o modo atual ("Lista"; ao passar o mouse, "Visualização: Lista"). Filtrar e Ordenar viram um menu só, **Classificar e filtrar**, como no Excel: primeiro "Classificar por", depois "Filtrar por situação", responsável e "Limpar filtros"; o botão mostra um ponto quando a ordem não é a do espaço e o número de filtros ativos. Sem mudança na versão atual |
| 114 | Versão 2 (teste pedido pelo responsável): barra do topo do espaço em **três grupos**, como no Numbers (e nas diretrizes de interface do macOS). À esquerda, "onde estou": o nome do espaço, só quando o menu lateral não está à vista, e a visualização. No centro da área de trabalho, "como vejo": Classificar e filtrar, Exibir e Indicador, com os painéis abrindo centralizados sob eles. À direita, "o que faço": atrasadas e Nova ação. Com o menu lateral aberto, o nome sai da barra (o espaço já aparece destacado no menu). Entre 641 e 1099 px, sem espaço para centralizar, os grupos ficam lado a lado. No celular, nada muda. Sem mudança na versão atual |
| 114.1 | Versão 2: correção. Os painéis de Classificar e filtrar, Exibir e Indicador abriam deslocados para a direita e pulavam de lugar no primeiro clique, porque a animação de abrir sobrepunha o deslocamento que os centraliza. A centralização passou a usar a propriedade `translate`, que a animação não altera. Sem mudança na versão atual |
| 115 | Versão 2: nova ordem do menu Visualização, a pedido do responsável: Lista, Quadro, Rede, Cronograma, Planilha e Linha do tempo. Sem mudança na versão atual |
| 116 | Versão 2: revisão da planilha. Todos os campos, inclusive os calculados (só leitura, depois de uma linha mais forte), na ordem Fase, Etapa, Nº, Rótulo, Descrição e demais; novas colunas Fase, Anotações, Checklist, Situação, Atrasada desde, Liberação prevista, Conclusão prevista, Folga, Índice de criticidade, Contribuição para a incerteza, Reestimativas, Criada em, Alterada em e Alterada por. Correções: as colunas eram espremidas até caber na tela, e agora mantêm a largura, com rolagem para o lado; de Fase a Rótulo ficam paradas à esquerda a partir de 1200 px. Escolha das colunas em "Exibir", lembrada no aparelho. As células da grade deixaram de usar o atributo `data-coluna`, que o menu de colunas da lista também lia: editar uma célula gravava colunas falsas na escolha da lista. Sem mudança na versão atual |
| 116.1 | Versão 2: ajuste da planilha, a pedido do responsável. A ordem passa a começar por Nº e Ação (o rótulo, com nome de coluna mudado só na planilha), seguidos de Fase, Etapa e demais; ficam parados à esquerda só Nº, Código e Ação, em qualquer largura de tela. Sem mudança na versão atual |
| 117 | Versão 2: a palavra "rótulo" sai da interface, a pedido do responsável. Nos títulos de coluna, "Ação"; nos campos, mensagens e histórico, "Nome da ação" (por exemplo, "Mudou o nome da ação de … para …"). O campo no banco continua `rotulo`, e a importação já aceitava o título "Ação". Sem mudança na versão atual |
| 118 | Versão 2: ajustes da planilha aprovados pelo responsável. Setas, Enter e Shift+Enter andam entre as células (num texto, ← e → só saem com o cursor na ponta; Alt+↓ continua abrindo a lista da etapa); data vazia sem a máscara até receber o cursor; células bloqueadas mais escuras que as calculadas, visíveis também no tema claro; explicação do alto reduzida a uma linha, com "Mais dicas"; a grade vai até o fim da tela. Correção: cada gravação redesenhava a grade e a rolagem voltava ao começo; agora a posição é mantida. Sem mudança na versão atual |
| 119 | Decisões do responsável, só em documentação: o sistema passa a ser tratado como protótipo (prova de conceito e modelo conceitual para o sistema definitivo, a ser desenvolvido do zero pela equipe de TI da UFCI-MG), registrado no AGENTS.md e na especificação; fase 4 revista (passagem à equipe de TI, com os recursos institucionais como requisitos do sistema definitivo); decisões da execução em lote aprovadas; barra do topo em três grupos aprovada; migração da versão 1 cancelada, com descarte dos dados, e a versão 2 indo para a raiz com o banco `sextante-v2`; manual do usuário parado; piloto detalhado. Sem mudança no código |
| 120 | Versão 2: com a barra lateral recolhida, no computador, o nome do espaço vai para o alto do conteúdo e o canto esquerdo da barra do topo fica vazio; um puxador na borda esquerda abre a barra lateral, e Ctrl+B (⌘B) abre e recolhe. Correção: na rede e na planilha, a folga de baixo da página fazia a tela rolar um pouco e esconder o alto sob a barra do topo. Sem mudança na versão atual |
| 121 | **Troca (passo 1.20).** A versão 2 passa a ser o sistema, na raiz do site, com o banco `sextante-v2`; os dados da versão 1 são descartados e `/v2/` redireciona para a raiz. Esta documentação é refeita a partir da especificação da reescrita (seções 2 a 16, com a mesma numeração), do rascunho e da documentação da versão 1 (histórico e ideias futuras); a especificação e o rascunho são apagados. O teste do dicionário passa a ler a seção 4 deste arquivo. O programa de migração sai. O teste de comparação usa uma cópia congelada da versão 1 |
| 122 | Passo 2.4a: tipos de espaço. Plano de Ação ou Projeto na criação e em "Configurar este espaço"; no Plano de Ação, o Programa do PEI/PDI (texto livre até o catálogo) e o documento de aprovação; menu lateral agrupado por tipo. Campos novos `tipo`, `programa` e `aprovacao` no dicionário de dados (4.1 e 4.1.6). Os espaços existentes, como a PI², valem como Projeto. Passo 2.4 dividido em 2.4a e 2.4b; definição do cronograma aberto registrada na seção 16.1 |
| 123 | Passo 2.4b, parte 1 (dados e cálculo): modelo do espaço (`modelo`: estruturado, aberto ou personalizado; fixo depois de criado) e data-limite da ação (`dataLimite`). Prazos por estimativa ou por data-limite, nunca os dois; com data-limite, Atrasada = data-limite vencida e ação não concluída, sem caminho crítico; sem dependências, as anteriores são ignoradas; sem simulação, retrato sem chance nem datas estatísticas. O Store recusa o que o modelo desliga. Dicionário: 4.1.7, `dataLimite` em 4.2, retrato. Novo ponto para reavaliação: modelo fixo. Sem mudança na tela |
