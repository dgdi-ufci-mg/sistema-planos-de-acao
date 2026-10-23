# Como colaborar

Obrigado por ajudar a melhorar o Sistema de Gerenciamento de Planos de Ação. Este guia explica como propor mudanças de forma organizada.

## Antes de começar

Leia a [documentação técnica](docs/documentacao-tecnica.md). Ela explica como o sistema funciona, as fórmulas usadas e por que cada decisão foi tomada. Muitas dúvidas já estão respondidas lá, principalmente na seção "Decisões tomadas".

## Relatar um problema ou sugerir uma melhoria

Abra uma **Issue** (aba "Issues" → "New issue") e descreva:

- **O que aconteceu** ou o que você gostaria que acontecesse;
- **Onde**: em qual tela ou visualização do sistema e com quais dados;
- **Como reproduzir**, se for um problema;
- se possível, **uma captura de tela**.

## Propor uma mudança

1. Crie um ramo (*branch*) a partir de `main`, com um nome que descreva a mudança, como `etapas-renomear` ou `corrige-importacao`.
2. Faça a mudança.
3. **Atualize a documentação técnica** (`docs/documentacao-tecnica.md`):
   - descreva a mudança na seção correspondente;
   - registre uma nova linha na tabela "Histórico de versões da página";
   - se for uma decisão de projeto, inclua-a em "Decisões tomadas", com o motivo;
   - se mudar um campo do banco, atualize o dicionário de dados (seção 4).
4. Rode os testes (`node --test`, na raiz) e confira que todos passam.
5. Abra um **pull request** explicando o que mudou e por quê. Uma pessoa responsável revisa antes de incorporar.

## Princípios que toda mudança deve respeitar

- **Linguagem simples.** Os usuários são leigos em gerenciamento de projetos. Use palavras do dia a dia; quando houver termo técnico equivalente, mostre-o em itálico, em letra menor ("Termo técnico: …"), e inclua-o no glossário da Ajuda (`js/glossario.js`).
- **Rigor nos cálculos.** Mudanças nas fórmulas precisam citar a referência e ser validadas com um plano real ou de exemplo.
- **Módulos, sem compilação.** O sistema fica em módulos JavaScript por assunto (`js/`), sem etapa de compilação, sem npm e sem *framework*. Bibliotecas externas só pela CDN e com versão fixa.
- **Celular.** Toda tela precisa funcionar em largura de celular (cerca de 400 px).
- **Temas claro e escuro.** Cores sempre pelas variáveis CSS do início de `css/estilo.css`, em três blocos (claro, escuro pelo sistema e escuro escolhido), derivadas das cores do logotipo (`logo.png`).
- **Dados pelo `Store`.** Toda leitura e gravação passa pelo `Store` (`js/dados.js`). Nenhum termo do Firestore aparece fora de `js/banco/firestore.js`.

## Testar localmente

Rode `node --test` na raiz para os testes automáticos. Para ver a página, rode `python3 -m http.server` na raiz e abra http://localhost:8000/; use o botão **Ver um exemplo**, que roda só na memória. **Não altere o `config.js` do repositório para apontar para outro banco**: para testar com o seu próprio Firebase, use uma cópia local, ou troque a configuração por `null` na sua cópia para trabalhar só na memória.

## Dúvidas

Abra uma Issue com a etiqueta "dúvida" ou procure a equipe da DGDI.
