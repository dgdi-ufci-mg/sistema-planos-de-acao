# Sistema de Gerenciamento de Planos de Ação

**Diretoria de Governança e Desenvolvimento Institucional (DGDI) · Universidade Federal de Ciência e Inovação de Minas Gerais (UFCI-MG)**

Ferramenta online para planejar e acompanhar planos de ação institucionais, pensada para pessoas sem formação em gerenciamento de projetos.

## O que o sistema faz

- Calcula quando o plano deve terminar e mostra quais ações não podem atrasar (caminho crítico).
- Estima a chance de cumprir o prazo final por simulação (método de Monte Carlo) e indica onde vale mais a pena reforçar o acompanhamento.
- Desenha o cronograma (Gantt) e o diagrama de rede das ações, agrupado por etapas.
- Compara o andamento real com o plano original (valor agregado e Earned Schedule).
- Importa e exporta ações pelo Google Planilhas e por fluxogramas Mermaid.

Todos os termos aparecem em linguagem simples, com o nome técnico ao lado para quem quiser se aprofundar.

## Situação atual

**Protótipo.** O arquivo `index.html` funciona sozinho em qualquer navegador, mas, fora do ambiente onde foi criado, abre em **modo local**: calcula tudo, porém **não salva** os dados.

O próximo passo é ligar o sistema a um banco de dados (Firebase) para que os planos fiquem salvos e sejam compartilhados entre os usuários. Veja a seção "Pendências" da documentação técnica.

## Como ver o sistema

- **Online:** depois que o GitHub Pages for ativado, o endereço será `https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/`.
- **No seu computador:** baixe o arquivo `index.html` e abra no navegador.

Para testar com dados, use o botão **Ver um plano de exemplo**.

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `index.html` | O sistema inteiro: HTML, CSS e JavaScript num único arquivo |
| `docs/documentacao-tecnica.md` | Arquitetura, fórmulas, modelo de dados, decisões e histórico de versões |
| `docs/manual-do-usuario.md` | Manual em linguagem simples (em revisão, ver abaixo) |
| `CONTRIBUTING.md` | Como colaborar |

O manual do usuário está **congelado** até o sistema estabilizar, para evitar retrabalho com telas que ainda mudam.

## Como colaborar

Qualquer pessoa com uma conta gratuita do GitHub pode colaborar, sem precisar de ferramentas pagas. Leia o [guia de colaboração](CONTRIBUTING.md).

Resumo:

1. Para relatar um problema ou sugerir uma melhoria, abra uma **Issue**.
2. Para propor uma mudança no código ou na documentação, envie um **pull request**.
3. Toda mudança relevante deve vir acompanhada da atualização da documentação técnica.
