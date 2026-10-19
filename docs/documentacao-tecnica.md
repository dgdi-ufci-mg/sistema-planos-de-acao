# Sistema de Gerenciamento de Planos de Ação — Documentação técnica

**Instituição:** Universidade Federal de Ciência e Inovação de Minas Gerais (UFCI-MG)
**Situação:** em uso, em fase de testes. Publicado no GitHub Pages (https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/), com dados no Firebase
**Última atualização deste documento:** 17/10/2026 (versão 26.1 da página)

---

## 1. Visão geral

### 1.1 Objetivo

Ferramenta online para planejar e acompanhar planos de ação institucionais. Ela calcula datas, identifica as ações que não podem atrasar, estima a chance de cumprir o prazo e mede o andamento em relação ao plano original.

### 1.2 Público

Gestores e equipes sem formação em gerenciamento de projetos. A ferramenta precisa ser compreensível para leigos sem perder o rigor técnico.

### 1.3 Princípios de projeto

- **Linguagem simples.** A interface usa palavras do dia a dia. Quando existe um conceito técnico equivalente, ele aparece em itálico, em letra menor, como "Termo técnico: …". A aba "Entenda os termos" reúne o glossário.
- **Rigor metodológico.** Os cálculos seguem o estado da arte em gestão de cronogramas sob incerteza: simulação de Monte Carlo, índices de sensibilidade e Earned Schedule.
- **Reprodutibilidade.** A simulação usa uma semente fixa, então o mesmo plano gera sempre o mesmo resultado.
- **Interoperabilidade.** Os dados entram e saem pelo Google Planilhas (TSV) e por fluxogramas Mermaid.
- **Identidade visual.** Logotipo em rosa dos ventos (`logo.png`). As cores derivam dele: verde-azulado #00796B (destaque), vermelho #E3262D (sem folga), dourado #F2B04A (quase sem folga), laranja #F47216 (faixa do topo e histograma), sobre fundos neutros quentes.

---

## 2. Arquitetura

### 2.1 Componentes

- **Página única (HTML, CSS e JavaScript).** Dependências externas: fontes do Google Fonts (Barlow Semi Condensed, Source Sans 3 e IBM Plex Mono) e a biblioteca de leiaute de grafos **dagre 0.8.5** (cdn.jsdelivr.net), usada só para calcular as posições do diagrama de rede.
- **Hospedagem:** GitHub Pages, a partir da branch `main` do repositório (ver 2.5). Até 14/10/2026, o sistema era um artefato publicado no Claude (claude.ai); essa versão está descontinuada.
- **Persistência:** Firebase Firestore (projeto `sistema-planos-de-acao`), compartilhado entre todos os visitantes e atualizado em tempo real.
- **Permissões:** Firebase Authentication (e-mail e senha) e regras do `firestore.rules`: leitura pública, gravação só com login.

### 2.2 Modos de operação

| Modo | Quando ocorre | Comportamento |
|---|---|---|
| Firebase · consulta | Site oficial, sem login | Lê o Firestore; botão **Entrar** no topo; campos de edição bloqueados |
| Firebase · edição | Site oficial, com login por e-mail e senha | Lê e grava no Firestore em tempo real; botão **Sair** no topo |
| Local | Cópia com `config.js` vazio (testes) | Calcula normalmente, mas nada é salvo; cada pessoa vê só o que digitou |
| Compartilhado / Só consulta (legado) | Página aberta como artefato no Claude | Usa a base do artefato. Código mantido, mas a versão no Claude está descontinuada |

### 2.3 Limitações conhecidas

- O plano gratuito do Firebase tem cotas diárias de leitura e gravação, suficientes para o uso atual.
- A meta de longo prazo é hospedar o sistema num servidor institucional da UFCI-MG.

### 2.4 Camada de armazenamento

Toda leitura e gravação passa pelo objeto `Store`, com duas implementações: base compartilhada (Firestore, ou a base do artefato no modo legado) e memória local. Isso isola a troca futura de backend, como um servidor institucional: basta reimplementar o `Store`.

As gravações em um mesmo documento são serializadas (fila por caminho). Erros de permissão colocam a página em modo só consulta, e falhas transitórias são repetidas uma vez.

**Escolha do banco na inicialização (`boot`):** (1) se a página roda no Claude e a capacidade `db` responde, usa a base do artefato (legado); (2) senão, se `window.FIREBASE_CONFIG` (arquivo `config.js`) tiver `projectId`, carrega o Firebase e usa o Firestore; (3) senão, modo local.

**Firebase:** SDK *compat* 10.14.1, carregado sob demanda de cdn.jsdelivr.net (`firebase-app`, `firebase-auth` e `firebase-firestore`). O objeto `firebase.firestore()` tem a mesma interface usada pelo `Store` (`collection().onSnapshot`, `doc().set/update/delete`, `collection().doc().id`), então o `Store` funciona sem alteração. Mesmos caminhos de dados: `projects/{id}`, `projects/{id}/tasks/{código}`, `people/{id}`.
- **Autenticação:** e-mail e senha (Firebase Authentication), persistência local no navegador, recuperação de senha por e-mail. Mensagens de erro traduzidas.
- **Permissões:** `firestore.rules` libera leitura a todos e gravação só a usuários autenticados. O cadastro por conta própria deve ser desativado no Console, para que só o administrador crie usuários.
- **Erro `permission-denied`:** a página pede para entrar ou avisa que o usuário não tem permissão.
- **Teste:** o fluxo (consulta sem login, erro de senha, login, gravação, saída) foi validado com um Firebase simulado em navegador automatizado.

**Cópia de segurança (aba Importar e exportar):** "Copiar todos os dados" gera um JSON `{sistema, versao, geradoEm, projects, tasks:{plano:{ação}}, people}` com todos os planos, ações e responsáveis. "Restaurar a partir de uma cópia" grava esses documentos (substitui os de mesmo identificador, mantém os demais), com confirmação. Serve também para migrar os dados do Claude para o Firebase. A restauração aparece também na tela inicial de um banco vazio ("Nenhum plano ainda"), para permitir a migração sem criar um plano antes; só funciona após o login.

### 2.5 Repositório e colaboração

- **Código-fonte:** https://github.com/dgdi-ufci-mg/sistema-planos-de-acao (organização "DGDI | UFCI-MG", repositório público).
- **Estrutura:** `index.html` (o sistema), `config.js` (configuração do Firebase), `firestore.rules` (regras de acesso), `logo.png` (logotipo), `docs/` (documentação técnica e manual), `README.md`, `CONTRIBUTING.md` (guia de colaboração), `AGENTS.md` (regras para quem contribui, pessoa ou IA), `CLAUDE.md` (aponta para o `AGENTS.md` e traz o que é exclusivo do Claude) e `LICENSE` (GPL v3).
- **Fluxo:** sugestões e problemas por Issues; mudanças por pull request, com revisão antes de entrar na `main`. Toda mudança relevante atualiza esta documentação e o histórico de versões.
- **Publicação:** GitHub Pages a partir da `main`, em https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/. Tudo o que entra na `main` vai ao ar em 1 a 2 minutos.
- **Cópias:** esta documentação também fica nos documentos do projeto no Claude, para consulta nas conversas de chat. A versão do repositório é a de referência; a cópia é sempre substituída a partir dela, nunca editada diretamente.

---

## 3. Funcionalidades por aba

| Aba | Conteúdo |
|---|---|
| Indicadores (topo) | Conclusão prevista, data segura (P80), chance de cumprir o prazo, ritmo em relação ao plano |
| Cronograma | Gantt em dias úteis, setas de dependência, plano original, linhas de atualização, prazo e data segura |
| Diagrama | Diagrama de rede (PERT/CPM): caixas por ação, cores por folga, setas críticas em vermelho, blocos por etapa, siglas dos responsáveis, zoom |
| Ações | Cadastro e edição de ações: código (opcional), etapa (com sugestões das já usadas), ação (descrição completa), rótulo (nome curto), "Depende de" e "Responsáveis" com busca, prazos e andamento |
| Previsões | Histograma e curva acumulada da simulação; comparação PERT × Monte Carlo; ranking por prioridade de atenção (SSI) |
| Andamento | Plano original (linha de base), data de status, curva S, valor agregado e desvio por ação |
| Importar e exportar | Entrada por planilha (TSV/CSV) ou Mermaid; saída para planilha e Mermaid |
| Responsáveis | Lista global de pessoas (nome, sigla, setor), com cadastro individual e em lote |
| Entenda os termos | Glossário com equivalência entre termos simples e técnicos |
| Ajuda (botão no topo) | Abre o manual ilustrado (artefato separado, sem base de dados) |
| Configurar | Nome do plano, início, prazo final, data de status, distribuição, número de simulações, semente e feriados |

---

## 4. Metodologia de cálculo

### 4.1 Calendário

- A unidade de tempo é o **dia útil**. Sábados, domingos e as datas cadastradas como feriado ou sem expediente são excluídos.
- O dia 0 é o primeiro dia útil a partir da data de início do plano.
- Uma ação com início `ES` e fim `EF` ocupa os dias úteis `ES … EF−1`. A data de término exibida é o dia útil `ceil(EF) − 1`.
- A data de status `S` corresponde ao número de dias úteis decorridos até essa data, inclusive.

### 4.2 Estimativas de duração

Cada ação tem três estimativas: otimista (O), mais provável (M) e pessimista (P). Regras de saneamento:

- Só M preenchido → O = P = M.
- M ausente → média de O e P, ou o valor que existir.
- Sem nenhuma estimativa → duração 0, com aviso na tela.
- Se O > M, O passa a valer M. Se P < M, P passa a valer M.

**Duração esperada (PERT):** `te = (O + 4M + P) / 6`
**Desvio-padrão (PERT):** `σ = (P − O) / 6`

### 4.3 Rede e caminho crítico (CPM)

- As dependências são do tipo término → início, sem defasagem.
- A ordenação topológica usa o algoritmo de Kahn. Ciclos são detectados e bloqueiam o cálculo, com mensagem ao usuário. Predecessores inexistentes são ignorados, com aviso.
- **Passagem de ida:** `ES = máx(EF das predecessoras)`; `EF = ES + duração`.
- **Passagem de volta:** `LF = mín(LS das sucessoras)`, ou o término do plano; `LS = LF − duração`.
- **Folga total:** `LS − ES`. A ação é crítica se a folga for menor que 10⁻⁶ e ela não estiver concluída.

### 4.4 Execução (com data de status)

Quando há data de status `S > 0`, cada ação recebe um estado:

| Estado | Critério | Regra de agendamento |
|---|---|---|
| Concluída | % = 100, ou término real ≤ S | ES = início real, se houver; EF = término real, ou mín(ES + duração, S) |
| Em andamento | % > 0, ou início real antes de S | ES = início real, ou mín(ES, S); EF = máx(S, ES) + duração × (1 − %) |
| Não iniciada | demais | ES = máx(ES calculado, S) |

Sem data de status, o cronograma é puramente planejado. Ainda assim, ações com 100% são exibidas como concluídas no Gantt.

### 4.5 Probabilidade pelo PERT clássico

- Escolhe-se um caminho crítico: a partir da ação crítica que termina no fim do plano, segue-se para trás pelas predecessoras críticas cujo `EF = ES` da sucessora. Nos empates, prevalece a de maior σ.
- `σ_caminho = √(Σ σᵢ²)`. Em ações em andamento, σᵢ é multiplicado por (1 − %); ações concluídas não entram.
- `P(T ≤ prazo) = Φ((prazo − T_CPM) / σ_caminho)`, com Φ a distribuição normal padrão.

Esse método ignora caminhos paralelos quase críticos e tende a ser otimista (viés de convergência). Por isso é exibido apenas como comparação.

### 4.6 Simulação de Monte Carlo

- **Gerador:** mulberry32, com semente configurável (padrão 20261014).
- **Número de iterações:** de 200 a 20.000 (padrão 3.000).
- **Distribuições:**
  - **Triangular** (padrão, "mais cautelosa"), por transformação inversa.
  - **Beta-PERT** ("mais otimista"), com α = 1 + 4(M − O)/(P − O) e β = 1 + 4(P − M)/(P − O), amostrada pela razão de duas gamas (método de Marsaglia–Tsang).
- Em cada iteração, sorteia-se a duração de cada ação e roda-se o agendamento completo da seção 4.3, respeitando a execução da seção 4.4.
- **Saídas:**
  - P10, P50, P80 e P95 da data de término; média e desvio-padrão.
  - Probabilidade de cumprir o prazo: fração de iterações com término ≤ prazo.
  - **Índice de criticidade (CI)**: fração de iterações em que a ação ficou com folga zero.
  - **Crucialidade (CRI)**: correlação de Pearson entre a duração da ação e a duração do plano.
  - **Índice de sensibilidade do cronograma (SSI)**: `SSI = (σᵢ / σ_plano) × CI`, com σᵢ e σ_plano medidos nas próprias simulações.
- Ações concluídas não recebem índices.
- A tabela "Onde vale mais a pena agir" é ordenada pelo SSI. A literatura indica que a criticidade, sozinha, é o guia mais fraco para orientar ações gerenciais.

### 4.7 Valor agregado e Earned Schedule

- **Peso de cada ação (v):** o custo previsto, se o plano tiver custos; caso contrário, a duração esperada `te` (trabalho em dias).
- **Linha de base:** grava ES, EF e v de cada ação, além do término previsto (`fin`) e do tipo de peso.
- **BAC** = Σ v.
- **PV(t)** = Σ v × fração linear planejada até t: `clamp((t − ES_b) / (EF_b − ES_b), 0, 1)`.
- **EV** = Σ v × % concluído. **AC** = Σ custo real.
- **SPI** = EV / PV. **CPI** = EV / AC. **EAC** = BAC / CPI.
- **Earned Schedule (ES):** o instante t em que PV(t) = EV, encontrado por bisseção.
- **SPI(t)** = ES / AT, com AT = dias úteis até a data de status.
- **Término projetado (IEAC(t))** = término da linha de base / SPI(t).
- O destaque da interface é o SPI(t), porque o SPI tradicional converge para 1 no fim do plano mesmo com atraso.

### 4.8 Geração automática do código da ação

O código é opcional no cadastro. Se ficar em branco, o sistema o gera assim:

1. Normaliza o nome (sem acentos, minúsculas) e descarta palavras vazias (artigos, preposições e conjunções, como "de", "da", "para", "com").
2. Testa candidatos de 3 letras, nesta ordem: iniciais das três primeiras palavras; inicial da 1ª + duas consoantes da 2ª; inicial da 1ª + duas primeiras letras da 2ª; duas letras da 1ª + inicial da 2ª; consoantes da 1ª palavra; três primeiras letras da 1ª; outras combinações das letras das palavras.
3. Usa o primeiro candidato que comece por letra e não esteja em uso no plano (comparação sem diferenciar maiúsculas).
4. Na falta, usa duas letras + dígito (2 a 9) ou um sorteio.

**Sorteio** (uso interno, como último recurso): 3 caracteres, o primeiro sempre letra, sem os caracteres ambíguos O, 0, I e 1. Não há botão de sorteio na tela, para manter a interface simples.

Enquanto o usuário digita o nome com o código em branco, o formulário mostra a sugestão ("Se deixar em branco: …") e avisa se um código digitado já está em uso.

### 4.9 Diagrama de rede

- **Leiaute:** dagre, da esquerda para a direita, com grafo composto (as etapas viram grupos). Nós artificiais "Início" (ligado às ações sem predecessoras) e "Fim" (ligado às ações sem sucessoras).
- **Desenho:** SVG próprio, com cores dos tokens do tema. Espaçamento: 34 px entre caixas da mesma coluna e 48 px entre colunas.
- **Traçado das setas (roteamento por canais, com distância mínima obrigatória):**
  1. **Colunas e corredores.** As caixas de uma mesma posição na sequência formam uma coluna; o espaço entre duas colunas é um corredor.
  2. **Portas distribuídas.** Cada seta sai e chega por um ponto próprio na lateral da caixa. As saídas são ordenadas pela altura do destino; as chegadas, pela altura da origem. Nos círculos de Início e Fim, as portas ficam distribuídas no arco.
  3. **Escolha do caminho.** Setas entre colunas vizinhas fazem um "L", com o trecho vertical no corredor entre elas. Setas longas passam por uma "faixa" em cada coluna intermediária; para cada uma, o sistema compara três traçados:
     - **vagas do dagre**: a posição que o dagre reservou para a seta em cada coluna, já escolhida por ele para reduzir cruzamentos (é o que o Mermaid usa);
     - **mudar de altura cedo**: no primeiro corredor, seguindo depois na altura do destino;
     - **mudar de altura tarde**: seguir na altura da origem e só mudar no último corredor.
     Cada traçado só é aceito se as faixas não atravessarem caixas (margem de 8 px) nem ficarem a menos de 7 px da faixa de outra seta. Entre os aceitos, vence o de menor custo: número estimado de cruzamentos com as demais setas, mais 0,35 por curva, com pequena preferência pelas vagas do dagre. São feitas duas rodadas, com as setas críticas primeiro.
     - **Portas reavaliadas:** depois da escolha, a ordem das portas de cada caixa é refeita pela altura para onde cada seta realmente vai (ou de onde vem), e a escolha é repetida uma vez.
  4. **Trilhos exclusivos e ordenados.** Cada trecho vertical tem trilho próprio no corredor, a 8 px do vizinho. A ordem dos trilhos é escolhida por inserção gulosa, colocando cada trecho na posição que gera menos cruzamentos com os já posicionados. A regra: o trecho à esquerda cruza o da direita se a altura de entrada do da direita estiver dentro do intervalo vertical do da esquerda, ou se a altura de saída do da esquerda estiver dentro do intervalo do da direita.
  5. **Alargamento automático.** Se um corredor não comporta seus trilhos mais 14 px de margem de cada lado, as colunas seguintes são deslocadas para a direita e os blocos de etapa acompanham.
  6. **Cantos arredondados** (raio de 5 px), para distinguir curva de cruzamento.
  - Histórico: as versões 16 a 18 permitiam que setas compartilhassem trechos, o que tornava algumas ligações ambíguas (ex.: VRA → VCT parecia sair de WXP). A versão 19 separou os trilhos, mas ignorava as vagas do dagre e gerava cruzamentos evitáveis; a versão 20 passou a considerá-las e a escolher o traçado pelo menor número de cruzamentos.
  - Limite conhecido: cruzamentos que decorrem da própria posição das caixas (por exemplo, uma ação entre outras duas que estão ligadas) não são eliminados; isso exigiria reposicionar as caixas.
- **Blocos de etapa:** altura calculada pelo dagre, que já reserva espaço para o título; largura recalculada pelas caixas da etapa (com 18 px de folga), para acompanhar o alargamento dos corredores.
- **Classificação das caixas:** concluída (verde); sem folga (vermelha); folga ≤ limite `nearCrit` (laranja, "quase sem folga"); com folga (azul).
- **Ícones:** ✓ concluída; ▶ em andamento; ! atrasada (término previsto mais de meio dia útil depois do plano original).
- **Textos da caixa:** "código · nome" (quebrado em linhas), "prazo arredondado d · folga" (folga arredondada para baixo; 0 nas críticas) e as siglas dos responsáveis (ou os nomes, sem sigla), opcional.
- **Seta crítica:** liga duas ações críticas em que o fim de uma coincide com o início da outra; também do Início e para o Fim, quando aplicável.
- **Zoom:** inicia ajustado à largura (mínimo 55%); botões −, + e "Ajustar à tela" (30% a 200%).
- **Exportação Mermaid** (aba Importar e exportar) reproduz o mesmo diagrama: nós Início e Fim, `subgraph` por etapa, rótulos com prazo, folga e siglas e `classDef` nas cores da paleta.

### 4.10 Validação feita

Com o plano da PI² Fase 1, o cálculo determinístico reproduziu o da planilha original: 115 dias úteis, término em 22/03/2027 (a planilha arredonda para 23/03) e caminho crítico G8P → WKT → KQU → WN3.

---

## 5. Modelo de dados

**Esta seção é o dicionário de dados do sistema.** Toda alteração na estrutura do banco (entidade, campo, tipo, valores permitidos, chave ou relação) deve ser registrada aqui, no mesmo commit que a faz. Motivos: permitir que futuras pessoas compreendam o banco e servir de base às cargas (ETL) para o Data Lakehouse da instituição.

### 5.1 `projects/{idDoPlano}` — plano

| Campo | Tipo | Descrição |
|---|---|---|
| name | texto | Nome do plano |
| start | data ISO | Início |
| target | data ISO | Prazo final (meta) |
| statusDate | data ISO | Data de status |
| holidays | texto | Datas sem expediente (dd/mm/aaaa, separadas por vírgula) |
| dist | "tri" ou "beta" | Distribuição da simulação |
| iters | número | Número de simulações |
| seed | número | Semente |
| nearCrit | número | Limite de folga, em dias úteis, para "quase sem folga" (padrão 10) |
| createdAt | data e hora ISO | Criação |
| baseline | objeto | `{at, fin, useCost, tasks: {código: {es, ef, v}}}` |

### 5.2 `projects/{idDoPlano}/tasks/{código}` — ação

O código da ação é o próprio identificador do documento e não pode ser alterado.

| Campo | Tipo | Descrição |
|---|---|---|
| name | texto | Rótulo: nome curto usado no cronograma e no diagrama. Se o usuário não informar, recebe a própria descrição |
| desc | texto | Ação (descrição completa). Fica vazio quando é igual ao rótulo |
| order | número | Ordem de exibição |
| preds | lista de códigos | Depende de |
| owners | lista de ids de pessoa | Responsáveis |
| o, m, p | número | Estimativas em dias úteis |
| cost, ac | número | Custo previsto e custo real |
| pct | 0 a 100 | % concluído |
| aS, aF | data ISO | Início e término reais |
| stage | texto | Etapa. Usada para os blocos do diagrama e os `subgraph` do Mermaid. Editável no cadastro e na tabela da aba Ações |
| status | texto | Situação herdada da importação da PI²; ainda não exibida |

### 5.3 `people/{id}` — responsável (lista global)

| Campo | Tipo | Descrição |
|---|---|---|
| name | texto | Nome |
| sigla | texto (até 12) | Usada onde falta espaço |
| unit | texto | Setor |
| createdAt | data e hora ISO | Criação |

### 5.4 Dados por visitante (navegador)

O plano selecionado, a aba aberta e a opção de mostrar setas ficam no `localStorage` de cada navegador. Nunca são compartilhados.

---

## 6. Importação e exportação

### 6.1 Planilha (TSV/CSV)

- O separador é detectado automaticamente: tabulação, ponto e vírgula ou vírgula.
- O cabeçalho é reconhecido por sinônimos, sem diferenciar acentos e maiúsculas. Exemplos: Código / ID / Sigla; **Etapa** / Fase / Bloco; Ação / Tarefa / Atividade; **Rótulo** / Rótulo no diagrama / Nome curto; **Descrição**; Predecessores / Depende de / PRE; Otimista / Mais provável / Pessimista (ou O / M / P); Duração; Responsável / Principais responsáveis; Custo; % concluído; Início real; Término real; Custo real.
- **Ação × rótulo:** se houver coluna de rótulo, ela vira o nome curto (`name`) e a coluna Ação vira a descrição (`desc`). Sem rótulo, a Ação vira o nome. A coluna "Entrega" não é mais confundida com a ação.
- A planilha da PI², copiada a partir da linha de títulos, é reconhecida por completo pela aba Importar.
- Sem cabeçalho reconhecível, as colunas são lidas na ordem: código, ação, predecessores, O, M, P.
- Sem coluna de código, ele é extraído do início do nome ("LEV - Levantamento…"). Na falta, reaproveita o código de uma ação já existente com o mesmo nome; se não houver, é gerado automaticamente (seção 4.8), com aviso na conferência.
- Responsáveis são associados à lista pelo nome ou pela sigla. Os que não existem são cadastrados.
- Ações com código existente são atualizadas apenas nos campos presentes.

### 6.2 Mermaid

- Aceita `flowchart` e `graph`, com nós em formatos variados, setas `-->`, `---`, `==>` e `-.->`, rótulos de seta e encadeamentos com `&`.
- O identificador do nó vira o código; o texto do nó vira o nome.
- Não traz estimativas de prazo.

### 6.3 Exportação

- **Para planilha (TSV):** código, etapa, rótulo e ação, com datas calculadas, folga, indicação de "sem folga" e chance de ditar o prazo.
- **Mermaid:** rede com as ações sem folga destacadas.

### 6.4 Responsáveis em lote

- Uma pessoa por linha, no formato `Nome; Sigla; Setor`, ou colagem de planilha com cabeçalho em qualquer ordem.
- Nomes já cadastrados não são duplicados; só a sigla e o setor são atualizados, se informados.

---

## 7. Permissões e compartilhamento

- **Consulta:** qualquer pessoa com o endereço do site vê todos os planos, sem login.
- **Edição:** só usuários cadastrados pelo administrador no Firebase (Authentication → Usuários), que entram pelo botão **Entrar**.
- O cadastro por conta própria fica desativado no console do Firebase.
- Cada usuário pode trocar a senha pelo link "Esqueci a senha".
- Não há níveis diferentes de edição: quem tem login pode alterar e excluir qualquer plano. **Precisa ser corrigido antes da fase de produção** (ver seção 9).

---

## 8. Decisões tomadas

| Decisão | Motivo |
|---|---|
| Versão 2: semente e número de simulações definidos na criação do plano, visíveis e imutáveis; retratos guardam semente, simulações e versão do cálculo | Permite conferir os resultados por fora (planilha, Python, R) sem permitir trocar a semente para obter um número mais favorável |
| Versão 2: retratos com origem manual ou automática; automáticos não podem ser excluídos | Histórico contínuo para o Data Lakehouse; o automático depende do servidor da UFCI-MG |
| Versão 2: exclusão lógica (marcar como excluído) em planos, ações e responsáveis, em vez de apagar ou de registrar as exclusões à parte | Carga incremental com uma consulta só, possibilidade de desfazer, auditoria completa e retratos íntegros; o risco de itens excluídos reaparecerem é contido por um filtro único no `Store` e por teste automático |
| Dicionário de dados sempre atualizado, no mesmo commit de cada mudança no banco; na versão 2, com teste automático que compara código e dicionário | Facilita a compreensão do banco por quem vier depois e as cargas para o Data Lakehouse; o teste impede que código e documento divirjam |
| Monte Carlo como método principal de previsão; PERT clássico só como comparação | O PERT ignora caminhos paralelos e superestima a chance de cumprir o prazo. Na PI², o PERT dá 93% e a simulação, 74%, para 14/04/2027 |
| Distribuição triangular como padrão | Melhor relação custo-benefício e mais conservadora; beta-PERT fica disponível como opção |
| Ranking por SSI ("prioridade de atenção") | A criticidade, sozinha, orienta mal as ações; o SSI combina criticidade e incerteza |
| Índice de criticidade fora do Gantt | Confundia a leitura do cronograma; segue disponível na aba Previsões |
| SPI(t) como indicador de ritmo | O SPI tradicional converge para 1 no fim e esconde atrasos |
| Linguagem simples, com termo técnico em itálico | Usuários leigos; o termo técnico permite aprofundar |
| Lista de responsáveis global, com sigla | Reuso entre planos; a sigla atende espaços curtos, como diagramas PERT |
| Dependências e responsáveis por lista com busca | Evita erros de digitação e dependências circulares |
| Nome provisório "Sistema de Gerenciamento de Planos de Ação" | Definido pelo demandante; alternativas como "Baliza" ficaram registradas |
| Supabase descartado | O plano gratuito pausa projetos após 7 dias de pouca atividade |
| Manual ilustrado congelado até a estabilização do sistema | Evitar retrabalho: as telas mudam a cada melhoria. A documentação técnica segue sendo atualizada a cada mudança |
| Firebase como backend fora do Claude; servidor institucional como meta | Não pausa por inatividade e tem login próprio; o servidor da UFCI-MG é a solução mais sólida para uso oficial |
| Repositório na organização GitHub "DGDI \| UFCI-MG" (`dgdi-ufci-mg`) | Colaboração sem depender do Claude; não depende de conta pessoal; independe do espaço institucional da universidade |
| Licença GPL v3 | Escolha do demandante: quem modificar e redistribuir deve manter o código aberto |
| Consulta aberta, edição só com usuário criado pelo administrador | Transparência dos planos sem abrir mão do controle sobre alterações |

---

## 9. Pendências e próximos passos

**Reescrita em preparação (versão 2):** as decisões estão em [`especificacao-reescrita.md`](especificacao-reescrita.md). Até a versão 2 entrar no ar, este documento continua descrevendo o sistema atual.

**Obrigatório antes da fase de produção:**

- **Níveis de permissão.** Hoje, qualquer usuário com login pode alterar e excluir qualquer plano (ver seção 7). Antes do uso oficial, é preciso definir perfis de acesso, por exemplo: administrador; responsável por um plano; colaborador que só atualiza o andamento das próprias ações. Isso exige mudar o `firestore.rules` e o sistema. Desde já, recomenda-se cadastrar no Firebase só pessoas de confiança e manter cópias de segurança periódicas.

- **Edição simultânea (versão 1).** Três falhas, de risco baixo enquanto poucas pessoas editam: (a) responsáveis e "depende de" são regravados como lista inteira, e dois acréscimos simultâneos podem perder um deles; (b) o código de uma ação nova é conferido só na tela de quem cria, e duas criações simultâneas com o mesmo código apagam a primeira em silêncio; (c) duas mudanças no mesmo campo valem pela última, sem aviso. A correção está na seção 4.6 da [`especificacao-reescrita.md`](especificacao-reescrita.md) e entra na versão 2.

**Pontos para reavaliação (decisões da versão 2):** data de liberação de ações criadas depois ("Não começa antes de") e estimativa livre antes da liberação. Detalhes e alternativas em [`especificacao-reescrita.md`](especificacao-reescrita.md), seção 14. Reavaliar com o sistema em uso.

**Melhorias:**

1. **Etapas:** o campo já existe no cadastro e na tabela de ações. Falta uma visão para renomear uma etapa em todas as ações de uma vez e definir a ordem das etapas.
2. Avaliar baixar o diagrama como imagem.
3. Registrar o andamento real da PI² (% concluído das ações atrasadas e em andamento) e definir a data de status.
4. Avaliar um registro de alterações (quem mudou o quê e quando).
5. Ao final das melhorias, refazer as telas e revisar o manual ilustrado e o manual em texto.

**Ideias futuras:**

- **Previsão por classe de referência** (*reference class forecasting*). Objetivo: combater a **falácia do planejamento**, a tendência de subestimar prazos ao olhar só para o caso em mãos (a "visão de dentro"), descrita por Kahneman e Tversky. A correção proposta por Kahneman e Lovallo, e transformada em método por Flyvbjerg, é a "visão de fora": partir do que de fato aconteceu em casos semelhantes. Proposta em dois níveis:
  1. **Alerta:** ao estimar uma ação, o sistema mostra quanto, nas ações já concluídas, o prazo real superou o estimado. Exemplo: "Nas ações concluídas, o prazo real foi, em média, 40% maior que o mais provável."
  2. **Sugestão de estimativa:** o sistema propõe os três pontos já corrigidos pela razão entre prazo real e estimado, observada em ações semelhantes (mesma equipe, responsável ou tipo de ação). Quando houver poucos dados de um grupo, usa a média geral e se aproxima do grupo conforme os dados aumentam (estimativa bayesiana hierárquica).
  - **Dados necessários:** as estimativas originais e as datas reais de liberação e conclusão. O histórico de reestimativas, previsto na reescrita, fornece exatamente isso. Por isso, ele deve guardar a estimativa original de cada ação e todas as revisões.
  - Referências: KAHNEMAN, D.; TVERSKY, A. Intuitive prediction: biases and corrective procedures (1979); LOVALLO, D.; KAHNEMAN, D. Delusions of success. *Harvard Business Review* (2003); FLYVBJERG, B. From Nobel Prize to project management: getting risks right. *Project Management Journal* (2006); KAHNEMAN, D. *Rápido e devagar* (2011).
- **Aplicativo para celular, com acesso restrito à instituição.** Objetivo: distribuição gratuita, com uso só por pessoas da UFCI-MG. Proposta em etapas:
  1. **Primeiro, aplicativo instalável pelo navegador** (*Termo técnico: PWA, progressive web app*): manifesto e ícones para instalar o site na tela inicial do Android e do iPhone, sem lojas, sem custo e sem revisão da Apple ou do Google.
  2. **Restrição pelo login, não pela loja.** Mesmo a distribuição "não listada" da Apple deixa o app disponível para quem tiver o link. O controle de acesso fica no Firebase: mudar o `firestore.rules` para exigir login também na leitura (hoje pública, ver seção 7) e, se desejado, aceitar só e-mails do domínio institucional.
  3. **Lojas, se necessárias:** empacotar o site (por exemplo, com o Capacitor). **iPhone:** distribuição não listada, que exige aprovação na revisão da Apple, conta de teste para os revisores e funções além de um site embrulhado. **Android:** publicação comum na Play Store, com login obrigatório; a opção "privada" exige celulares gerenciados pela instituição.
  - **Custos e conta:** o programa de desenvolvedor da Apple é anual (US$ 99), com isenção para instituições de ensino e órgãos públicos só em alguns países; verificar se o Brasil está incluído. O Google cobra taxa única. As contas devem ser da instituição (CNPJ), não pessoais.
  - **Quando:** depois da versão 2 estabilizar ou da migração para o servidor institucional. A restrição da leitura depende de decisão do responsável, porque muda a regra atual de consulta aberta (seção 8).

---

## 10. Histórico de versões da página

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
| 27 | Especificação da reescrita: regras de edição simultânea (seção 4.6), que fecham três falhas da versão 1: listas regravadas inteiras, código de ação nova conferido só na tela e sobrescrita silenciosa. Sem mudança no sistema |
| 28 | Especificação da reescrita: preparação para a troca de banco (seção 3.4): `Store` com operações do sistema, um arquivo por banco em `js/banco/`, testes como contrato e cópia de segurança como ponte; seção 4.6 sem termos do Firestore. Sem mudança no sistema |
| 29 | Regra do dicionário de dados: toda mudança na estrutura do banco é registrada na seção 5 (e, na versão 2, na seção 4 da especificação) no mesmo commit; teste automático do dicionário previsto para a versão 2. Sem mudança no sistema |
| 30 | Especificação da reescrita: exclusão lógica de planos, ações e responsáveis (seção 4.7), com lixeira e teste automático. Sem mudança no sistema |
| 31 | Especificação da reescrita: semente e simulações imutáveis e visíveis, com versão do cálculo; retratos manuais e automáticos. Sem mudança no sistema |
| 32 | Especificação da reescrita: seção 16, ampliação do escopo em discussão (tipos de plano, situações personalizadas, papéis e visibilidade, arquivamento, histórico de alterações, checklist, comentários, relatórios). Sem mudança no sistema |
| 26.1 | Ideia futura registrada: aplicativo para celular (instalável pelo navegador e, se necessário, nas lojas), com acesso restrito à instituição pelo login. Sem mudança no sistema |

### Notas de implementação recentes

- **Seletores com busca (`picker`)**: componente único para dependências (`kind=pred`) e responsáveis (`kind=own`). A lista suspensa (`#pick`) é um elemento fixo no `body`, posicionado pelo retângulo do campo, para não ser cortada pelas tabelas com rolagem. Cada inclusão ou remoção grava na hora (`preds` ou `owners`).
- **Proteção contra re-renderização durante a digitação**: painéis marcados com `data-live` adiam a atualização da tela enquanto o foco está num campo deles; a atualização ocorre ao sair do campo.
- **Capturas do manual**: geradas com Playwright e Chromium sobre a página em modo local, com um plano fictício injetado e as fontes servidas localmente. O roteiro está na pasta de trabalho da sessão (`man/shoot.py`) e pode ser reaproveitado na revisão do manual.

## 11. Referências

- VAN SLYKE, R. M. Monte Carlo methods and the PERT problem. *Operations Research*, v. 11, n. 5, 1963.
- WILLIAMS, T. M. Criticality in stochastic networks. *Journal of the Operational Research Society*, v. 43, n. 4, 1992.
- LIPKE, W. Schedule is different. *The Measurable News*, 2003.
- PROJECT MANAGEMENT INSTITUTE. *Practice Standard for Project Risk Management*. 2009.
- VANHOUCKE, M. Using activity sensitivity and network topology information to monitor project time performance. *Omega*, v. 38, n. 5, 2010.
- ELMAGHRABY, S. E. On criticality and sensitivity in activity networks. *European Journal of Operational Research*, v. 127, 2000.
