'use strict';
const $ = id => document.getElementById(id);
const EMOJIS = ['😀','😂','🥹','😭','😎','💀','🤡','❤️','💜','🔥','✨','👍','👎','👀','🎉','✅','⚡','🫡','🤝','🌙'];
const ICONS = {
  spark: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8z"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M2 7h6M2 12h6M2 17h6M11 8h5M11 12h5"/>',
  hash: '<path d="M5 9h14M4 15h14M11 3L7 21M17 3l-4 18"/>',
  home: '<path d="M3 10l9-7 9 7v10H3zM9 20v-7h6v7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  settings: '<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0112 0v2M17 5a3 3 0 010 6M18 14a5 5 0 013 4v2"/>',
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 008 0M8 9h.01M16 9h.01"/>',
  send: '<path d="M21 3L3 10l8 3 3 8 7-18zM11 13L21 3"/>',
  attach: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
  reply: '<path d="M9 5l-6 6 6 6M3 11h11a6 6 0 016 6"/>',
  edit: '<path d="M15 4l5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  voice: '<path d="M11 4L6 8H3v8h3l5 4zM15 8a6 6 0 010 8M18 5a10 10 0 010 14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};
function E(tag, cls = '', text = '') {
  const n = document.createElement(tag); if (cls) n.className = cls;
  if (text !== '') n.textContent = String(text); return n;
}
function icon(name) {
  const n = document.createElementNS('http://www.w3.org/2000/svg','svg');
  n.setAttribute('viewBox','0 0 24 24'); n.setAttribute('class','icon'); n.setAttribute('aria-hidden','true');
  n.innerHTML = ICONS[name] || ICONS.hash; return n;
}
function B(text, handler, cls = 'btn') {
  const b = E('button', cls, text); b.type = 'button'; b.onclick = handler; return b;
}
function IB(name, label, handler) {
  const b = B('', handler, 'icon-button'); b.append(icon(name)); b.title = label; b.setAttribute('aria-label', label); return b;
}
function local(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { toast('O navegador está sem espaço para salvar a demonstração.'); } }
let toastTimer, typingTimer, typingAt = 0, refreshTimer, structureTimer, retryTimer;
function toast(text) {
  $('toast').textContent=text; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);
}
const defaultMe = { id:'self', username:'Dead', name:'Dead', avatar:'', banner:'', bot:true, status:'online', activity:'Jujutsu Shenanigans' };
const people = [
  {id:'magic',username:'magicglad',name:'Magicglad',color:'#c8a6ef',status:'online',activity:'Explorando a ilha'},
  {id:'natsuki',username:'natsuki',name:'Natsuki',color:'#e99bba',status:'online'},
  {id:'agnaldo',username:'agnaldo',name:'Agnaldo',color:'#6ac4a4',status:'idle'},
  {id:'sayori',username:'sayori',name:'Sayori',color:'#ebb87f',status:'online'},
  {id:'kaiser',username:'kaiser',name:'Kaiser',color:'#9ca9f1',status:'dnd'}
];
let demoMe=local('botcord.profile',defaultMe);
const demoGuilds=local('botcord.guilds',[
  {id:'resenha',name:'a resenha',initials:'R',icon:'',nickname:''},
  {id:'arena',name:'Arena',initials:'A',icon:'',nickname:''},
  {id:'lab',name:'Laboratório',initials:'L',icon:'',nickname:''}
]);
let preferences=local('botcord.preferences',{theme:'dark',compact:false,size:16});
function demoChannels(gid) {
  return ['geral','jogos','mídias','música','clipes'].map((name,i)=>({
    id:gid+'-'+i,guildId:gid,name,text:true,writable:true,
    category:i===0?'BEM-VINDO À RESENHA':'CANAIS DE TEXTO',
    topic:i===0?'Conversa, jogo e uma quantidade questionável de caos.':'O seu espaço para '+name
  }));
}
let database=local('botcord.messages',null);
if (!database || typeof database!=='object' || Array.isArray(database)) {
  database={};
  const lines=[
    [0,'cheguei. quem vai jogar hoje?'],
    [1,'eu! já separei os clipes de ontem 👀'],
    [2,'alquem sabe como muda a foto'],
    [0,'Agnaldo primeiro vai em configurações. A gramática a gente configura depois.'],
    [3,'o avatar e o banner ficam na engrenagem ali embaixo 🥹'],
    [4,'Bora. O lobby não vai se ganhar sozinho.']
  ];
  database['resenha-0']=lines.map(([who,content],i)=>({
    id:'demo-'+i,channelId:'resenha-0',guildId:'resenha',content,author:people[who],
    time:Date.now()-(lines.length-i)*180000,files:[],
    reactions:i===3?[{key:'💀',name:'💀',count:3,me:false},{key:'😂',name:'😂',count:2,me:false}]:[]
  }));
}
const state={
  real:false,token:'',origin:'',live:false,me:demoMe,guilds:demoGuilds,guild:'resenha',
  channels:[],channel:null,messages:[],members:[],after:null,dms:[],unread:{},drafts:{},
  collapsed:new Set(),loading:false,sending:false,reading:false,more:false,sequence:0,navigation:0,
  invite:'',stream:null
};
function applyPreferences() {
  document.documentElement.dataset.theme=preferences.theme;
  document.documentElement.style.setProperty('--font-size',preferences.size+'px');
  document.body.classList.toggle('compact',!!preferences.compact);
}
function imageURL(value) {
  if(typeof value!=='string')return '';
  if(/^data:image\/(?:png|jpeg|gif|webp);base64,/.test(value))return value;
  try {const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
function avatar(p, dot=false) {
  const a=E('span','avatar',(p.initials||p.name||p.username||'?').slice(0,2).toUpperCase());
  const hue=[...(p.id||p.name||'')].reduce((n,c)=>n+c.charCodeAt(0)*13,0)%360;
  a.style.background=`linear-gradient(145deg,hsl(${hue} 38% 53%),hsl(${hue} 35% 32%))`;
  const url=imageURL(p.avatar||p.icon);
  if(url){const img=E('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();a.append(img);}
  if(dot)a.append(E('i','status-dot '+(p.status||'offline')));
  return a;
}
function badge(){return E('span','app-badge','APP');}
function dialog(title,cls='popup') {
  const d=E('dialog',cls),head=E('div','dialog-heading'),heading=E('h2','',title),body=E('div','dialog-body');
  heading.id='dialog-'+crypto.randomUUID();d.setAttribute('aria-labelledby',heading.id);
  head.append(heading,IB('close','Fechar',()=>d.close()));d.append(head,body);document.body.append(d);
  d.addEventListener('click',ev=>{if(ev.target===d)d.close();});d.addEventListener('close',()=>d.remove());d.showModal();
  return {d,body};
}
function field(label,value='',type='text',id) {
  const wrap=E('label','field',label),input=E('input','input');input.type=type;input.value=value;
  if(id)input.id=id;wrap.append(input);return {wrap,input};
}
function renderProfile(p,host) {
  const banner=E('div','profile-banner'),details=E('div','profile-details'),url=imageURL(p.banner);
  if(url){const img=E('img');img.src=url;img.alt='Banner do perfil';banner.append(img);}
  const title=E('h3','',p.name||p.username);if(p.bot)title.append(badge());
  details.append(avatar(p),title,E('p','',p.username),E('hr'),E('b','eyebrow','SOBRE ESTE PERFIL'),
    E('p','',p.activity?'Jogando '+p.activity:p.bot?'Perfil do bot':'Membro da comunidade'));
  host.replaceChildren(banner,details);
}
async function showProfile(p) {
  const {d,body}=dialog('Perfil');body.style.padding='0';renderProfile(p,body);
  if(state.real){
    try{const fresh=await api('/users/'+p.id);if(d.open)renderProfile({...p,...fresh,name:p.name},body);}
    catch(err){toast(err.message);}
  }
}
function renderSelf() {
  const b=$('selfButton'),info=E('span','self-info');
  info.append(E('strong','',state.me.name||state.me.username),E('small','',
    ({online:'Disponível',idle:'Ausente',dnd:'Não perturbar',invisible:'Invisível',offline:'Offline'})[state.me.status]||'Disponível'));
  b.replaceChildren(avatar(state.me,true),info);
  $('connectButton').textContent=state.real?'Conectado · '+state.me.username:'Conectar bot';
  $('connectionState').textContent=state.real?(state.live?'AO VIVO':'RECONECTANDO'):'DEMONSTRAÇÃO';
  $('connectionState').classList.toggle('live',state.real&&state.live);
  const notice=$('notice');notice.hidden=state.real&&state.live;
  notice.replaceChildren(icon('info'),E('span','',state.real?'Reconectando ao bot. O histórico será atualizado ao voltar.':'Modo demonstração · As mensagens ficam neste navegador.'));
  if(!state.real)notice.append(B('Conectar meu bot',()=>settings('connection')));
}
function renderServers() {
  const root=$('servers');root.replaceChildren();
  const aiOpen=!!window.BotcordAI?.active;
  const home=B('',()=>chooseGuild(null),'server '+(!state.guild&&!aiOpen?'selected':''));
  home.append(icon('home'));home.title='Mensagens diretas';home.setAttribute('aria-label','Mensagens diretas');
  root.append(home,E('div','rail-divider'));
  const ai=B('',()=>window.BotcordAI?.show(),'server ai-server '+(aiOpen?'selected':''));ai.append(icon('spark'));ai.title='Meu assistente de IA';ai.setAttribute('aria-label',ai.title);root.append(ai);
  for(const g of state.guilds) {
    const b=B('',()=>chooseGuild(g.id),'server '+(g.id===state.guild&&!aiOpen?'selected':''));
    b.title=g.name;b.setAttribute('aria-label',g.name);b.append(avatar(g));
    if(state.unread[g.id])b.append(E('span','rail-unread'));root.append(b);
  }
  const add=B('',()=>state.real&&state.invite?window.open(state.invite,'_blank','noopener,noreferrer'):settings('connection'),'server server-add');
  add.append(icon('plus'));add.title='Adicionar o bot a um servidor';add.setAttribute('aria-label',add.title);
  root.append(add,E('span','rail-bottom','BOTCORD'));
}
function renderChannels() {
  $('serverTitle').textContent=window.BotcordAI?.active?'Seu assistente':state.guild?state.guilds.find(g=>g.id===state.guild)?.name||'Servidor':'Mensagens diretas';
  const root=$('channels');root.replaceChildren();
  if(!state.guild)root.append(B('+ Nova mensagem direta',newDM,'channel dm-add'));
  let category='';
  for(const ch of state.channels) {
    if(state.guild&&ch.category!==category) {
      category=ch.category;const group=category,key=state.guild+':'+category;
      const cat=B('',()=>{state.collapsed.has(key)?state.collapsed.delete(key):state.collapsed.add(key);renderChannels();},'category '+(state.collapsed.has(key)?'collapsed':''));
      cat.append(icon('chevron'),E('span','',group));root.append(cat);
    }
    if(state.guild&&state.collapsed.has(state.guild+':'+ch.category))continue;
    const b=B('',()=>chooseChannel(ch),'channel '+(state.channel?.id===ch.id?'selected':''));
    b.append(icon(ch.text?'hash':'voice'),E('span','channel-name',ch.name));
    b.setAttribute('aria-label',(ch.text?'Canal ':'Canal indisponível ')+ch.name);
    if(state.unread[ch.id])b.append(E('span','unread-count',state.unread[ch.id]));
    if(!ch.text){b.disabled=true;b.title='Voz e fóruns não estão implementados neste painel.';}
    root.append(b);
  }
  if(!state.channels.length)root.append(E('p','empty',state.guild?'Nenhum canal disponível para o bot.':'Abra uma conversa pelo ID. As DMs recebidas pelo bot também aparecem aqui.'));
}
function renderMembers() {
  $('memberHeading').textContent='MEMBROS — '+state.members.length;
  const root=$('memberList');root.replaceChildren();
  const sorted=[...state.members].sort((a,b)=>Number(b.status==='online')-Number(a.status==='online')||a.name.localeCompare(b.name));
  for(const p of sorted){
    const b=B('',()=>showProfile(p),'member'),texts=E('span','member-text'),name=E('strong','',p.name);
    if(/^#[0-9a-f]{6}$/i.test(p.color||''))name.style.color=p.color;texts.append(name);
    if(p.activity)texts.append(E('small','',p.activity));
    b.append(avatar(p,true),texts);if(p.bot)b.append(badge());root.append(b);
  }
  $('moreMembers').hidden=!state.after;
  document.querySelector('.community-note').hidden=state.real;
}
function formatted(text) {
  const frag=document.createDocumentFragment();
  for(const part of text.split(/(\*\*[^*\n]+\*\*|\x60[^\x60\n]+\x60|\|\|[^|\n]+\|\||https?:\/\/[^\s<>]+)/g)){
    if(part.startsWith('**')&&part.endsWith('**'))frag.append(E('strong','',part.slice(2,-2)));
    else if(part.startsWith('\x60')&&part.endsWith('\x60'))frag.append(E('code','',part.slice(1,-1)));
    else if(part.startsWith('||')&&part.endsWith('||')){
      const b=B(part.slice(2,-2),()=>b.classList.toggle('revealed'),'spoiler');b.setAttribute('aria-label','Revelar spoiler');frag.append(b);
    }else if(/^https?:\/\//.test(part)){
      const a=E('a','',part);a.href=part;a.target='_blank';a.rel='noopener noreferrer';frag.append(a);
    }else frag.append(document.createTextNode(part));
  }
  return frag;
}
function renderMessages(bottom=false) {
  const scroll=$('messageScroller'),top=scroll.scrollTop,near=scroll.scrollHeight-top-scroll.clientHeight<100;
  const ch=state.channel,query=$('search').value.trim().toLocaleLowerCase();
  $('channelTitle').textContent=ch?.name||'Escolha um canal';$('channelTopic').textContent=ch?.topic||'';
  $('welcomeTitle').textContent=ch?'Bem-vindo a #'+ch.name+'!':'Sua conversa começa aqui';
  $('welcomeText').textContent=ch?'Este é o espaço de #'+ch.name+'.':'Escolha um canal ou abra uma mensagem direta.';
  if(!window.BotcordAI?.active){document.title=(ch?'#'+ch.name+' · ':'')+'Botcord';
    $('titleContext').textContent=ch?(state.guild?'# ':'@ ')+ch.name:'Seu espaço. Suas conversas.';}
  const root=$('messages');root.replaceChildren();let lastDate='',previous=null;
  const filtered=state.messages.filter(m=>(m.content+' '+m.author.name).toLocaleLowerCase().includes(query));
  for(const m of filtered){
    const date=new Date(m.time).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
    if(date!==lastDate){root.append(E('div','date-divider',date));lastDate=date;}
    const row=E('article','message');row.tabIndex=0;row.id='message-'+m.id;row.dataset.messageId=m.id;
    if(previous&&previous.author.id===m.author.id&&m.time-previous.time<300000&&!m.replyId)row.classList.add('message-grouped');
    previous=m;
    const av=B('',()=>showProfile(m.author),'avatar-button');av.setAttribute('aria-label','Perfil de '+m.author.name);av.append(avatar(m.author));
    const body=E('div','message-body'),heading=E('div','message-heading'),name=B(m.author.name,()=>showProfile(m.author),'author');
    if(/^#[0-9a-f]{6}$/i.test(m.author.color||''))name.style.color=m.author.color;
    heading.append(name);if(m.author.bot)heading.append(badge());
    const time=E('time','',new Date(m.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));time.dateTime=new Date(m.time).toISOString();heading.append(time);
    if(m.replyId){
      const original=state.messages.find(x=>x.id===m.replyId);
      body.append(B('↳ '+(original?original.author.name+': '+original.content.slice(0,85):'Resposta a uma mensagem'),
        ()=>$('message-'+m.replyId)?.scrollIntoView({behavior:'smooth',block:'center'}),'reply-preview'));
    }
    body.append(heading);const content=E('div','message-content');content.append(formatted(m.content));
    if(m.edited)content.append(E('small','edited',' (editado)'));body.append(content);
    for(const f of m.files||[]){
      if(!/^https:\/\//.test(f.url||'')&&!imageURL(f.url))continue;
      const a=E('a','attachment');a.href=f.url;a.target='_blank';a.rel='noopener noreferrer';
      if(/^image\/(png|jpeg|webp|gif)$/.test(f.type)&&imageURL(f.url)){
        const img=E('img');img.src=f.url;img.alt=f.name;img.loading='lazy';a.append(img);
      }else a.textContent='📎 '+f.name;body.append(a);
    }
    const reactions=E('div','reactions');
    for(const r of m.reactions||[])reactions.append(B(r.name+' '+r.count,()=>react(m,r.key,r.me),'reaction '+(r.me?'mine':'')));
    body.append(reactions);
    const actions=E('div','message-actions');
    actions.append(IB('emoji','Reagir',()=>emojiPicker(emoji=>react(m,emoji,false))),IB('reply','Responder',()=>reply(m)));
    actions.append(IB('spark','Pedir ajuda à IA',()=>window.BotcordAI?.context('draft')));
    if(m.author.id===state.me.id)actions.append(IB('edit','Editar mensagem',()=>editMessage(m)),IB('trash','Excluir mensagem',()=>deleteMessage(m)));
    row.append(av,body,actions);root.append(row);
  }
  if(query&&!filtered.length)root.append(E('p','empty','Nenhuma das mensagens carregadas corresponde à busca.'));
  $('olderButton').hidden=!state.more||state.loading;
  if(bottom||near)scroll.scrollTop=scroll.scrollHeight;else scroll.scrollTop=top;
}
function draft() {
  return state.channel?(state.drafts[state.channel.id]||=( {text:'',files:[],reply:null} )):{text:'',files:[],reply:null};
}
function renderComposer() {
  const d=draft(),blocked=!state.channel?.writable||state.loading||state.sending||state.reading;
  $('messageInput').value=d.text;
  $('messageInput').placeholder=state.channel?(state.channel.writable?'Conversar em #'+state.channel.name:'Você só pode ler este canal'):'Escolha um canal';
  for(const id of ['messageInput','attachButton','emojiButton','sendButton'])$(id).disabled=blocked;
  $('messageCount').textContent=d.text.length+'/2000';$('replyBar').hidden=!d.reply;
  $('replyLabel').textContent=d.reply?'Respondendo a '+d.reply.author.name:'';
  const chips=$('fileChips');chips.replaceChildren();
  d.files.forEach((f,i)=>chips.append(B('📎 '+f.name+' ×',()=>{if(state.sending||state.reading)return;d.files.splice(i,1);renderComposer();},'file-chip')));
}
function mergeMessages(a,b) {
  const map=new Map(a.map(m=>[m.id,m]));for(const m of b)map.set(m.id,m);
  return [...map.values()].sort((x,y)=>x.time-y.time);
}
function persistDemo(){persist('botcord.messages',database);}
async function api(path,method='GET',data) {
  const requestToken=state.token;
  const res=await fetch(state.origin+'/api'+path,{
    method,headers:{Authorization:'Bearer '+state.token,...(data!==undefined?{'Content-Type':'application/json'}:{})},
    ...(data!==undefined?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(45000)
  });
  if(requestToken!==state.token)throw new Error('A conexão do painel mudou.');
  let value;try{value=await res.json();}catch{throw new Error('O servidor não retornou uma resposta válida.');}
  if(!res.ok){
    if(res.status===401&&state.real){state.token='';state.live=false;stopStream();window.BotcordAI?.reset();renderSelf();settings('connection');}
    throw new Error(value.error||'Não foi possível concluir.');
  }
  return value;
}
async function chooseGuild(gid) {
  window.BotcordAI?.hide();
  const nav=++state.navigation;++state.sequence;state.guild=gid;state.channel=null;state.messages=[];
  state.channels=[];state.members=[];state.after=null;state.loading=false;state.more=false;delete state.unread[gid];
  renderServers();renderChannels();renderMessages();renderComposer();renderMembers();
  try{
    const channels=state.real?(gid?await api('/guilds/'+gid+'/channels'):state.dms):(gid?demoChannels(gid):state.dms);
    if(nav!==state.navigation)return;state.channels=channels;renderChannels();
    const first=channels.find(c=>c.text);if(first)chooseChannel(first);
    if(state.real&&gid){
      const data=await api('/guilds/'+gid+'/members');if(nav!==state.navigation)return;
      state.members=data.members;state.after=data.after;
    }else state.members=gid?[state.me,...people]:[];
    renderMembers();
  }catch(err){if(nav===state.navigation)toast(err.message);}
}
async function chooseChannel(ch) {
  window.BotcordAI?.hide();
  if(!ch.text)return;const seq=++state.sequence;
  state.channel=ch;state.messages=[];state.loading=true;state.more=false;
  delete state.unread[ch.id];$('search').value='';$('typing').textContent='Carregando mensagens…';hideNavigation();
  renderChannels();renderMessages();renderComposer();
  try{
    const list=state.real?await api('/channels/'+ch.id+'/messages'):(database[ch.id]||[]);
    if(seq!==state.sequence)return;state.messages=mergeMessages(list,state.messages);state.more=state.real&&list.length===50;
  }catch(err){if(seq===state.sequence)toast(err.message);}
  finally{if(seq===state.sequence){state.loading=false;$('typing').textContent='';renderMessages(true);renderComposer();window.BotcordAI?.renderDM();}}
}
async function olderMessages() {
  if(!state.real||!state.messages.length)return;
  const seq=state.sequence,cid=state.channel.id,first=state.messages[0].id,scroll=$('messageScroller'),top=scroll.scrollTop,height=scroll.scrollHeight;
  $('olderButton').disabled=true;
  try{
    const list=await api('/channels/'+cid+'/messages?before='+first);if(seq!==state.sequence)return;
    state.messages=mergeMessages(list,state.messages);state.more=list.length===50;renderMessages();scroll.scrollTop=top+scroll.scrollHeight-height;
  }catch(err){toast(err.message);}finally{$('olderButton').disabled=false;}
}
function reply(m){if(state.channel?.writable){draft().reply=m;renderComposer();$('messageInput').focus();}}
async function sendMessage(ev) {
  ev.preventDefault();if(state.sending||state.reading||state.loading||!state.channel?.writable)return;
  const ch=state.channel,cid=ch.id,d=draft();if(!d.text.trim()&&!d.files.length)return;
  state.sending=true;renderComposer();
  try{
    let m;
    if(state.real)m=await api('/channels/'+cid+'/messages','POST',{content:d.text,replyId:d.reply?.id,files:d.files.map(f=>({name:f.name,data:f.data.split(',')[1]}))});
    else{
      m={id:crypto.randomUUID(),channelId:cid,guildId:ch.guildId,content:d.text,time:Date.now(),
        author:{...state.me,name:state.guilds.find(g=>g.id===ch.guildId)?.nickname||state.me.name},replyId:d.reply?.id,
        files:d.files.map(f=>({name:f.name,url:f.data,type:f.type})),reactions:[]};
      database[cid]=mergeMessages(database[cid]||[],[m]).slice(-150);persistDemo();
    }
    state.drafts[cid]={text:'',files:[],reply:null};
    if(state.channel?.id===cid){state.messages=mergeMessages(state.messages,[m]);renderMessages(true);}
  }catch(err){toast(err.message);}finally{state.sending=false;renderComposer();$('messageInput').focus();}
}
function editMessage(m) {
  const {d,body}=dialog('Editar mensagem'),input=E('textarea','input');input.value=m.content;input.maxLength=2000;input.setAttribute('aria-label','Texto da mensagem');
  const save=B('Salvar alterações',async()=>{
    save.disabled=true;
    try{
      let changed;
      if(state.real)changed=await api('/channels/'+m.channelId+'/messages/'+m.id,'PATCH',{content:input.value});
      else{
        if(!input.value.trim()&&!m.files?.length)throw new Error('A mensagem não pode ficar vazia.');
        changed={...m,content:input.value,edited:true};database[m.channelId]=(database[m.channelId]||[]).map(x=>x.id===m.id?changed:x);persistDemo();
      }
      if(state.channel?.id===m.channelId){state.messages=mergeMessages(state.messages,[changed]);renderMessages();}d.close();
    }catch(err){toast(err.message);}finally{save.disabled=false;}
  },'btn primary');body.append(input,save);input.focus();
}
function deleteMessage(m) {
  const {d,body}=dialog('Excluir mensagem?');body.append(E('p','muted','Essa mensagem será removida do canal.'));
  const remove=B('Excluir',async()=>{
    remove.disabled=true;
    try{
      if(state.real)await api('/channels/'+m.channelId+'/messages/'+m.id,'DELETE');
      else{database[m.channelId]=(database[m.channelId]||[]).filter(x=>x.id!==m.id);persistDemo();}
      if(state.channel?.id===m.channelId){state.messages=state.messages.filter(x=>x.id!==m.id);renderMessages();}d.close();
    }catch(err){toast(err.message);}finally{remove.disabled=false;}
  },'btn danger');body.append(remove);
}
async function react(m,emoji,remove=false) {
  try{
    let changed;
    if(state.real)changed=await api('/channels/'+m.channelId+'/messages/'+m.id+'/reactions',remove?'DELETE':'PUT',{emoji});
    else{
      changed={...m,reactions:(m.reactions||[]).map(r=>({...r}))};let reaction=changed.reactions.find(r=>r.key===emoji);
      if(!reaction){reaction={key:emoji,name:emoji,count:0,me:false};changed.reactions.push(reaction);}
      if(remove&&reaction.me){reaction.count--;reaction.me=false;}else if(!remove&&!reaction.me){reaction.count++;reaction.me=true;}
      changed.reactions=changed.reactions.filter(r=>r.count>0);
      database[m.channelId]=(database[m.channelId]||[]).map(x=>x.id===m.id?changed:x);persistDemo();
    }
    if(state.channel?.id===m.channelId){state.messages=mergeMessages(state.messages,[changed]);renderMessages();}
  }catch(err){toast(err.message);}
}
function emojiPicker(callback){
  const {d,body}=dialog('Escolha um emoji'),grid=E('div','emoji-grid');
  EMOJIS.forEach(emoji=>grid.append(B(emoji,()=>{callback(emoji);d.close();},'emoji-choice')));body.append(grid);
}
function readData(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});
}
async function attachFiles(input) {
  if(state.sending||state.reading||!state.channel?.writable)return;const d=draft(),files=Array.from(input);
  if(d.files.length+files.length>3){toast('Você pode anexar até 3 arquivos.');return;}
  if([...d.files,...files].reduce((sum,f)=>sum+f.size,0)>8*1024*1024){toast('O total dos anexos pode ter até 8 MB.');return;}
  state.reading=true;renderComposer();
  try{
    for(const f of files){
      if(!state.real&&!/^image\/(png|jpeg|gif|webp)$/.test(f.type)){toast('Na demonstração, anexe imagens. O modo real aceita outros arquivos.');continue;}
      d.files.push({name:f.name,type:f.type,size:f.size,data:await readData(f)});
    }
  }catch(err){toast(err.message);}finally{state.reading=false;renderComposer();}
}

function settings(tab='profile') {
  if(tab==='assistant'){window.BotcordAI?.settings();return;}
  document.querySelector('dialog.settings')?.close();
  const {d,body}=dialog('Configurações','settings');body.className='settings-shell';
  const nav=E('nav','settings-nav'),main=E('div','settings-main');nav.append(E('span','eyebrow','SEU ESPAÇO'));
  const pages=new Map();
  function show(name){for(const [key,node]of pages)node.hidden=key!==name;nav.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===name));}
  for(const [key,label]of [['profile','Meu perfil'],['appearance','Aparência'],['connection','Conexão']]){
    const b=B(label,()=>show(key),'settings-tab');b.dataset.tab=key;nav.append(b);
    const section=E('section');section.dataset.page=key;pages.set(key,section);main.append(section);
  }
  body.append(nav,main);
  nav.append(B('Assistente de IA',()=>{d.close();window.BotcordAI?.settings();},'settings-tab'));
  // Global profile, server nickname and presence are independent saves.
  const profile=pages.get('profile'),grid=E('div','profile-grid'),form=E('form'),preview=E('div','profile-preview');
  profile.append(E('h3','','Meu perfil'),grid);grid.append(form,preview);
  const username=field('NOME DO BOT',state.me.username,'text','profileName');username.input.minLength=2;username.input.maxLength=32;username.input.required=true;form.append(username.wrap);
  let images={},imageJobs=0;
  const save=B(state.real?'Salvar perfil no Discord':'Salvar perfil',null,'btn primary');save.type='submit';save.id='saveProfile';
  const previewNow=()=>renderProfile({...state.me,...images,name:username.input.value,username:username.input.value},preview);
  for(const [key,label]of [['avatar','Avatar'],['banner','Banner']]){
    const wrap=E('div','image-upload'),upload=E('input');upload.type='file';upload.accept='image/png,image/jpeg,image/gif,image/webp';upload.id=key+'Upload';
    const title=E('label','field',label.toUpperCase());title.htmlFor=upload.id;
    upload.onchange=async()=>{
      const f=upload.files[0];upload.value='';if(!f)return;
      if(!/^image\/(png|jpeg|gif|webp)$/.test(f.type)||f.size>2*1024*1024){toast('Use PNG, JPG, WEBP ou GIF de até 2 MB.');return;}
      imageJobs++;save.disabled=true;
      try{images[key]=await readData(f);previewNow();}catch(err){toast(err.message);}
      finally{imageJobs--;save.disabled=imageJobs>0;}
    };
    wrap.append(title,upload,B('Remover '+label.toLowerCase(),()=>{images[key]=null;previewNow();},'btn quiet'));form.append(wrap);
  }
  form.append(E('p','hint',state.real?'As alterações aparecem no perfil do bot no Discord.':'Personalize o perfil de demonstração. Imagens de até 2 MB.'),save);
  username.input.oninput=previewNow;previewNow();
  form.onsubmit=async ev=>{
    ev.preventDefault();if(imageJobs)return;save.disabled=true;
    const patch={...images};if(username.input.value.trim()!==state.me.username)patch.username=username.input.value.trim();
    try{
      if(state.real)state.me=await api('/profile','PATCH',patch);
      else{
        state.me={...state.me,...patch};state.me.name=state.me.username;demoMe=state.me;persist('botcord.profile',demoMe);
        for(const list of Object.values(database))for(const m of list)if(m.author.id==='self')m.author={...demoMe,name:demoGuilds.find(g=>g.id===m.guildId)?.nickname||demoMe.name};
        persistDemo();state.members=state.members.map(p=>p.id==='self'?demoMe:p);
      }
      images={};renderSelf();renderMessages();renderMembers();previewNow();toast('Perfil salvo.');
    }catch(err){toast(err.message);}finally{save.disabled=false;}
  };
  const settingsGuild=state.guild;
  if(settingsGuild){
    const g=state.guilds.find(g=>g.id===settingsGuild),nickForm=E('form'),nick=field('APELIDO EM '+(g?.name||'SERVIDOR'),g?.nickname||'','text','nicknameInput');
    nick.input.maxLength=32;nick.input.placeholder='Usar o nome global';
    const b=B('Salvar apelido',null,'btn');b.type='submit';nickForm.append(nick.wrap,b);profile.append(E('hr','section-line'),nickForm);
    nickForm.onsubmit=async ev=>{
      ev.preventDefault();b.disabled=true;
      try{
        const value=nick.input.value.trim();if(state.real)await api('/guilds/'+settingsGuild+'/nickname','PATCH',{nickname:value});
        if(g)g.nickname=value;if(!state.real)persist('botcord.guilds',demoGuilds);toast('Apelido salvo para este servidor.');
      }catch(err){toast(err.message);}finally{b.disabled=false;}
    };
  }
  const presenceForm=E('form'),statusLabel=E('label','field','STATUS'),status=E('select','input');
  status.id='presenceStatus';
  for(const [value,label]of [['online','Disponível'],['idle','Ausente'],['dnd','Não perturbar'],['invisible','Invisível']]){
    const option=E('option','',label);option.value=value;status.append(option);
  }
  status.value=state.me.status==='offline'?'invisible':state.me.status;statusLabel.append(status);
  const activity=field('JOGANDO',state.me.activity||'','text','activityInput');activity.input.maxLength=128;
  const savePresence=B('Atualizar status',null,'btn');savePresence.type='submit';
  presenceForm.append(statusLabel,activity.wrap,savePresence);profile.append(E('hr','section-line'),E('h3','','Status e atividade'),presenceForm);
  presenceForm.onsubmit=async ev=>{
    ev.preventDefault();savePresence.disabled=true;
    try{
      const patch={status:status.value,activity:activity.input.value.trim()};
      if(state.real)await api('/presence','PATCH',patch);
      Object.assign(state.me,patch);if(!state.real)persist('botcord.profile',state.me);
      renderSelf();toast('Status atualizado.');
    }catch(err){toast(err.message);}finally{savePresence.disabled=false;}
  };
  const appearance=pages.get('appearance'),themeLabel=E('label','field','TEMA'),theme=E('select','input');theme.id='themeSelect';
  for(const [value,label]of [['dark','Escuro'],['light','Claro'],['oled','Preto']]){const option=E('option','',label);option.value=value;theme.append(option);}
  theme.value=preferences.theme;themeLabel.append(theme);
  const compactLabel=E('label','check-row'),compact=E('input');compact.type='checkbox';compact.id='compactInput';compact.checked=!!preferences.compact;compactLabel.append(compact,E('span','','Mensagens compactas'));
  const size=field('TAMANHO DAS MENSAGENS',preferences.size,'range','fontSizeInput');size.input.min='14';size.input.max='22';size.input.step='1';size.input.value=preferences.size;
  appearance.append(E('h3','','Aparência'),themeLabel,compactLabel,size.wrap,E('p','hint','Essas preferências ficam salvas neste navegador.'));
  for(const input of [theme,compact,size.input])input.oninput=()=>{
    preferences={theme:theme.value,compact:compact.checked,size:Number(size.input.value)};applyPreferences();persist('botcord.preferences',preferences);
  };
  const connection=pages.get('connection'),loginForm=E('form');
  const address=field('ENDEREÇO DO SERVIDOR',state.origin||local('botcord.server','http://localhost:3000'),'url','apiAddress');
  address.input.required=true;address.input.placeholder='https://seu-servidor.com';
  const password=field('SENHA DO PAINEL','','password','panelPassword');password.input.required=true;password.input.autocomplete='current-password';
  const login=B('Conectar',null,'btn primary');login.type='submit';login.id='loginButton';
  const logout=B('Sair e abrir demonstração',()=>disconnect(d),'btn quiet');logout.hidden=!state.real;
  const actions=E('div','row');actions.append(login,logout);
  loginForm.append(address.wrap,password.wrap,E('p','hint','Use a senha definida no seu servidor. O token do Discord fica somente nele. No GitHub Pages, conecte um servidor com HTTPS.'),actions);
  const help=E('a','','Ver como configurar o servidor');help.href='https://github.com/IamKyo22/-3#conectar-um-bot-real';help.target='_blank';help.rel='noopener noreferrer';
  connection.append(E('h3','','Conectar seu bot'),E('p','muted','Acesse o servidor configurado para o seu bot.'),loginForm,E('hr','section-line'),help,
    E('p','hint','Uma instalação controla um bot. A sessão termina ao recarregar a página. O bot acessa os servidores e canais permitidos para ele.'),
    E('p','hint','Projeto independente. As mensagens reais aparecem com a identificação APP do Discord.'));
  loginForm.onsubmit=ev=>connect(ev,address.input,password.input,login,d);
  show(tab);
}
function stopStream(){
  state.stream?.abort();state.stream=null;clearTimeout(retryTimer);clearTimeout(refreshTimer);clearTimeout(structureTimer);
}
async function refreshMessages(reset=false) {
  if(!state.real||!state.channel)return;const seq=state.sequence,cid=state.channel.id;
  try{
    const list=await api('/channels/'+cid+'/messages');if(seq!==state.sequence)return;
    state.messages=reset?list:mergeMessages(state.messages,list);if(reset)state.more=list.length===50;renderMessages();
  }catch(err){toast(err.message);}
}
async function syncStructure() {
  if(!state.real)return;
  try{
    const info=await api('/state');state.guilds=info.guilds;state.dms=info.dms;state.invite=info.invite;
    const gid=state.guild,nav=state.navigation;
    if(gid&&!state.guilds.some(g=>g.id===gid)){await chooseGuild(null);return;}
    const channels=gid?await api('/guilds/'+gid+'/channels'):state.dms;if(nav!==state.navigation)return;
    state.channels=channels;const current=channels.find(c=>c.id===state.channel?.id&&c.text);
    if(current)state.channel=current;
    else{state.channel=null;state.messages=[];state.sequence++;const first=channels.find(c=>c.text);if(first)chooseChannel(first);else renderMessages();}
    renderServers();renderChannels();renderComposer();
  }catch(err){toast(err.message);}
}
async function startStream() {
  stopStream();if(!state.real||!state.token)return;
  const controller=new AbortController();state.stream=controller;
  try{
    const response=await fetch(state.origin+'/api/events',{headers:{Authorization:'Bearer '+state.token},signal:controller.signal});
    if(response.status===401){state.token='';state.live=false;window.BotcordAI?.reset();renderSelf();settings('connection');return;}
    if(!response.ok)throw new Error('Conexão ao vivo indisponível.');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    while(true){
      const {done,value}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true});let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line)continue;
        const event=JSON.parse(line);
        if(event.type.startsWith('assistant_'))window.BotcordAI?.event(event);
        if(event.type==='ready'){state.live=true;renderSelf();refreshMessages(true);syncStructure();}
        if(event.type==='heartbeat'){state.live=event.ready;renderSelf();}
        if(event.type==='profile'){state.me=event.me;renderSelf();}
        if(event.type==='message'){
          const m=event.message;
          if(m.channelId===state.channel?.id){state.messages=mergeMessages(state.messages,[m]);renderMessages();}
          else if(event.fresh&&m.author.id!==state.me.id){
            state.unread[m.channelId]=(state.unread[m.channelId]||0)+1;
            if(m.guildId&&m.guildId!==state.guild)state.unread[m.guildId]=true;renderServers();renderChannels();
          }
          if(!m.guildId&&!state.dms.some(c=>c.id===m.channelId)){clearTimeout(structureTimer);structureTimer=setTimeout(syncStructure,600);}
        }
        if(event.type==='delete'&&event.channelId===state.channel?.id){
          state.messages=state.messages.filter(m=>m.id!==event.id);renderMessages();
        }
        if(event.type==='changed'&&event.channelId===state.channel?.id){
          clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshMessages(),450);
        }
        if(event.type==='typing'&&event.channelId===state.channel?.id){
          $('typing').textContent=event.name+' está digitando…';clearTimeout(typingTimer);typingTimer=setTimeout(()=>$('typing').textContent='',7000);
        }
        if(event.type==='member'&&event.guildId===state.guild){
          state.members=state.members.map(m=>m.id===event.member.id?event.member:m);renderMembers();
        }
        if(event.type==='memberRemoved'&&event.guildId===state.guild){
          state.members=state.members.filter(m=>m.id!==event.id);renderMembers();
        }
        if(event.type==='structure'){clearTimeout(structureTimer);structureTimer=setTimeout(syncStructure,800);}
      }
    }
  }catch(err){if(controller.signal.aborted)return;}
  if(controller.signal.aborted)return;state.live=false;renderSelf();
  if(state.real&&state.token)retryTimer=setTimeout(startStream,3000);
}
async function connect(ev,address,password,button,d) {
  ev.preventDefault();button.disabled=true;
  try{
    const url=new URL(address.value);
    if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||
      !(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))
      throw new Error('Use uma origem HTTPS, sem caminho. HTTP só é aceito em localhost.');
    const response=await fetch(url.origin+'/api/login',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value}),signal:AbortSignal.timeout(45000)
    });
    const session=await response.json();if(!response.ok)throw new Error(session.error||'Não foi possível entrar.');
    const infoResponse=await fetch(url.origin+'/api/state',{headers:{Authorization:'Bearer '+session.token},signal:AbortSignal.timeout(45000)});
    const info=await infoResponse.json();if(!infoResponse.ok)throw new Error(info.error||'Não foi possível carregar o bot.');
    stopStream();window.BotcordAI?.reset();state.origin=url.origin;state.token=session.token;state.real=true;state.live=false;
    state.me=info.me;state.guilds=info.guilds;state.dms=info.dms;state.invite=info.invite;state.unread={};state.drafts={};state.collapsed.clear();
    persist('botcord.server',state.origin);password.value='';d.close();renderSelf();
    await chooseGuild(state.guilds[0]?.id||null);startStream();toast('Bot conectado.');
    window.BotcordAI?.refresh();
  }catch(err){toast(err.message||'Não foi possível conectar. Confira o endereço do servidor.');}
  finally{button.disabled=false;}
}
async function disconnect(d) {
  try{if(state.token)await api('/logout','POST',{});}catch{}
  stopStream();state.token='';state.real=false;state.live=false;state.me=demoMe;state.guilds=demoGuilds;state.dms=[];state.drafts={};state.unread={};state.collapsed.clear();
  window.BotcordAI?.reset();
  d?.close();renderSelf();chooseGuild('resenha');
}
function newDM() {
  const {d,body}=dialog('Nova mensagem direta'),input=field('ID DA PESSOA','','text','dmRecipient');
  input.input.inputMode='numeric';input.input.placeholder='ID do Discord';
  body.append(E('p','muted','Abra a conversa do bot com uma pessoa pelo ID do Discord.'),input.wrap);
  const b=B('Abrir conversa',async()=>{
    const userId=input.input.value.trim();if(!/^\d{17,20}$/.test(userId)){toast('Digite um ID válido do Discord.');return;}
    b.disabled=true;
    try{
      const ch=state.real?await api('/dms','POST',{userId}):{id:'dm-'+userId,name:'DM de teste',text:true,writable:true,category:'MENSAGENS DIRETAS',guildId:null,topic:''};
      if(!state.dms.some(c=>c.id===ch.id))state.dms.push(ch);await chooseGuild(null);chooseChannel(ch);d.close();
    }catch(err){toast(err.message);}finally{b.disabled=false;}
  },'btn primary');body.append(b);input.input.focus();
}
function quickSwitch() {
  const {d,body}=dialog('Ir para um canal'),input=E('input','input'),list=E('div');input.placeholder='Digite o nome do canal…';input.setAttribute('aria-label','Encontrar canal');
  const render=()=>{list.replaceChildren();state.channels.filter(c=>c.text&&c.name.toLocaleLowerCase().includes(input.value.toLocaleLowerCase()))
    .forEach(ch=>list.append(B('# '+ch.name,()=>{chooseChannel(ch);d.close();},'channel')));};
  input.oninput=render;body.append(input,list);render();input.focus();
}
function hideNavigation(){document.body.classList.remove('show-nav');$('navBackdrop').hidden=true;}
function bindIcon(id,name,handler){$(id).append(icon(name));if(handler)$(id).onclick=handler;}
bindIcon('serverChevron','chevron');bindIcon('headerHash','hash');bindIcon('welcomeIcon','hash');
bindIcon('settingsButton','settings',()=>settings());
bindIcon('channelAssistant','spark',()=>window.BotcordAI?.contextMenu());
bindIcon('mobileMenu','menu',()=>{const show=document.body.classList.toggle('show-nav');$('navBackdrop').hidden=!show;});
bindIcon('membersButton','people',()=>document.body.classList.toggle(innerWidth>1150?'hide-members':'show-members'));
bindIcon('attachButton','attach',()=>$('fileInput').click());
bindIcon('sendButton','send');
bindIcon('emojiButton','emoji',()=>emojiPicker(emoji=>{
  const input=$('messageInput'),d=draft(),start=input.selectionStart,end=input.selectionEnd;
  const text=d.text.slice(0,start)+emoji+d.text.slice(end);if(text.length>2000)return;
  d.text=text;renderComposer();input.focus();input.selectionStart=input.selectionEnd=start+emoji.length;
}));
bindIcon('cancelReply','close',()=>{draft().reply=null;renderComposer();});
$('navBackdrop').onclick=hideNavigation;
$('selfButton').onclick=()=>showProfile(state.me);
$('connectButton').onclick=()=>settings('connection');
$('quickSwitch').onclick=quickSwitch;
$('search').oninput=()=>renderMessages();
$('olderButton').onclick=olderMessages;
$('composer').onsubmit=sendMessage;
$('messageInput').oninput=()=>{
  draft().text=$('messageInput').value;$('messageCount').textContent=draft().text.length+'/2000';
  if(state.real&&state.channel?.writable&&Date.now()-typingAt>9000){typingAt=Date.now();api('/channels/'+state.channel.id+'/typing','POST',{}).catch(()=>{});}
};
$('messageInput').onkeydown=ev=>{
  if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();$('composer').requestSubmit();}
  if(ev.key==='ArrowUp'&&!ev.target.value&&!state.sending){const m=[...state.messages].reverse().find(m=>m.author.id===state.me.id);if(m)editMessage(m);}
};
$('fileInput').onchange=ev=>{attachFiles(ev.target.files);ev.target.value='';};
$('moreMembers').onclick=async()=>{
  const nav=state.navigation,gid=state.guild;$('moreMembers').disabled=true;
  try{
    const data=await api('/guilds/'+gid+'/members?after='+state.after);if(nav!==state.navigation)return;
    state.members=[...new Map([...state.members,...data.members].map(m=>[m.id,m])).values()];state.after=data.after;renderMembers();
  }catch(err){toast(err.message);}finally{$('moreMembers').disabled=false;}
};
document.addEventListener('keydown',ev=>{
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(!document.querySelector('dialog[open]'))quickSwitch();}
  if(ev.key==='Escape')hideNavigation();
});
applyPreferences();renderSelf();chooseGuild('resenha');
