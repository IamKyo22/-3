# Botcord

Interface independente inspirada no Discord para conversar usando **o seu bot**, com uma página estática no GitHub Pages e um servidor Node.js separado.

**Abrir a página:** https://iamkyo22.github.io/-3/

## O que funciona

- Servidores, canais de texto e tópicos ativos aos quais o bot tem acesso.
- Mensagens e indicador de digitação em tempo real, com reconexão.
- Histórico paginado, respostas, edição e exclusão das mensagens do próprio bot.
- Reações, emojis e até 3 anexos, com limite total de 8 MB neste painel.
- Nome, avatar e banner globais do bot; apelido por servidor; status e atividade.
- DMs recebidas durante a execução e abertura de uma conversa pelo ID da pessoa.
- Lista de membros paginada, busca nas mensagens carregadas, Ctrl+K e layout mobile.
- Tema escuro, claro ou preto, modo compacto e tamanho de texto.
- Demonstração local que permite experimentar sem credenciais.

Uma instalação do servidor controla **um bot**. A senha dá controle desse bot a quem a possui. Este projeto não é uma plataforma com contas independentes para vários usuários.

## Conectar um bot real

### 1. Criar e preparar o bot

1. Abra o [Discord Developer Portal](https://discord.com/developers/applications).
2. Crie uma aplicação ou abra a sua e entre em **Bot**.
3. Habilite **Message Content Intent**, **Server Members Intent** e **Presence Intent**. O código utiliza os três.
4. Gere/copie o token do bot e guarde-o somente no ambiente do servidor.
5. Adicione o bot ao seu servidor pelo gerador de URL OAuth2, com escopo **bot**.
6. Conceda **Ver canais**, **Enviar mensagens**, **Ler histórico**, **Adicionar reações**, **Anexar arquivos**, **Inserir links**, **Alterar apelido** e **Enviar mensagens em tópicos** conforme os canais que pretende usar. Não é necessário Administrador.

A disponibilidade dos intents depende das regras e aprovações da sua aplicação no Discord. Veja a [documentação oficial](https://docs.discord.com/developers/events/gateway).

### 2. Executar no seu computador

Instale **Node.js 22.12 ou superior**.

Baixe este repositório, abra um terminal na pasta e execute:

~~~sh
npm install
~~~

Copie o arquivo **.env.example** para **.env** e preencha:

~~~dotenv
DISCORD_TOKEN=token_do_seu_bot
PANEL_PASSWORD=uma_senha_longa_aleatoria_com_pelo_menos_32_caracteres
ALLOWED_ORIGINS=https://iamkyo22.github.io,http://localhost:3000
PORT=3000
~~~

Você pode gerar uma senha aleatória com:

~~~sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
~~~

Depois execute:

~~~sh
npm start
~~~

Abra **http://localhost:3000**. Entre em **Conectar bot**, use **http://localhost:3000** como endereço e a sua **PANEL_PASSWORD** como senha.

O token do Discord nunca é digitado na página. A sessão do painel fica somente na memória da aba; ao recarregar, entre novamente.

### 3. Usar a página do GitHub Pages com o bot

O GitHub Pages hospeda a interface. Para o bot ficar disponível, mantenha o servidor Node.js executando em um host com **HTTPS**, acesso de saída ao Discord e suporte a conexões HTTP longas.

No host:

- Instalação: **npm install --omit=dev**
- Inicialização: **npm start** ou **node server.mjs**
- Variáveis: **DISCORD_TOKEN**, **PANEL_PASSWORD**, **ALLOWED_ORIGINS** e a porta fornecida pelo host.
- Em **ALLOWED_ORIGINS**, inclua **https://iamkyo22.github.io**. Use a origem sem o caminho **/-3/** e sem barra final.
- Se um proxy estiver na frente do Node, desabilite buffering para **/api/events**. O servidor envia um heartbeat a cada 20 segundos.

Na página publicada, clique em **Conectar bot**, informe a origem HTTPS do host, por exemplo **https://seu-servidor.example**, e a senha do painel.

Há também um **Dockerfile**. Configure as variáveis no serviço que executar o contêiner. O token e o arquivo **.env** não devem ser incluídos na imagem, no repositório ou em variáveis públicas da página.

## Personalizar e conversar

- **Engrenagem → Meu perfil:** nome, imagem e banner, com prévia. As imagens de perfil têm limite de 2 MB no painel.
- **Apelido no servidor:** usa o servidor selecionado. Deixe vazio para remover o apelido.
- **Status e atividade:** altera a presença do bot enquanto ele está em execução.
- **Enter:** envia. **Shift+Enter:** quebra linha. **Seta para cima** com campo vazio: edita sua última mensagem carregada.
- Passe o mouse por uma mensagem para responder, reagir ou alterar uma mensagem do bot.
- **Ctrl+K:** encontra canais do servidor atual.
- **Casa → Nova mensagem direta:** informe o ID da pessoa.
- **+ na coluna de servidores:** abre o convite OAuth2 do seu bot.

## Limites desta versão

- Mensagens reais são enviadas pelo bot e mantêm a identificação APP/bot do Discord.
- Voz, vídeo, tela compartilhada, Nitro, lista de amigos e interface de fóruns não estão implementados.
- O bot só acessa os servidores e canais permitidos a ele.
- A busca filtra o histórico já carregado; carregue páginas anteriores para ampliar a busca.
- A lista inicial de membros tem até 100 entradas; **Carregar mais membros** busca a próxima página.
- A lista de DMs conhecidas é mantida em memória no servidor. Após reiniciar, reabra pelo ID ou aguarde uma nova mensagem.
- As mensagens reais permanecem no Discord. O painel não grava o histórico real no armazenamento do navegador.
- As preferências e a demonstração ficam no armazenamento local do navegador, sujeito ao espaço disponível.
- Menções em massa e notificações de menção estão desabilitadas nos envios deste painel.
- Os limites do Discord podem ser mais restritivos, especialmente para imagens, nomes, anexos e frequência de alterações.
- O servidor usa senha e sessões de 12 horas, validação de origem e limites de requisições. Mantenha-o atrás de HTTPS quando remoto.

## Desenvolvimento e verificação

~~~sh
npm run preview
npm run check
npm test
npx playwright install chromium
npm run test:ui
~~~

A prévia abre em **http://127.0.0.1:4173/-3/** e não se conecta ao Discord.

Os testes de API usam um cliente falso. Os testes de navegador cobrem mensagens, respostas, edição, exclusão, reações, imagens, perfil, temas, navegação mobile, proteção contra HTML injetado e falha de envio com preservação de rascunho. Eles não enviam mensagens ao Discord real.

O fluxo **Verificar Botcord** executa esses testes no GitHub Actions e guarda capturas do navegador. A publicação existente do GitHub Pages acompanha a branch **main**.

## Arquivos

- **index.html**, **styles.css**, **app.js**: página estática.
- **server.mjs**, **lib/validation.mjs**: servidor do painel e integração com o Discord.
- **.env.example**: modelo de configuração sem credenciais.
- **tests/**: verificações de API e navegador.
- **scripts/preview.mjs**: servidor estático para desenvolver sem bot.

Projeto independente, sem vínculo oficial com o Discord. A edição de avatar, nome e banner usa a [API oficial de usuários](https://docs.discord.com/developers/resources/user#modify-current-user).
