# Especificação da reescrita (versão 2)

**Situação:** em revisão pelo responsável. Nada aqui está implementado ainda.
**Data:** 16/10/2026

Este documento reúne as decisões tomadas para a reescrita do sistema. A reescrita segue este texto. Quando a versão 2 entrar no ar, o conteúdo daqui passa para a `documentacao-tecnica.md`, e este arquivo é apagado.

---

## 1. Por que reescrever

- **Código difícil de revisar.** O `index.html` atual foi feito em etapas, como artefato do Claude: são 1.300 linhas compactas, com nomes curtos. A cada versão, limpar fica mais caro.
- **O modelo de acompanhamento mudou.** Saem o valor agregado e o Earned Schedule. Entram situações, reestimativas com histórico, retratos e notas. Reformar o código atual seria limpar partes que serão descartadas.
- **Não é do zero.** A lógica já testada é mantida e reescrita de forma legível: calendário de dias úteis, caminho crítico, Monte Carlo, roteamento das linhas do diagrama e conexão com o Firebase.

---

## 2. Princípios

- **KISS** ("mantenha simples"): a solução mais simples que resolve o problema é a melhor.
- **YAGNI** ("você não vai precisar disso"): nada é construído antes de haver necessidade real.
- **Código limpo:** nomes claros, funções pequenas, um assunto por arquivo, sem duplicação e sem código morto. Código que perde a função é apagado, não escondido; o histórico do Git guarda tudo.
- **Só pedir o necessário:** o usuário informa apenas dados que o sistema usa. Exemplo: a data de início real de uma ação não é pedida, porque não entra em nenhum cálculo.
- **Aceitar o mundo real:** o sistema absorve registros atrasados, reprogramações e imprecisões sem travar o usuário. Exemplo: a data de conclusão pode ser registrada com qualquer data, mesmo passada.
- **Linguagem simples:** mantém-se o princípio atual. Termo técnico em itálico, como "Termo técnico: …", e clicável, abrindo a explicação na Ajuda.
- **Números contínuos, não categorias:** indicadores contínuos aparecem como barras, com o número discreto em cinza. Cortes arbitrários, como "acima de 50% é prioritária", são evitados, porque tratam como diferentes casos praticamente iguais (paradoxo de sorites). Carimbos ficam só para fatos binários, como "Atrasada".

---

## 3. Arquitetura

### 3.1 Arquivos, sem compilação

O sistema passa de um arquivo único para **poucos arquivos por assunto**, carregados direto pelo navegador como módulos JavaScript (`<script type="module">`). Não há etapa de compilação, npm nem *framework*. Os motivos estão na seção 10.

Estrutura prevista:

```
index.html            estrutura da página
css/estilo.css        aparência, variáveis de cor, temas claro e escuro
js/calendario.js      dias úteis e feriados
js/calculo.js         estimativas, caminho crítico, situações (funções puras, sem tela)
js/simulacao.js       Monte Carlo (funções puras)
js/dados.js           Store: operações do sistema, sem termos de banco (seção 3.4)
js/banco/firestore.js como o Firestore executa cada operação
js/banco/local.js     o mesmo, em memória (modo local e testes)
js/acesso.js          login, menu do usuário
js/markdown.js        formatação segura das notas
js/telas/*.js         uma tela por arquivo: acoes, visualizacao, responsaveis, configurar, ajuda
js/app.js             estado, navegação, partida
testes/*.test.js      testes automáticos (node --test)
```

- **Funções puras:** cálculo e simulação não acessam a tela nem o banco. Recebem dados e devolvem resultados. Isso permite testá-las com o Node, sem navegador.
- **Tipos por comentários (JSDoc):** cada função tem, acima dela, a descrição do que recebe e devolve. Editores e a verificação do TypeScript (`tsc --checkJs`) apontam erros sem exigir compilação.
- **Bibliotecas externas:** continuam só por CDN e com versão fixa: dagre 0.8.5 e Firebase compat 10.14.1.
- **Teste local:** módulos não abrem com clique duplo no arquivo. É preciso um servidor simples, por exemplo `python3 -m http.server`. O README e o AGENTS.md serão atualizados.
- **Modo legado do artefato do Claude:** removido.

### 3.2 Testes

- **Testes de unidade** das funções de calendário, cálculo, simulação e Markdown, com `node --test`, sem dependências.
- **Teste de comparação:** o plano da PI² precisa produzir, na versão 2, as mesmas datas do caminho crítico da versão atual, já que essa regra não muda. As probabilidades mudam por causa da troca para a beta-PERT; os novos valores são registrados como referência.
- **Teste do dicionário de dados:** compara os campos usados pelo código (tipos JSDoc do modelo) com os da seção 4 e falha se divergirem. Roda com os demais, em toda mudança.
- **Teste visual:** capturas de tela das três abas, nos temas claro e escuro e na largura de celular.

### 3.3 Fluxo de trabalho

A reescrita é feita numa **branch separada**. O site atual continua no ar. Quando a versão 2 estiver pronta, ela entra na `main` por *pull request*, depois da aprovação do responsável. É a exceção à regra "uma mudança por vez".

### 3.4 Preparação para a troca de banco

A meta de longo prazo é hospedar o sistema no servidor da UFCI-MG, com PostgreSQL. A versão 2 não faz essa troca, mas não pode dificultá-la.

- **O `Store` fala a língua do sistema, não a do banco.** Oferece operações com nomes do domínio, como `criarAcao`, `alterarCampo`, `acrescentarResponsavel`, `retirarResponsavel`, `registrarEstimativa`, `concluirAcao`, `salvarRetrato` e `acompanharPlano`. Nenhum termo do Firestore (coleção, documento, `onSnapshot`, `arrayUnion`) aparece fora de `js/banco/firestore.js`.
- **Cada banco é um arquivo** em `js/banco/`, que executa as mesmas operações. Hoje: Firestore e memória local. Depois: um que conversa com o servidor da UFCI-MG.
- **As regras de edição simultânea (seção 4.6) são do sistema.** No Firestore, viram transações e acréscimos em listas. No PostgreSQL, viram restrições do próprio banco, como código único por plano, tabelas de ligação para responsáveis e dependências, e conferência da última alteração antes de gravar.
- **Tempo real como operação, não como recurso do banco.** `acompanharPlano` avisa a tela quando algo muda. No Firestore, isso vem pronto. No servidor, pode começar com consultas periódicas, por exemplo a cada 10 segundos.
- **Os mesmos testes para todos os bancos.** Os testes de `node --test` rodam contra o banco em memória e servem de contrato: um banco novo precisa passar neles.
- **A cópia de segurança é a ponte.** O arquivo da cópia tem formato próprio, independente do banco, e documentado. A troca será: exportar do Firebase, importar no servidor e conferir com o teste de comparação.

Fica para a época da troca, fora da versão 2: o programa do servidor, que passa a conter as permissões hoje no `firestore.rules` (já com os níveis de permissão pendentes), e o login institucional, que exigirá recadastrar os usuários.

---

## 4. Modelo de dados

### 4.1 Plano: `projects/{id}`

| Campo | Descrição |
|---|---|
| nome | Nome do plano |
| inicio | Data de início do plano |
| prazoFinal | Prazo final (por exemplo, o fixado por ato da Diretoria-Geral) |
| datasExcluidas | Lista `{data, motivo}`: feriados e outras datas sem expediente, cada uma com o motivo, para conferência posterior |
| documentos | Lista `{nome, data, link}`: documentos do plano, como o plano aprovado e revisões, guardados por link (por exemplo, no SEI) |
| simulacoes | Número de simulações (padrão 10.000). Definido na criação do plano e **imutável** depois |
| semente | Semente da simulação (padrão 20261014). Definida na criação do plano e **imutável** depois |
| estrutura | Lista de **fases**, cada uma com sua lista de **etapas**: `[{id, nome, etapas:[{id, nome}]}]`, na ordem de exibição (seção 8.3) |
| camposOpcionais | Quais campos opcionais o plano usa: fases e etapas, descrição, entrega e notas. Desligados, eles somem do formulário, da tabela e das exportações, mas os dados já gravados são mantidos |
| criadoEm | Data e hora de criação |
| excluidoEm, excluidoPor | Exclusão lógica (seção 4.7). Vazio: plano ativo |

Saem: `dist` (escolha de distribuição), `statusDate` (a data de referência é sempre hoje), `baseline` (substituído pelos retratos) e `nearCrit` (a categoria "quase sem folga" deixa de existir; ver seção 7.3).

### 4.2 Ação: `projects/{id}/acoes/{código}`

| Campo | Descrição |
|---|---|
| codigo | Identificador único. Não muda depois de criado |
| ordem | Ordem de exibição |
| etapa | Id da etapa a que a ação pertence (e, por ela, a fase). Vazio: ação sem fase nem etapa |
| rotulo | Nome curto, usado no cronograma e no diagrama |
| descricao | Descrição completa |
| entrega | Entrega esperada (coluna "Entrega" da planilha da PI²). Campo opcional |
| dependeDe | Lista de códigos das ações anteriores |
| responsaveis | Lista de ids de responsáveis |
| estimativas | Histórico de estimativas, da primeira à mais recente (seção 5.3) |
| concluidaEm | Data de conclusão, ou vazio |
| naoAntesDe | Data mínima de liberação, opcional (seção 5.1) |
| criadaEm | Data de criação da ação |
| notas | Texto em Markdown (seção 8.5) |
| alteradaEm, alteradaPor | Momento e autor da última gravação (seção 4.6) |
| excluidaEm, excluidaPor | Exclusão lógica (seção 4.7). Vazio: ação ativa |

Saem: custo, custo gasto, % concluído, início real e término real separado.

### 4.3 Estimativa: cada item de `estimativas`

| Campo | Descrição |
|---|---|
| em | Data em que a estimativa foi feita |
| por | Usuário que a registrou |
| o, m, p | Otimista, mais provável e pessimista, em dias úteis |
| contaDe | `"liberacao"` (a primeira estimativa conta da liberação) ou `"data"` (reestimativas contam do dia `em`) |
| motivo | Opcional |

A primeira estimativa nunca é alterada. Corrigir um erro de digitação logo após cadastrar substitui a estimativa mais recente, sem criar histórico, desde que seja no mesmo dia e antes de qualquer reestimativa.

### 4.4 Retrato: `projects/{id}/retratos/{id}`

| Campo | Descrição |
|---|---|
| nome | Por exemplo, "Plano aprovado" ou "Replanejamento de dezembro" |
| criadoEm, criadoPor | Data e autor |
| acoes | Cópia, para cada ação, de: estimativa vigente, datas previstas de liberação e conclusão, dependências e situação |
| resumo | Conclusão prevista, data segura e chance de cumprir o prazo naquele momento |
| origem | `"manual"` (salvo por um administrador do plano) ou `"automatico"` (salvo pelo sistema, na periodicidade definida pelo Administrador do Sistema). Na tela, cada origem tem um selo próprio |
| semente, simulacoes, versaoCalculo | Parâmetros usados, para que o cálculo possa ser refeito igual no futuro |

Retratos são só leitura: servem para comparar e conferir. Os **automáticos não podem ser excluídos** à mão, para o histórico usado no Data Lakehouse não ter buracos. O retrato automático depende de um programa que rode sozinho no servidor; por isso, chega com o servidor da UFCI-MG (seção 3.4). No Firebase gratuito, só há retratos manuais.

### 4.5 Responsável: `people/{id}`

Lista global, com cadastro livre, como hoje: nome, sigla e setor, mais `excluidoEm` e `excluidoPor` (exclusão lógica, seção 4.7). Um responsável pode ser de dois tipos, sem que o sistema precise distingui-los por um campo próprio:

- **Membro da equipe com acesso ao sistema:** tem o campo opcional **usuario**, o e-mail de login ligado a ele. Para esses, funcionam o filtro "Minhas ações" e, no futuro, os níveis de permissão.
- **Responsável diverso:** pessoa de fora do sistema, unidade organizacional, equipe ou grupo de unidades. Fica sem `usuario`. É cadastrado livremente, inclusive direto no formulário da ação ("Cadastrar … como responsável").

### 4.6 Edição simultânea

Várias pessoas podem editar o mesmo plano ao mesmo tempo. Nenhuma gravação pode apagar, em silêncio, o trabalho de outra pessoa. A versão 1 já grava só o campo alterado e mostra as mudanças em tempo real; a versão 2 mantém isso e fecha três falhas encontradas na versão 1 em 17/10/2026 (registradas em "Pendências" da documentação técnica).

| Situação | Regra |
|---|---|
| Duas pessoas mudam campos diferentes | Cada gravação leva só o campo alterado, nunca a ação inteira |
| Responsáveis e "depende de" | Acrescentar e retirar itens um a um, nunca regravar a lista inteira. Assim, se duas pessoas acrescentam responsáveis ao mesmo tempo, os dois ficam |
| Reestimativa | Entra no fim do histórico, sem regravar as anteriores. A correção de digitação da seção 4.3, que substitui a mais recente, só grava se ninguém tiver acrescentado outra estimativa nesse meio-tempo |
| Ação nova | Criada só se o código estiver livre no banco, e não só na tela de quem cria. Se outra pessoa criou o mesmo código antes, aparece "Já existe uma ação com o código X. Escolha outro." |
| Mesmo campo, mesma ação, quase juntas | Vale a última gravação, mas sem surpresa: se a ação aberta na janela for alterada por outra pessoa, a janela mostra "Fulano alterou esta ação agora" e atualiza os campos que não estão sendo editados. O campo em edição fica como está, e a pessoa decide se grava |
| Importação, restauração e regravação de ações inteiras | Só em operações explícitas, com confirmação, e nunca durante a edição comum |

Os campos `alteradaEm` e `alteradaPor` (seção 4.2) servem para o aviso. As regras dizem o que garantir, não como: cada banco as executa do seu jeito (seção 3.4). No modo local há um usuário só. Cada regra tem um teste em `node --test`, com duas gravações concorrentes simuladas.

### 4.7 Exclusão lógica

Nada é apagado de verdade pelo uso comum do sistema. Excluir um plano, uma ação ou um responsável grava **quando** e **quem** excluiu (`excluidoEm`/`excluidaEm` e `excluidoPor`/`excluidaPor`), e o item some da tela.

- **Um único filtro, no `Store`.** As operações comuns (listar ações, calcular, exportar) devolvem só itens ativos. Ver os excluídos exige pedir explicitamente: a lixeira, a cópia de segurança e as cargas para o Data Lakehouse. Como nenhuma outra parte do código lê o banco (seção 3.4), o filtro existe num lugar só.
- **Teste automático:** um plano de exemplo com uma ação excluída; o teste confere que ela não aparece na lista, no quadro, no cálculo, na simulação nem nas exportações, e que aparece na lixeira e na cópia de segurança.
- **Desfazer:** a lixeira do plano mostra as ações excluídas, com quem e quando, e permite restaurá-las.
- **Código ocupado:** o código de uma ação excluída continua reservado. Ao tentar criar uma ação com ele, o sistema oferece restaurar a antiga.
- **Carga incremental:** `alteradaEm` muda também na exclusão, para que a carga perceba.

Motivos da escolha, em vez de uma lista separada de exclusões: uma única consulta para a carga incremental, possibilidade de desfazer, auditoria completa (inclusive o conteúdo do que foi excluído) e retratos antigos que continuam mostrando o nome das ações.

---

## 5. Regras de cálculo

### 5.1 Contagem do tempo

- Prazos em **dias úteis**, descontadas as datas excluídas do plano.
- Uma ação é **liberada** quando todas as anteriores estão concluídas. Sem ações anteriores, é liberada no início do plano.
- **"Não começa antes de" (data mínima, opcional).** A ação só é liberada quando todas as anteriores estiverem concluídas **e** essa data tiver chegado. Liberação = a mais tardia entre a conclusão das anteriores e a data mínima. É o mesmo conceito da restrição "não iniciar antes de" do MS Project, numa forma simples.
  - **Nova ação:** o campo já vem preenchido com a data de criação. Assim, uma ação criada depois que as anteriores terminaram não nasce atrasada. O usuário pode apagar a data, se a ação puder começar assim que as anteriores terminarem.
  - **Outros usos:** ações que dependem de uma data externa, como liberação de orçamento, início do semestre ou publicação de um ato.
  - Enquanto a data não chega, a ação fica "Aguardando", com a indicação "a partir de dd/mm".
  - **Na janela da ação:** o campo só aparece quando tem data. Vazio, dá lugar a um link discreto, "+ Definir data mínima de início", que abre o campo. Em ações concluídas, não aparece.
  - **Em reavaliação** (seção 14, item 1).
- **O prazo de uma ação conta da liberação até a conclusão**, incluindo o tempo até alguém começar. A data de início real não é registrada. Isso precisa estar claro no formulário de estimativa e na Ajuda.

### 5.2 Estimativa de cada ação

- Fórmula PERT: (O + 4M + P) / 6, a média da distribuição beta-PERT.
- **Uma só distribuição em todo o sistema: beta-PERT.** A escolha entre triangular e beta é retirada. Motivos: coerência entre as datas do cronograma e a simulação, simplicidade para o usuário leigo e estabilidade das datas e carimbos. O otimismo nas estimativas será tratado pela previsão por classe de referência, não por troca de fórmula.

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
- **Semente e número de simulações visíveis, mas imutáveis.** São definidos na criação do plano (pelo usuário ou com o padrão) e aparecem em "Configurar este plano" só para leitura. Assim, qualquer pessoa ou IA pode conferir os resultados por fora, em planilha, Python ou R, e ninguém pode trocar a semente até o número "ficar bonito".
- **Conferência por fora:** a seção 15 deve documentar, junto com o código da versão 2, o gerador de números (mulberry32), a ordem dos sorteios e o método de sorteio da beta-PERT, para permitir reproduzir os resultados **exatamente**. Uma ferramenta com outro gerador chega a resultados estatisticamente equivalentes, com diferença da ordem de meio ponto percentual na chance de cumprir o prazo.
- **Versão do cálculo:** se um dia o método de cálculo mudar (por exemplo, a correção de um erro), a mesma semente passa a dar outro resultado. Por isso, o código tem um número de versão do cálculo, guardado em cada retrato.
- Ações concluídas: duração real. Ações reestimadas: a contagem começa na data da reestimativa. Regra da seção 5.5 aplicada.
- **Resultados do plano:** datas P50, P80 e P95 da conclusão, chance de cumprir o prazo final e distribuição das datas finais (gráfico).
- **Resultados por ação:** índice de criticidade (seção 7.1) e contribuição para a variância do prazo (seção 7.2). Fórmulas e justificativas na seção 15.
- **Saem da tela o SSI e a crucialidade** como números próprios. A contribuição para a variância é a forma padrão e mais comunicável de responder à pergunta que os dois respondiam (seção 15.4).

---

## 6. Situações e carimbo

### 6.1 Situação: exatamente uma

| Situação | Quando |
|---|---|
| **Aguardando** | Alguma ação anterior não foi concluída |
| **Liberada** | Todas as anteriores concluídas (ou nenhuma anterior), e esta não concluída |
| **Concluída** | Tem data de conclusão |

### 6.2 Carimbo **Atrasada**

- Aplica-se à ação **liberada** cuja data prevista de conclusão (PERT da estimativa mais recente) já passou.
- O atraso é medido contra a **estimativa mais recente**, de propósito. A reestimativa tira o carimbo. É uma "colher de chá" ao executor, que exige dele uma atitude ativa (assumir uma nova data). O histórico de reprogramações registra a dimensão do problema.
- Uma ação aguardando nunca recebe o carimbo, porque, pela regra da seção 5.5, a previsão das anteriores não fica no passado.
- Não existe mais o carimbo "Prioritária": a prioridade é mostrada pela barra contínua da seção 7.1.

---

## 7. Indicadores por ação

Barras horizontais, com o número em cinza ao lado. A tabela pode ser ordenada por qualquer uma delas.

### 7.1 Prioridade de execução

*Termo técnico: índice de criticidade.*

Legenda: "Quanto um atraso nesta ação atrasa o fim do plano. Por exemplo, com 70%, cada dia de atraso nesta ação atrasa o plano em cerca de 0,7 dia. Considera só o prazo final; outros motivos de prioridade ficam a critério da equipe."

Fundamento: em cada simulação, um dia a mais numa ação atrasa o fim do plano em um dia se ela estiver no caminho crítico, e em zero se não estiver. A média é o índice de criticidade. Por isso ele mede exatamente o efeito esperado de um atraso.

### 7.2 Prioridade de revisão do planejamento

*Termo técnico: contribuição para a variância do prazo.*

Legenda: "Esta ação responde por 18% da incerteza do prazo final. Quanto maior, mais vale revisar as estimativas, dividir a ação ou reduzir riscos." (o número é o da ação)

- **O que mostra:** a parcela da incerteza do prazo final que vem de cada ação. As parcelas de todas as ações não concluídas somam 100%.
- **Número em cinza:** a parcela em porcentagem inteira; abaixo de 1%, aparece "<1%".
- **Barra:** proporcional à parcela, numa escala fixa de 0% a 100%. Assim, a barra e o número dizem a mesma coisa, e o tamanho da barra pode ser comparado entre planos.
- **Fundamento:** é a medida padrão das ferramentas de análise de risco de cronograma (gráfico "tornado"). Uma ação previsível no caminho crítico tem prioridade de execução alta e parcela quase nula: não há incerteza nela para reduzir. Detalhes matemáticos na seção 15.
- **Natureza relativa:** a parcela compara as ações entre si. Isso é adequado aqui, porque a barra serve para ordenar onde revisar o planejamento, não para disparar alertas.

### 7.3 Cores no fluxo e no cronograma

- **Intensidade contínua pela prioridade de execução:** a cor de cada ação não concluída varia gradualmente do **cinza** (índice de criticidade 0%) ao **vermelho** (100%). Quanto mais vermelha, mais um atraso nela atrasa o plano.
- **Verde:** ação concluída.
- Saem as categorias "sem folga", "quase sem folga" e "com folga", o limite de 10 dias (`nearCrit`) e as setas vermelhas do caminho crítico determinístico. Tudo passa a seguir uma única medida, a mesma da barra da seção 7.1. Isso evita que uma ação apareça como "crítica" numa tela e com prioridade baixa em outra.
- A folga em dias úteis continua visível como número, no detalhe da ação e no rótulo do fluxo.
- A legenda mostra a faixa de cores, de cinza a vermelho, com "menos prioritária" e "mais prioritária" nas pontas.
- As cores do gradiente seguem a paleta do logotipo e são ajustadas para o tema escuro.

### 7.4 Símbolos

Os mesmos da planilha da PI², no fluxo, no cronograma e na aba Ações:

| Símbolo | Significado |
|---|---|
| ✅ | Concluída |
| 🔓 | Liberada |
| ⏰ | Atrasada |
| (nenhum) | Aguardando |

Saem o símbolo "▶ em andamento", porque o sistema não registra mais o início real, e o "❗ prioritária", substituído pela intensidade da cor.

---

## 8. Interface

### 8.1 Topo

- **Barra do aplicativo compacta, com dois estados**, como no Spotify do iPhone: **no topo da página**, sem rolagem, fica **levemente mais escura** que o fundo da página (cerca de 18% mais escura no tema claro e 30% no escuro, sem tom verde), com os textos na cor normal; **ao rolar**, transforma-se suavemente em **vidro bem transparente** (cerca de 20% de véu no tema claro e 30% no escuro), que desfoca o conteúdo que passa por baixo, com uma linha fina na base e uma sombra suave. **A ida e a volta são simétricas**: a mesma transição de 0,3 s, com o mesmo desfoque nos dois estados (só a cor, a linha e a sombra mudam), para a volta ao topo ser o inverso exato da descida. Fica fixa no alto, com 48 px de altura. Reúne numa linha: logotipo e nome do sistema, menu do plano (nome do plano aberto, com uma setinha) e menu do usuário (iniciais). A Ajuda não tem botão próprio na barra: fica no menu do usuário, para poluir menos a tela. No celular, o nome encolhe para "Planos de Ação"; **no celular na vertical, logotipo e nome somem**, e o menu do plano ocupa o espaço (KISS). Quem ativou "Reduzir transparência" no sistema, ou usa navegador sem suporte ao desfoque, vê a barra opaca, na cor de fundo da página. Objetivo: o máximo de tela para as ações.
- **Ferramentas da lista no computador:** filtros de situação, Lista ou Editar em planilha, Minhas ações, responsável, ordenação, Recolher fases, Legenda e Nova ação. A legenda de cores e símbolos fica escondida até ser aberta.
- **Ferramentas da lista no celular**, em uma só linha: os filtros de situação numa faixa que rola para o lado e um botão **"Filtros e ordem"**, que mostra quantas opções estão ativas. Ele abre um painel que sobe de baixo, com: Minhas ações, responsável, ordenação, recolher ou expandir fases, legenda e "Limpar filtros e ordem". **Nova ação** vira um botão flutuante (+) no canto inferior direito. A edição em planilha fica só no computador. Nos cartões de ações concluídas, as barras de prioridade, sem uso, não aparecem.

- Logotipo, nome do sistema e instituição.
- **Menu do plano:** junta o seletor de plano e "Configurar o plano", que deixa de ter botão próprio (engrenagem). Ao tocar no nome do plano, abre uma lista com os planos (✓ no plano aberto), uma linha divisória, "Configurar este plano" e "Novo plano" (nome, datas e prazo final). Sem login, mostra só a lista de planos. Segue o padrão de troca de espaço de trabalho do Slack e do Notion. Custo aceito: configurar passa a exigir dois toques, e a lista deixa de ser a nativa do celular. Busca na lista só quando houver muitos planos (YAGNI).
- **Ajuda:** painel dentro do sistema, aberto pelo item "Ajuda e manual" do menu do usuário ou pelos links "o que é?" da tela. Contém o glossário, que antes era a aba "Entenda os termos", e, futuramente, o manual. Cada "Termo técnico" na tela abre a explicação correspondente.
- **Configurar o plano** (item "Configurar este plano" do menu do plano): painel lateral com: dados do plano (nome, datas, prazo final, datas excluídas com motivo); campos opcionais em uso; documentos do plano; retratos (salvar e listar); importar e exportar; cópia de segurança.
- **Menu do usuário:** seus dados (e-mail, nome, responsável ligado), Ajuda e manual, trocar senha (pede a senha atual), sair. Sem login, o lugar das iniciais mostra um ícone de pessoa, e o menu traz só "Ajuda e manual" e "Entrar", para quem só consulta não perder o acesso à Ajuda.
- **Configurar o sistema:** reservado para o futuro (por exemplo, gestão de usuários e permissões). O nome "Configurar o plano" evita confusão com ele.

### 8.2 Abas

**Ações · Visualização · Responsáveis**, em ordem de frequência de uso.

### 8.3 Aba Ações

Reúne o cadastro, o acompanhamento e as previsões por ação, como na planilha da PI².

- **Fases e etapas como separadores**, como na gestão clássica de projetos (estrutura analítica): fase > etapa > ações. Cada separador mostra o nome, o número de ações, quantas foram concluídas, as atrasadas e a data em que o grupo termina, com uma pequena barra de progresso. Fases e etapas podem ser **recolhidas e expandidas** com animação suave, e há um botão para recolher todas as fases. O aninhamento aparece por recuo leve. Ações sem etapa ficam num grupo "Sem fase nem etapa". O agrupamento vale na ordem "Ordem do plano"; nas ordenações por prioridade ou data, a lista fica corrida, para que a ordem escolhida prevaleça.
- **Fases e etapas são cadastradas em "Configurar o plano"** (criar e renomear; reordenar e excluir na versão final). Na ação, a etapa é escolhida numa lista agrupada por fase. O campo opcional "Fases e etapas" pode ser desligado; nesse caso, a lista fica sem separadores.
- **Animação dos filtros:** ao filtrar ou reordenar, as ações que continuam deslizam até a nova posição e as que entram aparecem suavemente. Respeita a preferência do sistema por menos movimento.
- **Linha compacta:** código e rótulo; situação e carimbo; responsáveis; conclusão prevista; as duas barras de prioridade.
- **Cada linha é um cartão** com leve sombra e cantos arredondados, para separar visualmente as ações. A faixa colorida à esquerda segue a cor de prioridade (seção 7.3).
- **Detalhe numa janela sobreposta**, ao tocar na linha, com o fundo escurecido, como no Todoist. Assim nenhum campo da lista fica escondido. A janela abre com uma animação curta. No celular, ela sobe da parte de baixo da tela e ocupa quase toda a altura.
- **Conteúdo da janela:** no topo, código, etapa e rótulo; um resumo com situação, conclusão prevista, responsáveis e as duas barras. Abaixo: descrição, entrega, dependências e notas; botões de reestimar e de registrar a conclusão; alerta da regra interna, quando houver; histórico de estimativas, com o resumo das reprogramações.
- **Fica fora da janela** o quadro de estimativa vigente com folga, data de liberação e fórmula: carga cognitiva sem uso prático. A estimativa vigente aparece como último item do histórico, e a fórmula fica na Ajuda.
- **No celular:** cada linha vira um cartão.
- Filtros: situação, responsável, "Minhas ações".
- **Edição no lugar, na janela:** cada campo (rótulo, etapa, descrição, entrega, dependências, responsáveis e notas) é editado ao ser clicado, com Salvar e Cancelar. A estimativa também, enquanto a ação aguarda (seção 5.3).
- **Nova ação numa janela central**, como no Todoist, com: rótulo; **código opcional** (se vazio, o sistema sugere um a partir do rótulo; se preenchido, precisa ter de 2 a 8 letras ou números e não pode repetir um código existente, com aviso enquanto se digita); etapa; descrição; entrega; dependências; responsáveis; três pontos de estimativa.
- **Seletores com busca** para dependências e responsáveis: ao digitar, aparecem as opções que contêm o texto (código ou nome da ação; nome, sigla ou setor da pessoa). Setas e Enter escolhem; cada escolha vira uma etiqueta com ×. Nas dependências, ficam de fora a própria ação e as que dependem dela, o que impede ciclos. Nos responsáveis, a última opção é "Cadastrar … como responsável".
- **Modo "Editar em planilha"**, ao lado da lista: uma grade com todas as ações e uma coluna por campo, para edição rápida por usuários experientes. Cada célula é salva ao sair dela; Enter desce para a linha de baixo; é possível colar um bloco copiado do Google Planilhas ou do Excel, inclusive criando linhas novas. Dependências e responsáveis são digitados como códigos e siglas separados por vírgula, com validação (código inexistente, ciclo, sigla desconhecida). Células que não podem ser editadas ali ficam cinza, com o motivo ao passar o mouse; por exemplo, a estimativa de uma ação liberada, que só muda por reestimativa.
- **Modo "Quadro"** (estilo Kanban, como o Trello), ao lado de Lista e Editar em planilha: os mesmos cartões em três colunas, **Aguardando**, **Liberadas** e **Concluídas**, cada uma com a contagem. "Atrasada" não é coluna: é o carimbo ⏰ no cartão, e o filtro "Atrasadas" continua disponível. O cartão mostra código, rótulo, etapa, responsáveis, conclusão prevista e a barra de prioridade de execução, com a faixa de cor à esquerda; tocar nele abre a janela da ação.
  - **Arrastar** (no computador): de Liberadas para Concluídas abre o registro da conclusão, com a data; de Concluídas para Liberadas desfaz a conclusão. A coluna Aguardando não aceita cartões, porque a liberação é automática (quando as anteriores terminam e a data mínima chega); a descrição da coluna explica isso.
  - **No celular:** as colunas ficam lado a lado, deslizando para o lado, uma por vez; a escolha entre Lista e Quadro fica no painel "Filtros e ordem". Concluir é feito pela janela da ação.
  - No Quadro, a lista não é separada por fases e etapas; a etapa aparece em cada cartão.
- **Edição nas linhas da lista:** feita pelo modo planilha. Na lista, tocar na linha abre a janela; tornar os campos da linha editáveis causaria edições acidentais, principalmente no celular.
- **O código não muda** depois de criado, porque é a referência usada nas dependências.
- **Protótipo antes da implementação:** esta aba será prototipada com dados fictícios e publicada como página de teste privada, para avaliação do responsável no computador e no celular.

### 8.4 Aba Visualização

No alto da aba fica a **linha do tempo do plano** (decisão do responsável: fora da aba Ações, para deixá-la mais limpa): um eixo **fino**, do início do plano ao prazo final, com a parte já decorrida, a marca de hoje e três pontos: **conclusão prevista**, **data segura** (P80) e **prazo final**. Uma faixa clara destaca o intervalo entre a conclusão prevista e a data segura. **As datas ficam na própria linha**, junto de cada marca, acima ou abaixo do eixo, distribuídas automaticamente para não se sobreporem; no celular, em formato curto (dia/mês). Uma legenda de uma linha explica só os símbolos, com a chance de cumprir o prazo junto ao prazo final. A linha do tempo fica sobre um fundo levemente esverdeado, com cantos arredondados, para se separar do resto do conteúdo.

Três botões no topo levam a cada parte:

- **Fluxo:** "Fluxo das ações". *Termo técnico: diagrama de rede (PERT/CPM).* É o diagrama atual, por etapas.
- **Cronograma:** Gantt, com opção de comparar com um retrato (linha fina sob cada barra).
- **Data final:** "Em que data o plano pode terminar", o gráfico da simulação de Monte Carlo.

### 8.5 Notas

- **Editor visual** (o que se vê é o que se obtém), com botões de negrito, itálico, link e lista, e os atalhos Ctrl+B, Ctrl+I e Ctrl+K. Por trás, a nota é guardada em **Markdown**, que pode ser levado para qualquer lugar. Ao salvar, o conteúdo do editor é convertido para Markdown, e só os elementos permitidos são mantidos. Texto colado entra sem formatação, para não trazer estilos de outros programas. Sem biblioteca externa.
- Aceita negrito, itálico, links, endereços da web automáticos, listas e quebras de linha.
- **Segurança:** o texto é sempre tratado como texto e só esses elementos são convertidos. Nenhum HTML digitado é executado. Links só para `http`, `https` e `mailto`, abrindo em nova aba. Sem biblioteca externa: o conversor é pequeno e próprio, com testes.

---

## 9. O que sai

| Item | Motivo |
|---|---|
| Valor agregado, Earned Schedule e o indicador "Ritmo" | Exigem % concluído e custos, raramente disponíveis; difíceis para leigos. A pergunta útil ("quando termina, com o que já aconteceu?") é respondida pelo recálculo contínuo |
| Campos de custo, custo gasto, % concluído e início real | Só serviam ao valor agregado, ou não são usados (KISS, "só pedir o necessário") |
| Aba Andamento | O acompanhamento passa a acontecer em cada ação |
| Abas Cronograma, Diagrama e Previsões | Reunidas em Visualização e Ações |
| Aba Entenda os termos | Vai para a Ajuda |
| Escolha triangular/beta | Uma só distribuição (seção 5.2) |
| Crucialidade e SSI como números na tela | Substituídos pela contribuição para a variância, que responde à mesma pergunta de forma padronizada e mais clara (seção 15.4) |
| Carimbo "Prioritária" e símbolo ❗ | Substituídos pela barra contínua e pela intensidade da cor (seções 7.1 e 7.3) |
| Categorias de folga (sem folga, quase sem folga, com folga) e limite `nearCrit` | Substituídas pela intensidade contínua da cor (seção 7.3) |
| Símbolo "▶ em andamento" | O início real não é mais registrado |
| Plano original único (baseline) | Substituído por retratos |
| Modo do artefato do Claude | Versão descontinuada |

---

## 10. Decisão: vários arquivos, sem compilação

- **Vários arquivos:** separação de responsabilidades; testes automáticos dos cálculos; leitura mais fácil por pessoas e IAs. O custo, a necessidade de um servidor simples para testar localmente, é pequeno.
- **Sem compilação:** qualquer pessoa edita e vê o resultado; menos ferramentas a manter numa instituição em que as equipes mudam; menos riscos de segurança. A checagem de tipos vem dos comentários JSDoc.
- A regra "um único arquivo" do AGENTS.md será substituída quando a versão 2 entrar no ar.

---

## 11. Migração dos dados atuais

A versão 2 converte os dados atuais na primeira leitura de cada plano, antes de qualquer gravação. Antes, é feita uma cópia de segurança completa.

| Atual | Versão 2 |
|---|---|
| `name` / `desc` | `rotulo` / `descricao` |
| `stage` (texto) | vira uma etapa da estrutura do plano, numa fase única "Fase 1", a ser reorganizada pelo usuário |
| `preds`, `owners`, `order` | `dependeDe`, `responsaveis`, `ordem` |
| `o, m, p` | primeira estimativa, `contaDe: "liberacao"` |
| `aF` (término real) | `concluidaEm` |
| `cost`, `ac`, `pct`, `aS` | descartados |
| `status` (importado da PI²) | descartado; a situação é calculada |
| `baseline` do plano | retrato "Plano original", com as datas guardadas |
| `holidays` (texto) | `datasExcluidas` com motivo vazio |
| coluna "Entrega" da planilha | `entrega` (importação passa a reconhecê-la) |

---

## 12. Ordem de trabalho

1. Revisão desta especificação pelo responsável.
2. Protótipo da aba Ações, publicado como página de teste privada.
3. Reescrita na branch, com testes.
4. *Pull request*, revisão e entrada no ar.
5. Atualização da documentação técnica, do AGENTS.md, do README e do CONTRIBUTING.md; remoção deste arquivo.

## 13. Fora desta reescrita

- **Níveis de permissão:** obrigatórios antes da fase de produção (documentação técnica, seção 9).
- **Previsão por classe de referência:** ideia futura (documentação técnica, seção 9). O histórico de estimativas da seção 4.3 já guarda os dados de que ela precisará.
- **Manual do usuário:** refeito depois da versão 2.

## 14. Pontos para reavaliação

Decisões aceitas para seguir em frente, mas que o responsável pediu para **reavaliar depois**, com o sistema em uso. Quem mexer nessas regras deve ler esta seção antes.

1. **Data de liberação de ações criadas depois (seção 5.1).** Problema: hoje toda ação começa a contar no dia em que a anterior termina. Uma ação criada no meio do plano, cujas anteriores já terminaram, nasceria atrasada. Solução adotada: campo opcional "Não começa antes de", preenchido com a data de criação. Alternativas consideradas: (a) contar sempre da data de criação, regra invisível e confusa; (b) permitir defasagem entre ações, como "começa 5 dias após a anterior" no MS Project, mais complexa (YAGNI). A reavaliar: se o campo é compreendido pelos usuários e se a data de criação é o padrão certo.
2. **Estimativa livre antes da liberação (seção 5.3).** Enquanto a ação aguarda, a estimativa muda sem histórico; a "original" passa a ser a vigente na liberação. A reavaliar: se isso esconde o otimismo do planejamento inicial, o que prejudicaria a previsão por classe de referência. Alternativa: registrar também essas mudanças, sem contá-las como reprogramação.

## 15. Fundamentos matemáticos dos indicadores por ação

Esta seção registra as fórmulas, as hipóteses e as razões de cada escolha, para revisão por especialistas. As decisões foram discutidas com o responsável em 16/10/2026, inclusive à luz da conversa "Schedule Sensitivity Index".

### 15.1 Notação

- A simulação gera *K* cenários (padrão: 10.000), com semente fixa.
- Em cada cenário *k*: dᵢ⁽ᵏ⁾ é a duração sorteada da ação *i*, em dias úteis (distribuição beta-PERT; ações concluídas têm duração fixa, igual à real); T⁽ᵏ⁾ é a duração total do plano.
- σᵢ e σ_T são os desvios-padrão de dᵢ e de T entre os cenários.
- 𝟙ᵢ⁽ᵏ⁾ vale 1 se a ação *i* está no caminho crítico do cenário *k* (folga total zero), e 0 caso contrário.

### 15.2 Prioridade de execução: índice de criticidade

**Fórmula:** CIᵢ = (1/K) · Σₖ 𝟙ᵢ⁽ᵏ⁾

**Por que é a medida certa para "o que não pode atrasar":** em cada cenário, T é o máximo das somas de durações sobre todos os caminhos da rede. Quando o caminho crítico é único (o que ocorre com probabilidade 1 em distribuições contínuas), a derivada de T em relação a dᵢ é 1 se *i* está nesse caminho e 0 se não está: ∂T⁽ᵏ⁾/∂dᵢ = 𝟙ᵢ⁽ᵏ⁾. Logo, um atraso pequeno δ, imposto à ação *i*, aumenta a duração esperada do plano em aproximadamente E[∂T/∂dᵢ] · δ = CIᵢ · δ. Ou seja, CIᵢ é o **efeito médio, em dias do plano, de cada dia de atraso na ação**. Daí a legenda "com 70%, cada dia de atraso atrasa o plano em cerca de 0,7 dia".

**Limitação conhecida:** num plano muito sequencial, quase todas as ações têm CI perto de 100%, e o indicador diferencia pouco. Não é erro: nesse plano, qualquer atraso atrasa o plano. A ordem de execução entre ações igualmente críticas fica a critério da equipe, como diz a legenda.

**Alternativa considerada e descartada: inclinação da regressão** de T sobre dᵢ, βᵢ = Cov(dᵢ, T) / Var(dᵢ), que também estima "dias do plano por dia da ação". Ela mede a resposta do plano à **variação natural** da ação; o CI mede a resposta a um **atraso imposto**, que é a pergunta do gestor. Além disso, βᵢ é instável quando Var(dᵢ) é pequena (divisão por um número próximo de zero) e indefinida para ações de duração fixa. Em redes com caminho dominante, βᵢ ≈ CIᵢ, e o CI é mais estável.

**Por que não usar um corte (por exemplo, "prioritária se CI ≥ 50%"):** cortes tratam como diferentes casos praticamente iguais (49% e 51%), o problema do paradoxo de sorites. O indicador é mostrado como barra contínua.

### 15.3 Prioridade de revisão: contribuição para a variância

**Fórmula, em três passos:**

1. Correlação de Pearson entre a duração da ação e a do plano, nos *K* cenários: rᵢ = Cov(dᵢ, T) / (σᵢ · σ_T).
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

- WILLIAMS, T. M. Criticality in stochastic networks. *Journal of the Operational Research Society*, v. 43, n. 4, 1992. (Define o índice de criticidade e o SSI.)
- ELMAGHRABY, S. E. On criticality and sensitivity in activity networks. *European Journal of Operational Research*, v. 127, 2000.
- VANHOUCKE, M. Using activity sensitivity and network topology information to monitor project time performance. *Omega*, v. 38, 2010. (Compara CI, SSI e crucialidade.)
- HULETT, D. *Practical Schedule Risk Analysis*. Gower, 2009. (Análise de risco de cronograma e gráficos de sensibilidade.)


---

## 16. Ampliação do escopo (em discussão)

Decisões acordadas com o responsável em 19/10/2026. A fase em que cada uma entra (versão 2 ou depois) ainda será definida. Quando for, cada item migra para a seção correspondente desta especificação.

### 16.1 Finalidades e tipos de plano

"Plano" passa a ser o nome genérico. Na criação, escolhe-se o tipo, com explicação clara de cada um na tela:

1. **Plano de Ação estrategicamente formalizado:** derivado do PEI/PDI. Exige escolher o Programa que o prevê, num catálogo (Objetivo Estratégico → Objetivo de Desenvolvimento → Política → Portfólio, opcional → Programa → Plano), e informar o documento que o aprovou.
2. **Projeto ou Plano de Ação de propósito geral:** mesmo motor do tipo 1, sem vínculo obrigatório ao catálogo.
3. **Tarefas de equipe:** gestão de tarefas no estilo Trello, Planner e Todoist. Sem dependências nem previsões. Experiência a mais simples e fluida possível.

Nos tipos 1 e 2, a criação oferece **modelos prontos de configuração**, como na escolha de opções no início de um jogo: "Cronograma estruturado" (dependências, estimativas e previsões ligadas; por exemplo, obras e eventos), "Cronograma aberto" (sem dependências, estimativas opcionais; por exemplo, projetos de TI) e "Personalizado". Escolhido o modelo, cada opção pode ser ajustada. No tipo 3, não há modelo: as colunas são criadas no dia a dia.

Uma ação sem estimativa não entra nas previsões. Desligar as previsões é um campo opcional do plano.

### 16.2 Situações das ações

- **Não liberada** (substitui "Aguardando"): calculada pelo sistema; só existe em planos com dependências. Símbolo: cadeado fechado.
- **Liberada:** base das ações não bloqueadas. Símbolo: cadeado aberto. Nos planos sem dependências, o nome padrão na tela é outro, para não confundir (como "A fazer"), e o administrador do plano pode renomeá-lo, como no Planner.
- **Situações personalizadas:** criadas pelo administrador do plano, como "Selecionada", "Em andamento", "Em teste" e "Em revisão". São subtipos de Liberada e viram colunas do quadro.
- **Concluída:** obrigatória em todos os tipos. Símbolo: visto (✓) num círculo.

O carimbo **Atrasada** continua independente das situações.

**Nova dependência numa ação liberada:** se alguém acrescenta como anterior uma ação ainda não concluída, abre-se um aviso antes de gravar: a ação passará para Não liberada e sairá da sua situação atual (por exemplo, "Em teste"). A pessoa confirma ou desiste.

**Símbolos, não emojis.** Emojis mudam de desenho e de cor conforme o aparelho e não combinam com um sistema institucional. Situações, carimbos e filtros usam um conjunto único de ícones em SVG, desenhados no mesmo estilo e coloridos pelas variáveis de cor dos temas claro e escuro.

### 16.3 Papéis e visibilidade

- **Login institucional** (Identificação Única) quando houver o servidor da UFCI-MG. Todo usuário institucional pode criar planos e é administrador dos planos que cria.
- **Papéis por plano:** Administrador do plano, Usuário do plano, Leitor. Sem papel no plano, a pessoa vê o plano só se a visibilidade permitir.
- **Responsáveis sem login** continuam existindo: pessoa, equipe ou unidade.
- **Administrador do Sistema:** sem passe livre. Acessa as telas de administração e, nos planos, tem os mesmos papéis de qualquer usuário. Única exceção: nomear um novo administrador para um plano órfão, com registro de quem fez e quando.
- **Gestor da Estratégia:** mantém o catálogo do PEI/PDI.
- **Todo plano tem pelo menos um administrador.** O último não pode ser removido.
- **Arquivar e desarquivar:** disponível para os administradores do plano. Um plano arquivado fica só para leitura e sai da lista principal. Arquivar é diferente de excluir.
- **Visibilidade, escolhida pelo administrador:** Público (qualquer pessoa com o link, sem login), Institucional (qualquer usuário com login) ou Restrito (só quem tem papel no plano).
- **Plano aberto ou fechado,** chave do administrador. Aberto: usuários do plano atualizam todas as ações. Fechado: cada um atualiza só as ações em que é responsável. Atualizar inclui estimar, reestimar, alterar o escopo, concluir e escrever notas. Criar e excluir ações e configurar o plano são exclusivos dos administradores.

### 16.4 Histórico de alterações

Toda alteração de uma ação é registrada, **por qualquer pessoa, inclusive administradores**: quem, quando, campo, valor antigo e valor novo. O histórico aparece na janela da ação.

Ninguém altera nem apaga o histórico, nem o Administrador do Sistema. O registro é gravado junto com a alteração, de forma que um não exista sem o outro. Fica numa coleção (ou tabela) própria, só de acréscimo, e não dentro da ação. Serve à transparência, à auditoria e às cargas para o Data Lakehouse.

### 16.5 Checklist e comentários

- **Checklist:** lista simples de itens dentro da ação, como no Planner. Não ocupa espaço até alguém tocar em "Adicionar checklist". O cartão mostra o progresso, como "2/5".
- **Comentários:** espaço de conversa na ação, com autor e data. Aparece sempre que o plano tem mais de um usuário com login (um administrador e um único responsável já formam duas pessoas).

### 16.6 Relatórios e extração de dados

Uma interface de relatórios e extração de dados para administradores, com escopo a definir.
