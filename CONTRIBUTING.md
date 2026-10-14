# Como colaborar

Obrigado por ajudar a melhorar o Sistema de Gerenciamento de Planos de Ação. Este guia explica como propor mudanças de forma organizada.

## Antes de começar

Leia a [documentação técnica](docs/documentacao-tecnica.md). Ela explica como o sistema funciona, as fórmulas usadas e por que cada decisão foi tomada. Muitas dúvidas já estão respondidas lá, principalmente na seção "Decisões tomadas".

## Relatar um problema ou sugerir uma melhoria

Abra uma **Issue** (aba "Issues" → "New issue") e descreva:

- **O que aconteceu** ou o que você gostaria que acontecesse;
- **Onde**: em qual aba do sistema e com quais dados;
- **Como reproduzir**, se for um problema;
- se possível, **uma captura de tela**.

## Propor uma mudança

1. Crie um ramo (*branch*) a partir de `main`, com um nome que descreva a mudança, como `etapas-renomear` ou `corrige-importacao`.
2. Faça a mudança.
3. **Atualize a documentação técnica** (`docs/documentacao-tecnica.md`):
   - descreva a mudança na seção correspondente;
   - registre uma nova linha na tabela "Histórico de versões da página";
   - se for uma decisão de projeto, inclua-a em "Decisões tomadas", com o motivo.
4. Abra um **pull request** explicando o que mudou e por quê. Uma pessoa responsável revisa antes de incorporar.

## Princípios que toda mudança deve respeitar

- **Linguagem simples.** Os usuários são leigos em gerenciamento de projetos. Use palavras do dia a dia; quando houver termo técnico equivalente, mostre-o em itálico, em letra menor ("Termo técnico: …"), e inclua-o na aba "Entenda os termos".
- **Rigor nos cálculos.** Mudanças nas fórmulas precisam citar a referência e ser validadas com um plano real ou de exemplo.
- **Um único arquivo.** O sistema fica em `index.html`, sem etapa de compilação. Bibliotecas externas só pela CDN e com versão fixa.
- **Celular.** Toda tela precisa funcionar em largura de celular (cerca de 400 px).
- **Temas claro e escuro.** Cores sempre pelas variáveis CSS definidas no início do arquivo, derivadas das cores do logotipo (`logo.png`).
- **Dados pela camada `Store`.** Toda leitura e gravação passa pelo objeto `Store`. Não acesse o banco de dados diretamente de outras partes do código.

## Testar localmente

Abra o `index.html` no navegador. Com o `config.js` vazio, o sistema funciona em modo local e não salva dados; use o botão **Ver um plano de exemplo** para testar. **Não altere o `config.js` do repositório para apontar para outro banco**: para testar com o seu próprio Firebase, use uma cópia local.

## Dúvidas

Abra uma Issue com a etiqueta "dúvida" ou procure a equipe da DGDI.
