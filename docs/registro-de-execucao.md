# Registro de execução da versão 2

Diário dos passos feitos em lote (especificação, seção 3.3, "Execução em lote"). Cada passo tem um commit próprio, cuja mensagem começa por "Versão 2, passo <número>", para voltar exatamente a ele.

**Etiquetas:** o ambiente de trabalho não tem permissão para enviar etiquetas ao GitHub (recusa do intermediário de rede). As etiquetas `v2-passo-<número>` ficam só na cópia local; a tabela abaixo liga cada passo ao seu commit. Para criá-las no GitHub, basta rodar, numa cópia do repositório: `git tag v2-passo-<número> <commit> && git push --tags`.

| Passo | Commit |
|---|---|
| 1.17a | `0c896ea` |
| 1.17b | `b0d2785` |
| 1.17c | `273c153` |

Em cada passo: o que foi feito, os testes, a conferência na tela e as **decisões provisórias**, tomadas sem consulta e à espera da revisão do responsável.

A conferência no site publicado fica com o responsável: o ambiente de trabalho não acessa o endereço do GitHub Pages, e a conferência é feita com os testes automáticos e no navegador de teste (Playwright e Chromium, com um Firebase falso; nada é gravado no banco real).

---

## Ordem adotada no lote

Os passos 1.16 (histórico) e 1.18 (retratos) criam coleções novas no banco e exigem regras novas do Firestore. Pela regra do lote, mudança nas regras do banco é ponto de parada. Por isso eles ficam por último, numa branch separada, com as regras prontas, sem entrar na `main` até o responsável publicar as regras e aprovar. Os demais seguem na `main`, nesta ordem: 1.17a, 1.17b (sem a comparação com retrato, que depende do 1.18), 1.17c e 1.19.

## Passo 1.17a — Linha do tempo (21/10/2026)

**Commit:** `0c896ea`.

**O que foi feito:** novo modo "Linha do tempo" no seletor da barra do topo, só no computador. Mostra três números (conclusão prevista, data segura e prazo final com a chance de cumpri-lo) e um gráfico com:
- a parte dos cenários simulados que termina em cada semana (barras; depois do prazo final, em vermelho);
- a chance acumulada de terminar até cada data (curva);
- marcas de hoje, conclusão prevista, data segura e prazo final, com os rótulos em alturas diferentes quando ficam próximos;
- ao passar o mouse, a chance de terminar até a data apontada.

**Arquivos:** `js/linha-do-tempo.js` (regras, sem tela), `js/telas/linha-do-tempo.js` (desenho), `js/telas/espaco.js` (modo novo), `js/icones.js`, `js/glossario.js`, `css/estilo.css`.

**Testes:** 172 testes automáticos passam, incluindo os novos de `testes/linha-do-tempo.test.js`: a distribuição soma 100%, a chance até o prazo final coincide com a chance calculada pela simulação (o mesmo número da lista) e a chance até a conclusão prevista é de pelo menos 50%. Conferência no navegador de teste, com o espaço de exemplo, nos temas claro e escuro: sem erros na página.

**Decisões provisórias:**
1. Semanas de segunda a domingo nas barras.
2. A data de cada cenário é o dia útil em que a última ação termina (a mesma regra da conclusão prevista).
3. O eixo vai do início do espaço (ou de hoje, se for antes) até a última data simulada ou o prazo final, o que vier depois, com uma semana de folga.
4. A borda do cartão do prazo fica vermelha quando a chance é menor que 50%.
5. No celular, o modo não aparece (como a planilha); quem abrir o espaço no celular continua na lista.
6. Termo novo no glossário: "Chance de cumprir o prazo".

**Nenhum número mudou de sentido:** a conclusão prevista, a data segura e a chance são os mesmos da simulação de antes; a tela só os desenha.

## Passo 1.17b — Cronograma (21/10/2026)

**O que foi feito:** novo modo "Cronograma" no seletor, só no computador, entre Planilha e Linha do tempo:
- uma linha por ação, agrupadas por fase e etapa (com uma barra-resumo em cada grupo), quando o espaço usa fases;
- barras do primeiro ao último dia previsto: vermelho sem folga (caminho crítico), verde-azulado com folga, verde concluída, tracejado dourado sem estimativa;
- setas das dependências; hoje (tracejado) e prazo final (vermelho);
- aproximação em semanas ou meses; abre com hoje à vista e mantém a rolagem ao redesenhar;
- passando o mouse numa barra: datas, folga em dias úteis e destaque das ações ligadas; clicando: abre a ação.

**Arquivos:** `js/cronograma.js` (regras, sem tela), `js/telas/cronograma.js` (desenho), `js/telas/espaco.js`, `js/icones.js`, `js/glossario.js`, `css/estilo.css`.

**Testes:** 176 testes automáticos passam, incluindo os novos de `testes/cronograma.test.js`: cada ação aparece uma vez, com o fim igual à conclusão mostrada na lista; nenhuma ação começa antes do fim das anteriores; agrupamento na ordem das fases; ações sem folga iguais às do caminho crítico. Conferência no navegador de teste, com o exemplo, nos temas claro e escuro, nas duas aproximações, passando o mouse e clicando numa ação: sem erros.

**Decisões provisórias:**
1. Sem filtros nem ordem no cronograma: as setas ligariam ações escondidas. Mostra sempre o espaço inteiro, na ordem do espaço.
2. Uma ação pode começar no mesmo dia em que a anterior termina, quando a anterior termina no meio do dia (o cálculo usa frações de dia).
3. Cores: as da legenda acima; a ação sem estimativa aparece como um pequeno retângulo tracejado no dia em que seria liberada.
4. Duas aproximações (semanas, 18 pixels por dia; meses, 5 pixels por dia). Sem arrastar barras: as datas vêm das estimativas e dependências, e não são editadas no cronograma.
5. Termos novos no glossário: "Folga e caminho crítico" e "Cronograma" (diagrama de Gantt).
6. A comparação com retrato (linha fina sob cada barra) fica para depois do passo 1.18.

**Nenhum número mudou de sentido:** as datas e o caminho crítico são os mesmos do cálculo de antes.

## Passo 1.17c — Rede, o fluxo das ações (21/10/2026)

**O que foi feito:** novo modo "Rede" no seletor, só no computador, entre Cronograma e Linha do tempo:
- cada ação é um cartão com o nome, a data prevista e a folga (ou "Concluída em", ou "Falta estimar"), com a borda na cor da legenda;
- colunas da esquerda para a direita: cada ação fica logo depois da sua anterior mais distante; dentro da coluna, a ordem reduz os cruzamentos das setas;
- setas das dependências, em vermelho quando ligam duas ações do caminho crítico sem intervalo entre elas;
- passando o mouse (ou com o foco do teclado) numa ação, destaca tudo o que vem antes e depois dela; clicando, abre a ação;
- "Normal" (rolagem) ou "Ver tudo" (reduzida para caber na largura).

**Arquivos:** `js/rede.js` (regras, sem tela), `js/telas/rede.js` (desenho), `js/telas/espaco.js`, `js/icones.js`, `js/glossario.js`, `css/estilo.css`.

**Testes:** 181 testes automáticos passam, incluindo os novos de `testes/rede.test.js`: cada ação aparece uma vez; toda seta vai para a direita; a coluna de cada ação é a seguinte à da anterior mais distante; as setas críticas ligam ações sem folga; a arrumação não cruza mais setas do que a ordem do espaço; dependência circular e espaço vazio não travam o desenho. Conferência no navegador de teste, com o exemplo, nos temas claro e escuro, passando o mouse, em "Ver tudo" e clicando numa ação: sem erros.

**Decisões provisórias:**
1. Sem filtros nem ordem na rede, como no cronograma.
2. Sem cartões de "Início" e "Fim": a rede começa nas ações sem anteriores e termina nas que nenhuma outra espera.
3. Uma seta que pula colunas passa por trás dos cartões do meio (sem desvio). Se incomodar com planos maiores, o próximo ajuste é desviar essas setas.
4. Cartões de tamanho fixo (240 × 76 pixels), com o nome em até duas linhas; o nome inteiro aparece ao parar o mouse.
5. Termo novo no glossário: "Rede (fluxo das ações)".

**Nenhum número mudou de sentido:** a rede só desenha as dependências e o caminho crítico já calculados.

## Passo 1.19a — Exportação e cópia de segurança (21/10/2026)

**Por que dividido:** o passo 1.19 junta o que só lê os dados (exportar, baixar a cópia) e o que grava (importar, restaurar). A gravação em lote no banco real, com decisões sobre atualizar ou não ações existentes, é do tipo que o responsável deve conferir antes. Feita só a parte de leitura (1.19a); a importação e a restauração ficam no 1.19b.

**O que foi feito:**
- "Configurar este espaço" ganhou a seção **Exportar**:
  - **Copiar para planilha:** uma linha por ação ativa, separada por tabulações, para colar no Google Planilhas ou no Excel. Colunas: Número, Código (se o espaço usa códigos), Fase e Etapa (se usa fases), Ação, Descrição (se usa), Depende de (códigos, se o espaço os usa; senão, números), Otimista, Mais provável, Pessimista e Prazo previsto (da estimativa vigente), Responsáveis (siglas), Situação, Atrasada, Início previsto, Conclusão prevista, Folga (dias úteis) e Sem folga. Números com vírgula decimal; datas em dd/mm/aaaa.
  - **Copiar fluxograma:** texto em Mermaid, com fases e etapas como grupos, uma caixa por ação (nome e data prevista), uma seta por dependência e as cores da tela (sem folga, com folga, concluída).
  - Se o navegador não deixar copiar, o texto aparece selecionado numa caixa, para Ctrl+C.
- "Configurar o sistema" ganhou **Baixar cópia de segurança**: um arquivo `.json` com todos os espaços, inclusive os excluídos, com todas as ações (também as da lixeira) e os responsáveis, e o calendário geral. O espaço de exemplo não entra (fica só na memória do navegador).

**Formato da cópia de segurança (versão 1):**

```
{
  "formato": "sextante-copia-de-seguranca",   identificador fixo, mesmo se o nome do sistema mudar
  "versao": 1,
  "geradaEm": "2026-10-21T…Z",
  "geradaPor": e-mail de quem baixou, ou null,
  "calendarioGeral": {datasExcluidas, alteradoEm, alteradoPor} ou null,
  "espacos": [
    { "espaco": {…todos os campos da seção 4.1…},
      "acoes": [{…todos os campos da seção 4.2…}],       por número
      "responsaveis": [{…todos os campos da seção 4.5…}] por id
    }
  ]
}
```

Os registros vão como estão no banco, sem tradução: o dicionário de dados (seção 4 da especificação) descreve cada campo. Quando o histórico (1.16) e os retratos (1.18) existirem, entram na versão 2 do formato.

**Arquivos:** `js/exportar.js` (regras, sem tela), `js/dados.js` (`copiaDeSeguranca`, só leitura), `js/telas/arquivos.js` (copiar e baixar), `js/telas/configurar.js`, `js/telas/configurar-sistema.js`, `css/estilo.css`.

**Testes:** 186 testes automáticos passam, incluindo os novos de `testes/exportar.test.js`: uma linha por ação, colunas alinhadas, conclusão igual à da lista, dependências por código quando ligados; fluxograma com uma caixa por ação, uma seta por dependência e os grupos de fases e etapas; a ação excluída não aparece nas exportações e aparece na cópia de segurança (exigência da seção 4.7 da especificação); a cópia leva os espaços excluídos, os responsáveis e o calendário geral. O fluxograma do exemplo foi conferido com o próprio Mermaid (versão 11.4.1, no navegador de teste): lido e desenhado sem erro, com e sem fases e códigos. No navegador de teste: copiar para planilha, copiar fluxograma e baixar a cópia funcionaram, sem erros.

**Decisões provisórias:**
1. Divisão do passo 1.19 em 1.19a (leitura) e 1.19b (gravação), registrada na especificação.
2. Exportar fica em "Configurar este espaço"; a cópia de segurança, de todos os espaços, em "Configurar o sistema" (a especificação punha ambos em "Configurar o espaço").
3. Planilha por cópia (colar), como na versão atual, sem gerar arquivo .xlsx (sem biblioteca).
4. Colunas da planilha e conteúdo das caixas do fluxograma, como descrito acima. Sem as prioridades calculadas, que dependem da simulação.
5. Nome do arquivo: nome do sistema, "copia" e a data (`sextante-copia-2026-10-21.json`).

**Nenhum número mudou de sentido.** Nada é gravado no banco.

## Resumo do lote (21/10/2026)

**Na `main`, já no site:** 1.17a (linha do tempo), 1.17b (cronograma), 1.17c (rede) e 1.19a (exportação e cópia de segurança). Todos com testes automáticos passando e conferidos no navegador de teste.

**Na branch `passos-1.16-1.18`, à espera das regras do banco:** 1.16 (histórico de alterações) e 1.18 (retratos manuais e comparação no cronograma). Os registros detalhados desses dois passos estão no diário da branch. Para publicar:
1. No console do Firebase (`sextante-v2`): Firestore Database > Regras > colar `v2/firestore.rules` da branch > Publicar.
2. Avisar, para eu juntar a branch à `main`.

**Fora do lote, à espera de decisão:** 1.19b (importação por planilha e Mermaid, e restauração da cópia), porque grava no banco e pede decisões de comportamento (por exemplo, se a importação atualiza ações existentes ou só cria novas); 1.14d, 1.20, 1.21 e 1.22, já excluídos do lote.

**Observado e não corrigido:** no "Histórico de estimativas" da janela da ação, a data, o autor e o selo "vigente" aparecem em linhas separadas (aparência anterior ao lote).
