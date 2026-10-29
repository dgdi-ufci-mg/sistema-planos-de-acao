<img src="logo.png" width="72" alt="Logotipo: rosa dos ventos">

# Sistema de Gerenciamento de Planos de Ação (Sextante)

**Diretoria de Governança e Desenvolvimento Institucional (DGDI) · Universidade Federal de Ciência e Inovação de Minas Gerais (UFCI-MG)**

Ferramenta online para planejar e acompanhar planos de ação institucionais, pensada para pessoas sem formação em gerenciamento de projetos.

## O que o sistema faz

- Calcula quando o plano deve terminar e mostra quais ações não podem atrasar (caminho crítico, em dias úteis).
- Estima a chance de cumprir o prazo final por simulação (método de Monte Carlo) e indica, ação por ação, onde um atraso pesa mais e de onde vem a incerteza do prazo.
- Mostra o plano em seis visualizações: lista, quadro, rede, cronograma (Gantt), planilha e linha do tempo.
- Acompanha o andamento por situações (não liberada, liberada, concluída), reestimativas com histórico e retratos do plano.
- Importa e exporta ações pelo Google Planilhas e exporta fluxogramas Mermaid.

Todos os termos aparecem em linguagem simples, com o nome técnico ao lado para quem quiser se aprofundar.

## Situação atual

**Protótipo, em fase de testes.** Este sistema é uma prova de conceito: serve de modelo conceitual para o sistema definitivo, que será desenvolvido do zero pela equipe de TI da UFCI-MG. Ele está online, conectado ao Firebase da DGDI (projeto `sextante-v2`). Qualquer pessoa consulta; só usuários cadastrados editam.

A versão 2 substituiu a versão 1 em 23/10/2026. O endereço antigo da versão 2 (`/v2/`) leva para o endereço principal.

Com o `config.js` contendo `null`, o sistema abre só na memória: calcula tudo, porém **não salva** os dados.

## Como ver o sistema

- **Online:** https://dgdi-ufci-mg.github.io/sistema-planos-de-acao/
- **No seu computador:** o sistema usa módulos JavaScript, que não abrem com clique duplo. Na pasta do repositório, rode `python3 -m http.server` e abra http://localhost:8000/.

Para testar com dados, use o botão **Ver um exemplo**. O exemplo roda só na memória e nunca vai para o banco.

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

**Levar dados de uma instalação para outra:** em **Configurar o sistema**, baixe a cópia de segurança na origem e, no destino, com o banco ainda vazio, use **Restaurar uma cópia**.

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `index.html` | Estrutura da página |
| `css/estilo.css` | Aparência e temas claro e escuro |
| `js/` | O sistema, em módulos JavaScript por assunto: regras de cálculo, dados e telas |
| `testes/` | Testes automáticos (`node --test`, sem dependências) |
| `logo.png` | Logotipo (rosa dos ventos), também usado como ícone da aba do navegador |
| `config.js` | Configuração do Firebase (`null` = só memória) |
| `firestore.rules` | Regras de acesso ao banco de dados |
| `v2/index.html` | Leva o endereço antigo `/v2/` para o principal |
| `LICENSE` | Licença GPL v3 |
| `docs/documentacao-tecnica.md` | Modelo conceitual completo: arquitetura, dicionário de dados, regras de cálculo, interface, decisões, plano de trabalho e histórico |
| `docs/registro-de-execucao.md` | Diário das execuções em lote |
| `docs/manual-do-usuario.md` | Manual em linguagem simples (congelado; ainda descreve a versão 1) |
| `CONTRIBUTING.md` | Como colaborar |
| `AGENTS.md` | Regras de trabalho para quem contribui, pessoa ou assistente de IA |
| `CLAUDE.md` | Aponta para o `AGENTS.md` e traz instruções exclusivas do Claude |
| `GEMINI.md` | Aponta para o `AGENTS.md`, para o Gemini CLI carregá-lo sozinho |

O manual do usuário está **congelado** até o responsável liberar, para evitar retrabalho com telas que ainda mudam. Por isso, ele ainda descreve a versão 1.

## Como colaborar

Qualquer pessoa com uma conta gratuita do GitHub pode colaborar, sem precisar de ferramentas pagas. Leia o [guia de colaboração](CONTRIBUTING.md).

Resumo:

1. Para relatar um problema ou sugerir uma melhoria, abra uma **Issue**.
2. Para propor uma mudança no código ou na documentação, envie um **pull request**.
3. Toda mudança relevante deve vir acompanhada da atualização da documentação técnica.

## Licença

Distribuído sob a [GNU General Public License v3.0](LICENSE). Quem modificar e redistribuir o sistema deve manter o código aberto sob a mesma licença.
