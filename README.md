<img src="logo.png" width="72" alt="Logotipo: rosa dos ventos">

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

**Em uso, em fase de testes.** O sistema está online, conectado ao Firebase da DGDI. Qualquer pessoa consulta; só usuários cadastrados editam.

Em cópias locais com o `config.js` vazio, o sistema abre em **modo local**: calcula tudo, porém **não salva** os dados.

## Como ver o sistema

- **Online:** https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/
- **No seu computador:** baixe o arquivo `index.html` e abra no navegador.

Para testar com dados, use o botão **Ver um plano de exemplo**.

## Instalação com banco de dados (Firebase)

Para que os planos fiquem salvos e sejam compartilhados, o sistema usa o **Firebase**, do Google (plano gratuito, sem pausa por inatividade). Consulta aberta a todos; edição só para usuários cadastrados.

Passo a passo para o administrador:

1. **Criar o projeto.** Em https://console.firebase.google.com, entre com uma conta Google (de preferência institucional) e clique em **Criar projeto**. O Google Analytics pode ser desativado.
2. **Criar o banco de dados.** Menu **Firestore Database** → **Criar banco de dados** → modo **produção** → local **southamerica-east1 (São Paulo)**.
3. **Publicar as regras de acesso.** Em **Firestore Database → Regras**, apague o conteúdo, cole o arquivo [`firestore.rules`](firestore.rules) deste repositório e clique em **Publicar**.
4. **Ativar o login.** Menu **Authentication** → **Vamos começar** → **E-mail/senha** → ativar → salvar.
5. **Impedir cadastros por conta própria.** Em **Authentication → Configurações → Ações do usuário**, desmarque **Ativar criação (inscrição)**. Assim, só o administrador cria usuários.
6. **Cadastrar os usuários que podem editar.** Em **Authentication → Usuários → Adicionar usuário**, informe e-mail e uma senha provisória. Cada pessoa pode trocá-la depois pelo link "Esqueci a senha".
7. **Autorizar o endereço do site.** Em **Authentication → Configurações → Domínios autorizados**, adicione `dgdi-ufci-mg.github.io`.
8. **Registrar o app Web e copiar a configuração.** Em **Configurações do projeto** (engrenagem) → **Geral** → **Seus apps** → ícone **</>** → dê um nome e registre. Copie o bloco `firebaseConfig` e cole no arquivo [`config.js`](config.js), no lugar de `null`.

Depois disso, o site passa a abrir já conectado: qualquer pessoa consulta, e quem tem usuário toca em **Entrar** para editar.

**Levar dados de uma instalação para outra:** na aba **Importar e exportar**, use **Copiar todos os dados** na origem e **Restaurar a partir de uma cópia** no destino.

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `index.html` | O sistema inteiro: HTML, CSS e JavaScript num único arquivo |
| `logo.png` | Logotipo (rosa dos ventos), também usado como ícone da aba do navegador |
| `config.js` | Configuração do Firebase (vazia = modo local) |
| `firestore.rules` | Regras de acesso ao banco de dados |
| `LICENSE` | Licença GPL v3 |
| `docs/documentacao-tecnica.md` | Arquitetura, fórmulas, modelo de dados, decisões e histórico de versões |
| `docs/especificacao-reescrita.md` | Decisões para a versão 2 do sistema (em revisão) |
| `docs/manual-do-usuario.md` | Manual em linguagem simples (em revisão, ver abaixo) |
| `CONTRIBUTING.md` | Como colaborar |
| `AGENTS.md` | Regras de trabalho para quem contribui, pessoa ou assistente de IA |
| `CLAUDE.md` | Aponta para o `AGENTS.md` e traz instruções exclusivas do Claude |

O manual do usuário está **congelado** até o sistema estabilizar, para evitar retrabalho com telas que ainda mudam.

## Como colaborar

Qualquer pessoa com uma conta gratuita do GitHub pode colaborar, sem precisar de ferramentas pagas. Leia o [guia de colaboração](CONTRIBUTING.md).

Resumo:

1. Para relatar um problema ou sugerir uma melhoria, abra uma **Issue**.
2. Para propor uma mudança no código ou na documentação, envie um **pull request**.
3. Toda mudança relevante deve vir acompanhada da atualização da documentação técnica.

## Licença

Distribuído sob a [GNU General Public License v3.0](LICENSE). Quem modificar e redistribuir o sistema deve manter o código aberto sob a mesma licença.
