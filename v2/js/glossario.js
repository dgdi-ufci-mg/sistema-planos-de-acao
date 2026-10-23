/**
 * Glossário da Ajuda (AGENTS.md: todo termo técnico novo entra aqui).
 * Cada item: chave, título, explicação simples, termo técnico (opcional) e ícone (opcional).
 */
export const GLOSSARIO = [
  { chave: "espaco", titulo: "Espaço de planejamento",
    texto: "O conjunto que reúne um Plano de Ação, um Projeto ou um Quadro de tarefas, com as suas ações, responsáveis e datas. No dia a dia, só \"espaço\"." },
  { chave: "concluida", icone: "concluida", titulo: "Concluída",
    texto: "A ação tem data de conclusão registrada. Ela entra nos cálculos com a duração real." },
  { chave: "liberada", icone: "liberada", titulo: "Liberada",
    texto: "Todas as ações anteriores foram concluídas e a data mínima, se houver, já chegou. A ação pode ser executada." },
  { chave: "naoLiberada", icone: "naoLiberada", titulo: "Não liberada",
    texto: "Alguma ação anterior ainda não foi concluída, ou a data mínima (\"Não começa antes de\") ainda não chegou." },
  { chave: "atrasada", icone: "atrasada", titulo: "Atrasada",
    texto: "A data prevista de conclusão, pela estimativa mais recente, já passou. Uma reestimativa tira o carimbo e fica registrada no histórico." },
  { chave: "tempoRestante", titulo: "Tempo restante",
    texto: "Dias úteis que faltam até a conclusão prevista da ação, pela estimativa mais recente (barra verde, para a direita). Se essa data já passou, mostra os dias úteis decorridos desde ela (barra vermelha, para a esquerda). Zero quer dizer que a conclusão está prevista para hoje. Fins de semana, feriados e datas excluídas não contam." },
  { chave: "exec", titulo: "Índice de criticidade",
    texto: "Quanto um atraso nesta ação atrasa a conclusão prevista. Por exemplo, com 70%, cada dia de atraso nesta ação atrasa a conclusão em cerca de 0,7 dia. Considera só o prazo final; outros motivos de prioridade ficam a critério da equipe.",
    simples: "prioridade de execução",
    /* fonte primária, com link permanente (22/10/2026, pedido do responsável) */
    referencia: `VAN SLYKE, R. M. Monte Carlo methods and the PERT problem. <i>Operations Research</i>, v. 11, n. 5, p. 839–860, 1963. DOI: <a href="https://doi.org/10.1287/opre.11.5.839" target="_blank" rel="noopener">10.1287/opre.11.5.839</a>. Texto completo, na versão de relatório técnico da Universidade da Califórnia em Berkeley: <a href="https://apps.dtic.mil/sti/pdfs/AD0412731.pdf" target="_blank" rel="noopener">DTIC AD0412731</a>.`,
    /* equação (22/10/2026, pedido do responsável); fundamento na seção 15.2 da especificação */
    formula: `<p class="formula">CI<sub>i</sub> = (1/K) · Σ<sub>k</sub> 𝟙<sub>i</sub><sup>(k)</sup></p>
      <p>K é o número de cenários simulados; 𝟙<sub>i</sub><sup>(k)</sup> vale 1 quando a ação <i>i</i> está no caminho crítico do cenário <i>k</i> e 0 quando não está. Num cenário, um dia a mais numa ação do caminho crítico adia a conclusão em um dia; nas demais, não adia. Por isso a média, CI<sub>i</sub>, é o efeito esperado de cada dia de atraso na ação.</p>` },
  { chave: "rev", titulo: "Contribuição para a incerteza",
    texto: "Quanto da incerteza do prazo final vem desta ação. Por exemplo, 18% quer dizer que esta ação responde por 18% da incerteza; as parcelas de todas as ações somam 100%. Quanto maior, mais vale revisar as estimativas, dividir a ação ou reduzir riscos.",
    simples: "prioridade de revisão do planejamento",
    tecnico: "contribuição para a variância do prazo",
    referencia: `WILLIAMS, T. M. Criticality in stochastic networks. <i>Journal of the Operational Research Society</i>, v. 43, n. 4, p. 353–357, 1992. DOI: <a href="https://doi.org/10.1057/jors.1992.50" target="_blank" rel="noopener">10.1057/jors.1992.50</a> (resumo público; texto completo pago). Define a crucialidade, a correlação entre a duração da ação e a do projeto, que é o passo 1 do cálculo. Elevar ao quadrado e dividir pela soma, para as parcelas somarem 100%, é a convenção adotada neste sistema.`,
    /* equação (22/10/2026, pedido do responsável); fundamento na seção 15.3 da especificação */
    formula: `<p class="formula">r<sub>i</sub> = Cov(d<sub>i</sub>, T) / (σ<sub>i</sub> · σ<sub>T</sub>)<br>q<sub>i</sub> = max(r<sub>i</sub>, 0)²<br>CV<sub>i</sub> = q<sub>i</sub> / Σ<sub>j</sub> q<sub>j</sub></p>
      <p><b>Significado técnico.</b> Em estatística, a incerteza de um número sorteado muitas vezes é medida pela <i>variância</i>: a média dos quadrados das distâncias de cada resultado até a média (o desvio-padrão ao quadrado). Aqui, o número é a duração do espaço nos cenários simulados. O nome técnico, "contribuição para a variância do prazo", diz que cada ação responde por uma parte dessa variância; na tela, "incerteza" é a palavra simples para ela.</p>
      <p>Nos cenários simulados, d<sub>i</sub> é a duração da ação <i>i</i> e T, a duração do espaço inteiro; σ<sub>i</sub> e σ<sub>T</sub> são os desvios-padrão delas. O quadrado da correlação, r<sub>i</sub>², é a parte da variância do prazo explicada pela ação; correlações negativas, que só vêm de ruído, contam como zero. A divisão pela soma das ações não concluídas faz as parcelas somarem 100%.</p>` },
  { chave: "prazo", titulo: "Prazo de uma ação",
    texto: "É contado em dias úteis, da liberação até a conclusão, incluindo o tempo até alguém começar. A data de início real não é registrada." },
  { chave: "naoAntesDe", titulo: "Não começa antes de",
    texto: "Data mínima para a ação ser liberada, mesmo que as anteriores já tenham terminado. Serve, por exemplo, para ações que dependem de uma data externa, como o início do semestre." },
  { chave: "reest", titulo: "Reestimativa",
    texto: "Nova estimativa do tempo que falta, a partir de hoje, em três pontos. A estimativa original nunca é apagada. Enquanto a ação não está liberada, a estimativa pode ser ajustada livremente, porque ainda é planejamento." },
  { chave: "regra", titulo: "Prazo vencido sem reestimativa",
    texto: "Se uma ação liberada passou da data prevista e ninguém a reestimou, o cálculo considera que ela termina a partir de hoje. Isso evita previsões otimistas demais, sem alterar o que foi registrado." },
  { chave: "pert", titulo: "Estimativa PERT",
    texto: "Prazo previsto = (otimista + 4 × mais provável + pessimista) ÷ 6. É a média da distribuição usada na simulação.",
    tecnico: "média da distribuição beta-PERT" },
  { chave: "dataSegura", titulo: "Data segura",
    texto: "Data em que o trabalho termina em 80% dos cenários simulados. A conclusão prevista é a data de 50%.",
    tecnico: "percentil 80 (P80) da simulação de Monte Carlo" },
  { chave: "chancePrazo", titulo: "Chance de cumprir o prazo",
    texto: "Parte dos cenários simulados em que o trabalho termina até o prazo final. Com 70%, de cada 10 cenários, 7 terminam a tempo.",
    tecnico: "proporção de simulações de Monte Carlo com término até o prazo final" },
  { chave: "folga", titulo: "Folga e caminho crítico",
    texto: "Folga é quanto uma ação pode atrasar, em dias úteis, sem atrasar o fim do espaço. As ações sem folga formam o caminho crítico: atrasar qualquer uma delas atrasa tudo.",
    tecnico: "folga total e caminho crítico (CPM)" },
  { chave: "cronograma", titulo: "Cronograma",
    texto: "Barras das ações no tempo, do início ao fim previsto de cada uma, com setas que mostram de quais ações cada uma depende.",
    tecnico: "diagrama de Gantt" },
  { chave: "rede", titulo: "Rede (fluxo das ações)",
    texto: "Desenho das ações como cartões ligados por setas, da esquerda para a direita, na ordem em que podem acontecer. Mostra o que precisa terminar antes de cada ação começar.",
    tecnico: "diagrama de rede PERT/CPM" },
];
