# Sistema de Gerenciamento de Planos de Ação — Manual do usuário

**Universidade Federal de Ciência e Inovação de Minas Gerais (UFCI-MG)**
Atualizado em 14/10/2026

> Versão ilustrada, com telas numeradas: https://claude.ai/artifact/Xz8YAqi7HBqCrpVvKmaRSC (também acessível pelo botão **Ajuda** do sistema). Este arquivo é a versão de referência em texto.

---

## 1. Para que serve

O sistema ajuda a planejar e acompanhar planos de ação. Você cadastra as ações, diz quanto tempo cada uma deve levar e de quais outras ela depende. O sistema então:

- calcula quando o plano deve terminar;
- mostra quais ações não podem atrasar sem atrasar o plano inteiro;
- estima a chance de cumprir o prazo final;
- aponta onde vale mais a pena reforçar o acompanhamento;
- compara o andamento real com o que foi combinado.

Não é preciso conhecer técnicas de gerenciamento de projetos. Sempre que aparece um termo técnico, ele vem em itálico, em letra menor, ao lado de uma explicação simples. A aba **Entenda os termos** reúne todos eles.

---

## 2. Primeiros passos

### 2.1 Acesso

Abra o link do sistema e entre com sua conta do Claude. Sem entrar, a página abre vazia e nada fica salvo.

No canto superior aparece um selo:

- **salvando automaticamente**: tudo o que você muda é gravado na hora e aparece para os colegas;
- **só consulta**: você pode ver, mas não editar (peça acesso de Colaborador a quem compartilhou);
- **sem login · nada é salvo**: você não entrou com sua conta.

### 2.2 Escolher o plano

No topo há uma lista com os planos cadastrados. Escolha o que quer ver. O sistema lembra a última escolha.

### 2.3 Criar um plano

Toque em **Novo plano** e preencha, em **Configurar**:

- **Nome do plano**;
- **Data de início**;
- **Prazo final**: a data que precisa ser cumprida;
- **Feriados e dias sem expediente**, separados por vírgula (ex.: 25/12/2026, 01/01/2027).

Os demais campos de Configurar podem ficar como estão.

---

## 3. Cadastrar as ações (aba Ações)

### 3.1 Uma ação por vez

No formulário do topo da aba, preencha:

- **Código**: uma sigla curta e única (ex.: LEV). Ela não pode ser mudada depois.
- **Ação**: o nome curto da ação.
- **Depende de**: as ações que precisam terminar antes desta começar. Digite parte do código ou do nome e escolha na lista.
- **Responsáveis**: digite parte do nome, da sigla ou do setor e escolha na lista. Se a pessoa não estiver cadastrada, escolha a última opção, **Cadastrar "…" como responsável**.
- **Prazos, em dias úteis:**
  - **Melhor caso**: quanto leva se tudo correr bem;
  - **Mais provável**: o tempo mais comum;
  - **Pior caso**: quanto leva se houver contratempos.

Se você tiver uma só estimativa, preencha apenas **Mais provável**.

Toque em **Adicionar ação**.

### 3.2 Dicas para estimar prazos

- Pense em dias de trabalho, não em dias corridos.
- Não deixe o pior caso igual ao provável só por otimismo. A diferença entre os dois é justamente o que mostra o risco da ação.
- Ações muito longas e incertas podem ser divididas em ações menores.

### 3.3 Editar

Na tabela, toque em qualquer campo, altere e saia dele: a mudança é salva na hora. Para tirar uma dependência ou um responsável, toque no **×** da etiqueta.

### 3.4 Excluir

Toque em **Excluir** e depois em **Confirmar exclusão**.

---

## 4. Ler o cronograma (aba Cronograma)

Cada ação é uma barra na linha do tempo, que conta só os dias úteis.

- **Barra vermelha**: ação sem folga. Se ela atrasar, o plano inteiro atrasa.
- **Barra azul**: ação com folga. Ela pode atrasar alguns dias sem afetar o fim do plano.
- **Barra verde**: ação concluída.
- **Linha cinza fina** sob a barra: o plano original, depois de guardado.
- **Setas**: mostram que uma ação só começa quando a anterior termina. Podem ser desligadas na legenda.
- **Linhas verticais**: prazo final, data segura e data da última atualização.

No computador, passe o mouse sobre uma linha para ver as datas, o prazo calculado e a folga. No celular, esses dados estão na aba Ações.

---

## 5. Entender as previsões

### 5.1 Os quatro indicadores do topo

- **Conclusão prevista**: a data pela conta simples, somando a sequência de ações mais longa.
- **Data segura de conclusão**: em 8 de cada 10 simulações, o plano termina até essa data. É a mais indicada para assumir compromissos.
- **Chance de cumprir o prazo**: em quantas simulações o plano termina até o prazo final. Verde a partir de 80%, amarelo entre 50% e 80%, vermelho abaixo de 50%.
- **Ritmo em relação ao plano**: 100% é o ritmo combinado. Aparece depois que o andamento começa a ser registrado (seção 6).

### 5.2 Aba Previsões

O sistema sorteia milhares de vezes um prazo para cada ação, entre o melhor e o pior caso, e calcula a data final de cada sorteio. O gráfico mostra quais datas aparecem mais.

A tabela **Onde vale mais a pena agir** lista as ações pela **prioridade de atenção**. No topo ficam as que costumam definir a data final e têm prazo mais incerto. São elas que merecem acompanhamento mais próximo, planejamento mais detalhado ou reforço de equipe.

### 5.3 Por que a simulação dá datas mais tardias?

Porque o plano tem várias sequências de ações correndo ao mesmo tempo, e basta uma atrasar para o plano todo atrasar. A conta simples olha só a sequência mais longa; a simulação olha todas.

---

## 6. Acompanhar o andamento (aba Andamento)

Siga estes três passos:

1. **Guarde o plano original.** Na aba Andamento, toque em **Guardar plano original**. É uma "fotografia" das datas combinadas. Faça isso uma vez, quando o plano estiver aprovado.
2. **Registre o andamento** a cada reunião de acompanhamento, na aba Ações:
   - **% concluído** de cada ação em andamento;
   - **Começou em** e **Terminou em**, quando aplicável;
   - **Custo gasto**, se o plano controlar custos.
3. **Informe a data da atualização** no campo **Situação atualizada em**.

O sistema recalcula as datas a partir da atualização e mostra:

- quanto do trabalho **deveria estar feito** e quanto **foi feito**;
- o **ritmo em relação ao plano** e a data de término mantido esse ritmo;
- para cada ação, a diferença entre o fim no plano original e o fim previsto agora.

Só substitua o plano original se o plano for formalmente replanejado.

---

## 7. Responsáveis (aba Responsáveis)

A lista de responsáveis vale para todos os planos.

- **Um por vez:** preencha nome, sigla (opcional) e setor (opcional) e toque em **Adicionar responsável**.
- **Vários de uma vez:** abra **Cadastrar vários de uma vez** e cole uma pessoa por linha, no formato `Nome; Sigla; Setor`. Também é possível colar colunas de uma planilha. Toque em **Conferir**, revise a lista e confirme.
- **Sigla:** use quando o nome for longo. Ela aparece nas etiquetas e nos diagramas.
- Para corrigir nome, sigla ou setor, edite direto na tabela.

---

## 8. Importar e exportar

### 8.1 Trazer ações de uma planilha

1. No Google Planilhas ou no Excel, selecione as linhas das ações **incluindo a linha de títulos** e copie.
2. Na aba **Importar e exportar**, escolha **Planilha**, cole e toque em **Conferir**.
3. Revise a lista e toque em **Importar**.

Títulos reconhecidos incluem: Código, Ação, Predecessores (ou Depende de), Otimista, Mais provável, Pessimista (ou só Duração), Responsável, Custo e % concluído. Responsáveis que ainda não estão na lista são cadastrados automaticamente.

### 8.2 Levar o cronograma para uma planilha

Toque em **Copiar para planilha** e cole no Google Planilhas.

### 8.3 Fluxograma

É possível importar ou exportar a rede de ações em linguagem Mermaid. O fluxograma traz as ações e as dependências, mas não os prazos.

---

## 9. Perguntas frequentes

**Meu colega abre o link e vê a página vazia.**
Ele precisa entrar com uma conta do Claude. O acesso sem conta depende da futura hospedagem fora do Claude.

**Apareceu um aviso de dependência em círculo.**
Duas ou mais ações dependem umas das outras, e nenhuma consegue começar. Corrija o campo "Depende de" de uma delas.

**Uma ação aparece com prazo zero.**
Faltam as estimativas de prazo. Preencha pelo menos "Mais provável". Se o zero for intencional, a ação é um marco, como uma entrega ou aprovação, e aparece como um losango no cronograma.

**Os resultados da simulação mudam sozinhos?**
Não. Com o mesmo plano, o resultado é sempre o mesmo. Ele só muda quando você altera ações, datas ou configurações.

**Posso desfazer uma exclusão?**
Não. Por isso o sistema pede confirmação antes de excluir.

---

## 10. Onde aprender mais

A aba **Entenda os termos** explica, em linguagem simples, cada conceito usado pelo sistema e indica o nome técnico correspondente.
