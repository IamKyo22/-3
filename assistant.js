'use strict';
(() => {
  const ui = { active: false, data: null, thread: null, busy: false, partial: '', status: '', space: 'tasks',
    drafts: new Map(), loading: false, sending: false, reading: 0, seq: 0, poll: null, refreshTimer: null };
  const getDraft = () => {
    const key = ui.thread?.id || 'new';
    if (!ui.drafts.has(key)) ui.drafts.set(key,{ text: '', images: [], requestId: crypto.randomUUID() });
    return ui.drafts.get(key);
  };
  const offline = () => !state.real || !state.token;
  function errorBox(text) { return E('div','ai-error',text); }
  function link(text,url) { const a=E('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a; }
  function setupText(root) {
    root.append(E('h3','','Conecte a inteligência ao seu bot'),E('p','muted','A interface está pronta. Para conversar de verdade, conecte o servidor do bot com a chave da OpenAI configurada.'),
      E('p','hint','A chave fica nas variáveis privadas do servidor. Ela nunca deve ser colocada no GitHub ou nesta página.'),
      link('Abrir instruções de ativação','https://github.com/IamKyo22/-3#ativar-a-ia'),E('hr','section-line'),
      B('Conectar meu servidor',()=>{document.querySelector('dialog.ai-settings')?.close();settings('connection');},'btn primary'));
  }
  function drawConnection() {
    const root=$('aiConnection');root.replaceChildren();
    if(offline())root.append(icon('info'),E('span','','Conecte seu bot para usar a IA.'),B('Conectar',()=>settings('connection'),'btn quiet'));
    else if(!ui.data?.configured)root.append(icon('info'),E('span','','A IA precisa de uma chave configurada no servidor.'),B('Como ativar',()=>aiSettings(),'btn quiet'));
    root.hidden=!offline()&&!!ui.data?.configured;
    $('aiName').textContent=ui.data?.settings.name||'Nova';
    $('aiModel').textContent=ui.data?.configured?ui.data.model:'Seu assistente virtual';
    $('aiBudget').textContent=ui.data?.configured?`${ui.data.usage.calls}/${ui.data.settings.dailyLimit} chamadas hoje`:'';
    $('aiAutoLabel').textContent=ui.data?.settings.autoDM?'Ativas · gerenciar conversas':'Pausadas · configurar';
    $('aiAutomationButton').classList.toggle('enabled',!!ui.data?.settings.autoDM);
  }
  async function refresh() {
    if(offline()){ui.data=null;drawConnection();return;}
    const token=state.token;
    try{
      const data=await api('/assistant');if(token!==state.token)return;
      ui.data=data;drawConnection();drawThreads();drawSpace();renderDM();
    }catch(err){if(ui.active)toast(err.message);}
  }
  function schedulePoll() {
    clearTimeout(ui.poll);
    if(ui.active&&!offline()&&ui.thread?.id&&ui.busy)ui.poll=setTimeout(()=>loadThread(ui.thread.id,false),3000);
  }
  async function show(id) {
    ui.active=true;document.body.classList.add('ai-mode');
    document.querySelector('main.chat').hidden=true;$('members').hidden=true;
    $('assistantView').hidden=false;$('assistantAside').hidden=false;
    $('channels').hidden=true;$('aiThreads').hidden=false;
    $('assistantShortcut').classList.add('selected');$('serverTitle').textContent='Seu assistente';
    $('titleContext').textContent='✦ Meu assistente';document.title='Meu assistente · Botcord';
    renderServers();hideNavigation();drawConnection();drawThreads();drawMessages();drawComposer();drawSpace();
    await refresh();if(!ui.active)return;
    if(id)await loadThread(id);else if(ui.thread?.id)await loadThread(ui.thread.id,false);
  }
  function hide() {
    if(!ui.active)return;
    getDraft().text=$('aiInput').value;ui.active=false;ui.seq++;clearTimeout(ui.poll);
    document.body.classList.remove('ai-mode','show-ai-tools');
    document.querySelector('main.chat').hidden=false;$('members').hidden=false;
    $('assistantView').hidden=true;$('assistantAside').hidden=true;$('channels').hidden=false;$('aiThreads').hidden=true;
    $('assistantShortcut').classList.remove('selected');renderDM();
  }
  function reset() {
    ui.seq++;clearTimeout(ui.poll);clearTimeout(ui.refreshTimer);ui.data=null;ui.thread=null;
    ui.busy=false;ui.partial='';ui.drafts.clear();ui.sending=false;drawConnection();drawMessages();drawComposer();drawSpace();renderDM();
  }
  function newThread() {
    if(ui.sending){toast('Aguarde o envio da mensagem.');return;}
    getDraft().text=$('aiInput').value;ui.seq++;ui.thread=null;ui.busy=false;ui.partial='';ui.status='';
    clearTimeout(ui.poll);drawThreads();drawMessages();drawComposer();$('aiInput').focus();
  }
  async function loadThread(id,bottom=true) {
    if(offline())return;
    const seq=++ui.seq;
    try {
      const thread=await api('/assistant/threads/'+id);
      if(seq!==ui.seq||!ui.active)return;
      ui.thread=thread;ui.busy=thread.busy;ui.partial=thread.partial||'';ui.status=thread.status||'Pensando…';
      drawThreads();drawMessages(bottom);drawComposer();schedulePoll();
    }catch(err){if(seq===ui.seq)toast(err.message);}
  }
  function confirmAction(title,text,action) {
    const {d,body}=dialog(title);body.append(E('p','muted',text),B('Cancelar',()=>d.close(),'btn quiet'),B('Excluir',async()=>{
      try{await action();d.close();}catch(err){toast(err.message);}
    },'btn danger'));
  }
  function drawThreads() {
    const root=$('aiThreads');root.replaceChildren(B('+ Nova conversa',newThread,'channel ai-new-conversation'),E('span','category','SUAS CONVERSAS'));
    for(const t of ui.data?.threads||[]) {
      const row=E('div','ai-thread-row '+(t.id===ui.thread?.id?'selected':''));
      const b=B('',()=>{if(ui.sending)return;getDraft().text=$('aiInput').value;loadThread(t.id);},'channel');b.append(icon('hash'),E('span','channel-name',t.title));
      row.append(b,IB('trash','Excluir conversa '+t.title,()=>confirmAction('Excluir conversa?','O histórico desta conversa será removido. Suas notas e tarefas permanecem.',async()=>{
        await api('/assistant/threads/'+t.id,'DELETE');if(ui.thread?.id===t.id)newThread();await refresh();
      })));root.append(row);
    }
    if(!ui.data?.threads?.length)root.append(E('p','empty','Suas conversas aparecem aqui. Comece com uma pergunta, uma ideia ou uma imagem.'));
  }
  function inline(text) {
    const frag=document.createDocumentFragment();
    for(const part of text.split(/(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g)) {
      const match=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if(match)frag.append(link(match[1],match[2]));else frag.append(formatted(part));
    }
    return frag;
  }
  function rich(text) {
    const root=E('div','ai-markdown');
    const chunks=String(text).replace(/cite[^]*/g,'').split(/```([^\n`]*)\n([\s\S]*?)```/g);
    for(let i=0;i<chunks.length;i++) {
      if(i%3===1){
        const wrap=E('div','ai-code'),head=E('div','ai-code-head'),code=E('code','',chunks[++i]);
        head.append(E('span','',chunks[i-1].trim()||'código'),B('Copiar',()=>copy(code.textContent),'btn quiet'));
        const pre=E('pre');pre.append(code);wrap.append(head,pre);root.append(wrap);continue;
      }
      for(const line of chunks[i].split('\n')) {
        const heading=line.match(/^(#{1,3}) (.*)$/),bullet=line.match(/^(?:[-*] |\d+\. )(.*)$/);
        const node=E(heading?'h'+Math.min(heading[1].length+2,5):'p',bullet?'ai-list-line':'');
        node.append(inline(heading?heading[2]:bullet?'• '+bullet[1]:line));if(line==='')node.classList.add('ai-paragraph-break');root.append(node);
      }
    }
    return root;
  }
  async function copy(text) {
    try{await navigator.clipboard.writeText(text);toast('Copiado.');}catch{toast('Não foi possível copiar. Selecione o texto para copiar manualmente.');}
  }
  function drawMessages(bottom=false) {
    const scroller=$('aiScroller'),near=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<140,top=scroller.scrollTop;
    const root=$('aiMessages');root.replaceChildren();const list=ui.thread?.messages||[];
    $('aiWelcome').hidden=list.length>0;
    for(const m of list) {
      const row=E('article','ai-message '+(m.role==='user'?'ai-human':'ai-answer'));
      const av=E('span','ai-avatar',m.role==='user'?'EU':'✦'),body=E('div','ai-message-body'),head=E('div','ai-message-heading');
      head.append(E('strong','',m.role==='user'?'Você':ui.data?.settings.name||'Nova'));
      if(m.role==='assistant')head.append(E('span','ai-tag','IA'));
      head.append(E('time','',new Date(m.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})));body.append(head);
      if(m.content!==m.error)body.append(rich(m.content));
      if(m.images?.length){const images=E('div','ai-message-images');for(const f of m.images){
        if(f.url&&imageURL(f.url)){const b=B('',()=>imagePreview(f),'ai-image-preview'),img=E('img');img.src=f.url;img.alt=f.name;b.append(img);images.append(b);}
        else images.append(E('span','hint','📎 '+f.name+' · imagem antiga removida'));}body.append(images);}
      if(m.actions?.length){const actions=E('div','ai-action-chips');for(const a of [...new Set(m.actions)])actions.append(E('span','','✓ '+a));body.append(actions);}
      if(m.sources?.length){const sources=E('div','ai-sources');sources.append(E('b','','Fontes'));for(const s of m.sources)if(/^https?:\/\//.test(s.url))sources.append(link(s.title,s.url));body.append(sources);}
      if(m.error)body.append(errorBox(m.error));
      if(m.role==='assistant') {
        const actions=E('div','ai-message-actions');actions.append(IB('copy','Copiar resposta',()=>copy(m.content)));
        if(!m.error&&state.channel?.writable)actions.append(B('Usar no chat',()=>{
          if(m.content.length>2000){toast('A resposta tem mais de 2.000 caracteres. Copie e selecione o trecho que quer enviar.');return;}
          hide();draft().text=m.content;renderServers();renderChannels();renderMessages();renderComposer();$('messageInput').focus();toast('Rascunho preenchido. Revise e envie quando quiser.');
        },'btn quiet'));
        if(m.error)actions.append(B('Tentar novamente',()=>{
          const index=list.indexOf(m),user=list.slice(0,index).reverse().find(x=>x.role==='user');
          if(user){Object.assign(getDraft(),{text:user.content,images:(user.images||[]).filter(i=>i.url),requestId:crypto.randomUUID()});drawComposer();$('aiInput').focus();}
        },'btn quiet'));body.append(actions);
      }
      row.append(av,body);root.append(row);
    }
    if(ui.busy&&ui.partial){const stream=E('article','ai-message ai-answer ai-stream');stream.append(E('span','ai-avatar','✦'),E('div','ai-stream-text',ui.partial));root.append(stream);}
    $('aiProgress').hidden=!ui.busy;$('aiProgressText').textContent=ui.status||'Pensando…';
    if(bottom||near)scroller.scrollTop=scroller.scrollHeight;else scroller.scrollTop=top;
  }
  function imagePreview(file) {const {body}=dialog(file.name,'ai-lightbox');const img=E('img');img.src=file.url;img.alt=file.name;body.append(img);}
  function drawComposer() {
    const d=getDraft();$('aiInput').value=d.text;
    $('aiInput').disabled=ui.sending;$('aiAttach').disabled=ui.sending||ui.busy||ui.reading>0;
    $('aiSend').hidden=ui.busy;$('aiStop').hidden=!ui.busy;
    $('aiSend').disabled=ui.sending||ui.reading>0;
    const root=$('aiImageChips');root.replaceChildren();
    d.images.forEach((image,i)=>{const chip=E('div','ai-image-chip'),img=E('img');img.src=image.url;img.alt=image.name;
      const remove=IB('close','Remover imagem '+image.name,()=>{if(ui.sending)return;d.images.splice(i,1);drawComposer();});
      chip.append(img,E('span','',image.name),remove);root.append(chip);});
  }
  async function attach(files) {
    if(ui.sending||ui.busy)return;
    const d=getDraft();ui.reading++;drawComposer();
    try{
      for(const file of files) {
        if(d.images.length>=3)throw new Error('Envie no máximo três imagens por mensagem.');
        if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>4*1024*1024)throw new Error('Use PNG, JPG, WEBP ou GIF de até 4 MB.');
        if(d.images.reduce((n,i)=>n+i.url.length*0.75,0)+file.size>8*1024*1024)throw new Error('As imagens juntas precisam ter até 8 MB.');
        d.images.push({name:file.name,url:await readData(file)});
      }
    }catch(err){toast(err.message);}finally{ui.reading--;drawComposer();}
  }
  async function send(ev) {
    ev.preventDefault();if(ui.busy||ui.sending||ui.reading)return;
    if(offline()){settings('connection');return;}if(!ui.data?.configured){aiSettings();return;}
    const d=getDraft();d.text=$('aiInput').value;if(!d.text.trim()&&!d.images.length)return;
    ui.sending=true;drawComposer();let id=ui.thread?.id;
    try{
      if(!id){const t=await api('/assistant/threads','POST',{});ui.thread=t;id=t.id;ui.drafts.set(id,d);ui.drafts.delete('new');}
      await api('/assistant/threads/'+id+'/messages','POST',{text:d.text,images:d.images,requestId:d.requestId});
      d.text='';d.images=[];d.requestId=crypto.randomUUID();
      if(ui.active)await loadThread(id);await refresh();
    }catch(err){toast(err.message);if(id&&ui.active)await loadThread(id,false);}
    finally{ui.sending=false;drawComposer();}
  }
  function addItem() {
    if(offline()){settings('connection');return;}
    const kind=ui.space,label=({tasks:'tarefa',notes:'anotação',memories:'memória'})[kind],{d,body}=dialog('Adicionar '+label);
    const form=E('form'),input=E('textarea','input');input.required=true;input.maxLength=kind==='notes'?4000:1000;input.setAttribute('aria-label','Texto da '+label);
    const due=field('PRAZO (OPCIONAL)','','datetime-local');
    form.append(input);if(kind==='tasks')form.append(due.wrap);
    const save=B('Salvar',null,'btn primary');save.type='submit';form.append(save);body.append(form);
    form.onsubmit=async ev=>{ev.preventDefault();save.disabled=true;try{await api('/assistant/workspace/'+kind,'POST',{text:input.value,due:due.input.value?new Date(due.input.value).toISOString():null});d.close();await refresh();}catch(err){toast(err.message);}finally{save.disabled=false;}};input.focus();
  }
  function drawSpace() {
    const root=$('aiSpaceItems');root.replaceChildren();
    document.querySelectorAll('[data-space]').forEach(b=>b.classList.toggle('selected',b.dataset.space===ui.space));
    const list=ui.data?.workspace?.[ui.space]||[];
    for(const item of list){
      const row=E('div','ai-space-item '+(item.completed?'completed':'')),text=E('div','ai-space-text');
      if(ui.space==='tasks'){
        const check=E('input');check.type='checkbox';check.checked=item.completed;check.setAttribute('aria-label','Concluir '+item.text);
        check.onchange=async()=>{try{await api('/assistant/workspace/tasks/'+item.id,'PATCH',{completed:check.checked});await refresh();}catch(err){check.checked=!check.checked;toast(err.message);}};row.append(check);
      }
      text.append(E('p','',item.text));if(item.due)text.append(E('small',!item.completed&&Date.parse(item.due)<Date.now()?'overdue':'',new Date(item.due).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})));
      row.append(text,IB('trash','Excluir '+item.text.slice(0,30),()=>confirmAction('Excluir item?','Este item será removido do seu espaço.',async()=>{await api('/assistant/workspace/'+ui.space+'/'+item.id,'DELETE');await refresh();})));root.append(row);
    }
    if(!list.length)root.append(E('span','ai-space-empty-icon',ui.space==='tasks'?'☑':ui.space==='notes'?'≡':'✦'),E('p','ai-space-empty',({tasks:'Tudo em dia. Adicione uma tarefa ou peça à IA para organizar seu dia.',notes:'Um lugar para guardar suas ideias. Adicione uma nota ou peça durante a conversa.',memories:'O que você pedir para a IA lembrar aparece aqui. Você pode excluir quando quiser.'})[ui.space]));
    root.append(B('+ Adicionar '+({tasks:'tarefa',notes:'nota',memories:'memória'})[ui.space],addItem,'btn quiet ai-space-add'));
  }
  function switchRow(label,detail,checked,id) {
    const wrap=E('label','ai-switch-row'),text=E('span'),input=E('input');input.type='checkbox';input.checked=checked;input.id=id;
    text.append(E('strong','',label),E('small','',detail));wrap.append(text,input);return {wrap,input};
  }
  async function aiSettings(start='general') {
    if(!offline())await refresh();
    document.querySelector('dialog.ai-settings')?.close();
    const {d,body}=dialog('Assistente de IA','settings ai-settings');body.className='settings-shell';
    const nav=E('nav','settings-nav'),main=E('div','settings-main');body.append(nav,main);
    const pages=new Map();
    for(const [key,label]of [['general','Personalidade'],['automation','DMs automáticas'],['data','Atividade e dados']]){
      const section=E('section');section.hidden=key!==start;pages.set(key,section);main.append(section);
      const b=B(label,()=>{pages.forEach((p,k)=>p.hidden=k!==key);nav.querySelectorAll('button').forEach(n=>n.classList.toggle('selected',n===b));},'settings-tab '+(key===start?'selected':''));nav.append(b);
    }
    const general=pages.get('general'),automations=pages.get('automation'),data=pages.get('data');
    if(offline()){setupText(general);setupText(automations);data.append(E('p','muted','Conecte seu servidor para ver os dados da IA.'));return;}
    if(!ui.data){general.append(errorBox('Não foi possível carregar a configuração. Atualize o servidor para a versão com IA.'));return;}
    const s=ui.data.settings;
    general.append(E('h3','','Do seu jeito'),E('p','muted','Escolha como seu assistente conversa e o que ele pode lembrar.'));
    if(!ui.data.configured)setupText(general);
    const model=E('div','ai-model-card');model.append(icon('spark'),E('strong','',ui.data.model),E('span','',ui.data.configured?'Chave configurada no servidor':'Aguardando OPENAI_API_KEY'));general.append(model);
    const form=E('form'),name=field('NOME DO ASSISTENTE',s.name,'text','aiConfigName');name.input.maxLength=32;name.input.required=true;
    const tone=E('label','field','JEITO DE CONVERSAR'),instructions=E('textarea','input');instructions.id='aiInstructions';instructions.maxLength=3000;instructions.rows=4;instructions.value=s.instructions;instructions.placeholder='Ex.: português informal, respostas claras e exemplos de programação.';tone.append(instructions);
    const timezone=field('FUSO HORÁRIO',s.timezone,'text','aiTimezone'),limit=field('LIMITE DE CHAMADAS POR DIA',s.dailyLimit,'number','aiDailyLimit');limit.input.min=1;limit.input.max=1000;
    const memory=switchRow('Memória pessoal','Salva o que você pedir para lembrar, separado por pessoa.',s.memoryEnabled,'aiMemory');
    const web=switchRow('Pesquisar na web','Permite pesquisar informações atuais. Consome uso adicional da API.',s.webSearch,'aiWebSearch');
    const save=B('Salvar preferências',null,'btn primary');save.type='submit';
    form.append(name.wrap,tone,timezone.wrap,memory.wrap,web.wrap,limit.wrap,E('p','hint','O limite conta chamadas ao modelo, inclusive etapas de ferramentas. Ele reduz o uso, mas não substitui o limite financeiro da sua conta OpenAI.'),save);general.append(form);
    form.onsubmit=async ev=>{ev.preventDefault();save.disabled=true;try{ui.data=await api('/assistant/settings','PATCH',{name:name.input.value,instructions:instructions.value,timezone:timezone.input.value,dailyLimit:Number(limit.input.value),memoryEnabled:memory.input.checked,webSearch:web.input.checked});drawConnection();toast('Preferências salvas.');}catch(err){toast(err.message);}finally{save.disabled=false;}};
    automations.append(E('h3','','Uma ajuda nas suas DMs'),E('p','muted','A IA responde às mensagens recebidas pelo bot, com identificação de IA. Ela lê imagens anexadas e mantém o contexto de cada pessoa.'));
    const autoForm=E('form'),enabled=switchRow('Responder DMs automaticamente','Funciona enquanto o servidor do bot estiver ligado.',s.autoDM,'aiAutoDM');
    const policyLabel=E('label','field','QUEM PODE RECEBER RESPOSTAS'),policy=E('select','input');policy.id='aiPolicy';
    for(const [value,label]of [['allowlist','Somente os IDs abaixo'],['all','Todas as pessoas que chamarem o bot']]){const option=E('option','',label);option.value=value;policy.append(option);}policy.value=s.dmPolicy;policyLabel.append(policy);
    const idsLabel=E('label','field','IDS AUTORIZADOS'),ids=E('textarea','input');ids.id='aiAllowedUsers';ids.rows=4;ids.value=s.allowedUsers.join('\n');ids.placeholder='Um ID do Discord por linha';idsLabel.append(ids);idsLabel.hidden=policy.value==='all';policy.onchange=()=>idsLabel.hidden=policy.value==='all';
    const saveAuto=B('Salvar automação',null,'btn primary');saveAuto.type='submit';
    autoForm.append(enabled.wrap,policyLabel,idsLabel,E('p','hint','Quando você envia uma mensagem manual, a IA pausa essa DM por 10 minutos. O contato pode usar /pausar-ia. A IA não responde a outros bots, nem acessa suas conversas pessoais.'),saveAuto);automations.append(autoForm);
    autoForm.onsubmit=async ev=>{ev.preventDefault();saveAuto.disabled=true;try{
      const users=ids.value.split(/[\s,;]+/).filter(Boolean);
      if(enabled.input.checked&&policy.value==='allowlist'&&!users.length)throw new Error('Adicione pelo menos um ID ou selecione todas as pessoas.');
      ui.data=await api('/assistant/settings','PATCH',{autoDM:enabled.input.checked,dmPolicy:policy.value,allowedUsers:users});drawConnection();renderDM();toast('Automação salva.');
    }catch(err){toast(err.message);}finally{saveAuto.disabled=false;}};
    if(ui.data.dmConversations.length){automations.append(E('hr','section-line'),E('h3','','Conversas atendidas'));for(const dm of ui.data.dmConversations){
      const row=E('div','ai-dm-row'),paused=s.pausedChannels.includes(dm.channelId);row.append(E('span','',dm.userId+(dm.optedOut?' · pausada pelo contato':'')),B(paused?'Retomar':'Pausar',async()=>{
        try{ui.data=await api('/assistant/dms/'+dm.channelId+'/'+(paused?'resume':'pause'),'POST',{});d.close();aiSettings('automation');}catch(err){toast(err.message);}
      },'btn quiet'));automations.append(row);
    }}
    data.append(E('h3','','Você controla o contexto'),E('p','muted','Até 80 mensagens por conversa. A IA usa as 30 mais recentes, limitadas a 40 mil caracteres, além das memórias salvas. As imagens dos dois envios mais recentes ficam no histórico.'),
      E('p','hint','Dados são enviados à OpenAI para gerar respostas. O painel solicita store:false; as políticas de retenção da sua conta OpenAI continuam aplicáveis. O histórico local fica no servidor do bot.'),
      E('h4','','Apagar dados de uma DM'));
    for(const dm of ui.data.dmConversations)data.append(B('Excluir contexto de '+dm.userId,()=>confirmAction('Excluir dados desta DM?','Histórico, notas, tarefas e memórias dessa pessoa serão apagados. A preferência de pausa será mantida.',async()=>{
      await api('/assistant/dms/'+dm.userId,'DELETE');await refresh();d.close();aiSettings('data');
    }),'btn quiet'));
    data.append(E('hr','section-line'),E('h4','','Atividade recente'));
    for(const entry of ui.data.activity.slice(0,25)){const row=E('div','ai-activity');row.append(E('span',entry.kind==='error'?'ai-activity-error':'',entry.detail),E('small','',new Date(entry.time).toLocaleString('pt-BR')));data.append(row);}
    if(!ui.data.activity.length)data.append(E('p','hint','As respostas automáticas e os erros de conexão aparecem aqui.'));
  }
  async function context(mode) {
    if(!state.channel){toast('Abra uma conversa primeiro.');return;}
    if(offline()){settings('connection');return;}
    const channelId=state.channel.id;
    try{const result=await api('/assistant/context','POST',{channelId,mode});await show(result.threadId);}catch(err){toast(err.message);}
  }
  function contextMenu() {
    const {d,body}=dialog('A IA pode ajudar neste chat');
    body.append(E('p','muted','A IA analisa as últimas 25 mensagens e até três imagens recentes desta conversa.'),B('Resumir a conversa',()=>{d.close();context('summary');},'btn primary'),B('Sugerir uma resposta',()=>{d.close();context('draft');},'btn quiet'));
  }
  function renderDM() {
    const root=$('dmAutomation');root.replaceChildren();
    root.hidden=offline()||!!state.guild||!state.channel||ui.active;if(root.hidden)return;
    const cid=state.channel.id,dm=ui.data?.dmConversations.find(d=>d.channelId===cid),s=ui.data?.settings;
    const paused=s?.pausedChannels.includes(cid),taken=(dm?.takeoverUntil||0)>Date.now();
    const text=!s?.autoDM?'IA automática desativada':dm?.optedOut?'IA pausada pelo contato':paused?'IA pausada nesta conversa':taken?'Você assumiu esta DM · IA pausa por 10 min':'IA segue as permissões configuradas';
    root.append(icon('spark'),E('span','',text));
    if(s?.autoDM)root.append(B(paused||taken?'Retomar':'Pausar',async()=>{try{ui.data=await api('/assistant/dms/'+cid+'/'+(paused||taken?'resume':'pause'),'POST',{});renderDM();}catch(err){toast(err.message);}},'btn quiet'));
    else root.append(B('Configurar',()=>aiSettings('automation'),'btn quiet'));
  }
  let frame;
  function event(ev) {
    if(ev.type==='assistant_status'){clearTimeout(ui.refreshTimer);ui.refreshTimer=setTimeout(refresh,350);return;}
    if(ev.threadId!==ui.thread?.id)return;
    if(ev.type==='assistant_delta'){ui.busy=true;ui.partial+=ev.delta;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{drawMessages();drawComposer();});}
    if(ev.type==='assistant_progress'){ui.busy=true;ui.status=ev.status;$('aiProgressText').textContent=ev.status;$('aiProgress').hidden=false;}
    if(ev.type==='assistant_done'||ev.type==='assistant_error'){ui.busy=false;ui.partial='';if(ui.active)loadThread(ev.threadId);refresh();}
  }
  $('assistantShortcut').onclick=()=>show();
  bindIcon('aiMobileMenu','menu',()=>{const open=document.body.classList.toggle('show-nav');$('navBackdrop').hidden=!open;});
  bindIcon('aiNew','plus',newThread);bindIcon('aiConfig','settings',()=>aiSettings());
  bindIcon('aiToolsToggle','notebook',()=>document.body.classList.toggle(innerWidth>1250?'hide-ai-tools':'show-ai-tools'));
  bindIcon('aiAttach','attach',()=>$('aiFiles').click());bindIcon('aiSend','send');bindIcon('aiAddTask','plus',addItem);
  $('aiAutomationButton').onclick=()=>aiSettings('automation');
  $('aiStop').onclick=async()=>{if(ui.thread?.id)try{await api('/assistant/threads/'+ui.thread.id+'/cancel','POST',{});await loadThread(ui.thread.id,false);}catch(err){toast(err.message);}};
  $('aiComposer').onsubmit=send;$('aiInput').oninput=()=>{getDraft().text=$('aiInput').value;};
  $('aiInput').onkeydown=ev=>{if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();$('aiComposer').requestSubmit();}};
  $('aiFiles').onchange=ev=>{attach(ev.target.files);ev.target.value='';};
  $('aiInput').onpaste=ev=>{const files=[...ev.clipboardData.files];if(files.length){ev.preventDefault();attach(files);}};
  $('assistantView').ondragover=ev=>{if(ev.dataTransfer.types.includes('Files')){ev.preventDefault();$('aiComposer').classList.add('dragging');}};
  $('assistantView').ondragleave=ev=>{if(!$('assistantView').contains(ev.relatedTarget))$('aiComposer').classList.remove('dragging');};
  $('assistantView').ondrop=ev=>{ev.preventDefault();$('aiComposer').classList.remove('dragging');attach(ev.dataTransfer.files);};
  document.querySelectorAll('[data-space]').forEach(b=>b.onclick=()=>{ui.space=b.dataset.space;drawSpace();});
  const prompts=[['spark','Entender uma imagem','Envie uma foto, print ou desenho','Analise esta imagem e me explique os detalhes importantes.'],['edit','Criar alguma coisa','Textos, código e ideias melhores','Me ajude a criar um projeto. Vou explicar minha ideia: '],['notebook','Organizar meu dia','Transforme planos em tarefas','Me ajude a organizar meu dia e salvar minhas tarefas.'],['info','Aprender de verdade','Explicações que fazem sentido','Me explique um assunto de forma simples, com exemplos: ']];
  for(const [name,title,description,prompt]of prompts){const b=B('',()=>{getDraft().text=prompt;drawComposer();$('aiInput').focus();if(title==='Entender uma imagem')$('aiFiles').click();},'ai-suggestion');b.append(icon(name),E('strong','',title),E('span','',description));$('aiSuggestions').append(b);}
  window.BotcordAI={get active(){return ui.active;},show,hide,reset,refresh,event,settings:aiSettings,context,contextMenu,renderDM};
  drawConnection();drawComposer();drawSpace();renderServers();
})();
