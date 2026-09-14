# Botcord

Interface independente inspirada no Discord para conversar usando **o seu bot**, com assistente virtual de IA, uma página estática no GitHub Pages e um servidor Node.js separado.

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
- Assistente privado com respostas em streaming, histórico, análise de imagens, código e Markdown.
- Anotações, tarefas com prazo e memórias salvas por ferramentas reais, com edição e exclusão no painel.
- Pesquisa na web opcional, com links para as fontes.
- Resumo das últimas mensagens de um canal e sugestões de resposta para você revisar.
- DMs automáticas com permissão por pessoa, pausa, limite diário e contexto separado por contato.

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
npm ci
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

- Instalação: **npm ci --omit=dev**
- Inicialização: **npm start** ou **node server.mjs**
- Variáveis: **DISCORD_TOKEN**, **PANEL_PASSWORD**, **ALLOWED_ORIGINS** e a porta fornecida pelo host.
- Em **ALLOWED_ORIGINS**, inclua **https://iamkyo22.github.io**. Use a origem sem o caminho **/-3/** e sem barra final.
- Se um proxy estiver na frente do Node, desabilite buffering para **/api/events**. O servidor envia um heartbeat a cada 20 segundos.

Na página publicada, clique em **Conectar bot**, informe a origem HTTPS do host, por exemplo **https://seu-servidor.example**, e a senha do painel.

Há também um **Dockerfile**. Configure as variáveis no serviço que executar o contêiner. O token e o arquivo **.env** não devem ser incluídos na imagem, no repositório ou em variáveis públicas da página.

## Ativar a IA

A IA utiliza a **API da OpenAI**, com `gpt-6-astra` como modelo padrão. Não é um modelo treinado por este projeto nem uma cópia completa do aplicativo ChatGPT. O modelo suporta texto e entrada de imagens; as ferramentas implementadas aqui são pesquisa, notas, tarefas e memória. Veja o [modelo](https://developers.openai.com/api/docs/models/gpt-6-astra), a [entrada de imagens](https://developers.openai.com/api/docs/guides/images-vision) e as [ferramentas](https://developers.openai.com/api/docs/guides/function-calling).

1. Na sua conta da [plataforma OpenAI](https://platform.openai.com/api-keys), crie uma chave de API com acesso ao modelo e configure faturamento/limites. A assinatura do ChatGPT não configura essa chave no seu bot.
2. No **ambiente privado do servidor do bot**, adicione as variáveis abaixo. Não as coloque no HTML, JavaScript público ou repositório.
3. Atualize o servidor com esta versão e reinicie. Ele precisa alcançar `api.openai.com` por HTTPS, além do Discord.
4. No site, use **Conectar bot**. Clique em **Meu assistente** para conversar e na engrenagem da IA para personalizar.

~~~dotenv
OPENAI_API_KEY=sua_chave_privada
OPENAI_MODEL=gpt-6-astra
OPENAI_DM_MODEL=gpt-6-astra
AI_DATA_DIR=./data
~~~

Você pode definir outro modelo compatível com Responses API, entrada de imagens, raciocínio `medium` e function calling nas duas variáveis de modelo, conforme seu acesso e orçamento. Uma chave sem acesso ao modelo gera um aviso real, sem resposta simulada.

**O GitHub Pages serve somente a interface.** Ele não executa o bot, não guarda a chave e não mantém a IA online. Sem servidor conectado e chave válida, o site mostra as instruções de ativação. Não há IA secreta ou gratuita rodando no navegador.

### Conversar e organizar

- **Meu assistente:** conversas privadas no painel, com histórico. Texto de até 16 mil caracteres e até três imagens por envio, de até 4 MB cada e 8 MB somadas.
- **Imagens:** use o botão de anexo, cole um print ou arraste a imagem. Formatos PNG, JPG, WEBP e GIF; animação não é analisada como vídeo.
- **Interromper:** cancela a geração. Alterações que uma ferramenta já concluiu permanecem salvas e aparecem no histórico.
- **Notas, tarefas e memória:** peça, por exemplo, “Crie uma tarefa para revisar meu projeto” ou “Lembre que prefiro respostas curtas”. Os itens também podem ser adicionados e apagados no painel. Tarefas podem ter prazo; **não enviam lembretes por e-mail, push ou Discord** nesta versão.
- **Engrenagem da IA:** personalize nome, estilo, fuso, memória, pesquisa na web e limite de chamadas diárias.
- **Estrela no cabeçalho do chat:** resuma ou peça uma sugestão a partir das últimas 25 mensagens e até três imagens entre as três mensagens mais recentes.
- **Usar no chat:** coloca a resposta no campo de mensagem para revisão. Você decide quando enviar. Textos acima de 2.000 caracteres devem ser copiados em partes.

O assistente conversa de forma natural e mantém a identificação de IA. Ele pode escrever código e ajudar a estudar, mas não executa comandos no computador, não acessa contas pessoais, não gera imagens, não faz chamadas de voz e não possui automaticamente todas as ferramentas do ChatGPT. A interpretação de imagens e respostas pode conter erros.

### DMs automáticas

Abra **Configurações da IA → DMs automáticas**:

1. Habilite **Responder DMs automaticamente**.
2. Selecione os IDs permitidos, um por linha, ou escolha todas as pessoas que chamarem o bot.
3. Salve. As respostas começam nas próximas mensagens recebidas pelo **bot**, enquanto o servidor estiver executando.

- A automação vem desligada e não pode ser ligada sem a chave da IA configurada.
- Cada contato possui contexto, notas, tarefas e memória próprios, sem acesso ao espaço do operador ou de outras pessoas.
- A IA identifica suas respostas como **IA** e não responde a outros bots, webhooks ou canais de servidor automaticamente.
- Mensagens consecutivas são agrupadas com uma espera de 1,5 segundo. Eventos repetidos são deduplicados; o histórico antigo não dispara respostas ao reiniciar.
- Enviar uma mensagem manual pausa essa DM por dez minutos. O painel também permite pausar por tempo indeterminado ou retomar. Uma geração em andamento é interrompida ao mudar as permissões ou assumir a conversa.
- O contato pode enviar `/pausar-ia`. `/retomar-ia` remove a pausa do contato, mas continua respeitando as permissões do operador.
- Não há envio espontâneo a contatos que não escreveram ao bot. A IA não entra na sua conta pessoal do Discord.
- Em **Atividade e dados**, confira erros e respostas automáticas ou apague o contexto de um contato. Mensagens já enviadas no Discord permanecem lá.

### Dados, limites e hospedagem

- Monte `AI_DATA_DIR` em **disco persistente privado**. Ele contém `assistant.json`, com gravação por substituição atômica e arquivos criados com permissão `0600`. A pasta padrão `data/` é ignorada pelo Git e pelo Docker build. Não a exponha em um servidor de arquivos.
- No Docker, monte um volume em `/app/data`. O contêiner usa o usuário `node`; a pasta montada precisa permitir escrita para esse usuário.
- Execute **uma instância** do processo por pasta de dados. O armazenamento em JSON não coordena múltiplas réplicas. Faça backups privados dessa pasta.
- O histórico conserva até 80 mensagens por conversa. O modelo recebe até 30 mensagens recentes, limitadas a 40 mil caracteres, mais até 10 mil caracteres de memória. Imagens são conservadas nos dois envios mais recentes que contêm imagens.
- Limites de armazenamento: 200 conversas, 100 itens por coleção por pessoa, arquivo de dados de até 64 MB. Exclua conversas e imagens antigas se atingir o limite.
- Até três gerações simultâneas, uma por conversa, com até quatro etapas de modelo e tempo total de 150 segundos. O contexto e esses limites evitam crescimento indefinido de uso.
- O limite diário conta **chamadas ao modelo**, inclusive etapas de ferramentas, e reinicia à meia-noite UTC. As contagens de tokens vêm da API. Falhas de conexão também consomem a reserva de uma chamada. Configure limites financeiros na plataforma OpenAI; o contador local não é um orçamento em moeda.
- O servidor envia conteúdo à OpenAI com `store: false`. Isso não promete retenção zero: valem as [políticas de dados da API](https://developers.openai.com/api/docs/guides/your-data) para sua conta. O histórico privado continua salvo localmente no servidor para permitir continuidade.
- A chave da OpenAI e o token do Discord ficam no ambiente do servidor. O navegador recebe somente a sessão do painel e os dados da conversa autenticada.

Para atualizar um servidor existente, baixe a nova versão, execute `npm ci --omit=dev`, defina as variáveis, monte a pasta persistente e reinicie. Não substitua o `.env` existente pelo arquivo de exemplo vazio.

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

Os testes de IA usam um provedor simulado explicitamente nos testes. Eles exercitam o servidor HTTP e streaming reais, imagens multipartes na requisição do modelo, ferramentas que salvam tarefas, histórico em disco, isolamento entre pessoas, limites, cancelamento, pausa de DMs, Markdown seguro e configuração. Não gastam saldo da OpenAI. A qualidade do modelo e a conectividade com contas externas exigem uma chave e um bot reais no host de produção.

O fluxo **Verificar Botcord** executa esses testes no GitHub Actions e guarda capturas do navegador. A publicação existente do GitHub Pages acompanha a branch **main**.

## Arquivos

- **index.html**, **styles.css**, **app.js**: página estática.
- **assistant.js**, **assistant.css**: interface do assistente, histórico, imagens e organização pessoal.
- **server.mjs**, **lib/validation.mjs**: servidor do painel e integração com o Discord.
- **lib/assistant.mjs**, **lib/openai-provider.mjs**, **lib/assistant-store.mjs**, **lib/auto-dm.mjs**: modelo, streaming, persistência e respostas automáticas.
- **.env.example**: modelo de configuração sem credenciais.
- **tests/**: verificações de API e navegador.
- **scripts/preview.mjs**: servidor estático para desenvolver sem bot.

Projeto independente, sem vínculo oficial com o Discord. A edição de avatar, nome e banner usa a [API oficial de usuários](https://docs.discord.com/developers/resources/user#modify-current-user).
