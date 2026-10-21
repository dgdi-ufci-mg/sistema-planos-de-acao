# Registro de execução da versão 2

Diário dos passos feitos em lote (especificação, seção 3.3, "Execução em lote"). Cada passo tem um commit próprio, com a etiqueta `v2-passo-<número>` no GitHub, para voltar exatamente a ele.

Em cada passo: o que foi feito, os testes, a conferência na tela e as **decisões provisórias**, tomadas sem consulta e à espera da revisão do responsável.

A conferência no site publicado fica com o responsável: o ambiente de trabalho não acessa o endereço do GitHub Pages, e a conferência é feita com os testes automáticos e no navegador de teste (Playwright e Chromium, com um Firebase falso; nada é gravado no banco real).

---

## Ordem adotada no lote

Os passos 1.16 (histórico) e 1.18 (retratos) criam coleções novas no banco e exigem regras novas do Firestore. Pela regra do lote, mudança nas regras do banco é ponto de parada. Por isso eles ficam por último, numa branch separada, com as regras prontas, sem entrar na `main` até o responsável publicar as regras e aprovar. Os demais seguem na `main`, nesta ordem: 1.17a, 1.17b (sem a comparação com retrato, que depende do 1.18), 1.17c e 1.19.

## Passo 1.17a — Linha do tempo (21/10/2026)

**Etiqueta:** `v2-passo-1.17a`.

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
