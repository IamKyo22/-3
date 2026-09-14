// Test-only server: real panel HTTP + streaming, fake Discord and fake model.
import { EventEmitter } from 'node:events';
import { Collection, ChannelType } from 'discord.js';
import { Assistant } from '../../lib/assistant.mjs';
import { HttpError } from '../../lib/validation.mjs';
import { createPanel } from '../../server.mjs';

const client=new EventEmitter();client.isReady=()=>true;
const user={id:'111111111111111111',username:'Bot de teste',displayName:'Bot de teste',bot:true,
  displayAvatarURL:()=>'',bannerURL:()=>null,presence:{status:'online',activities:[]}};client.user=user;
const guild={id:'222222222222222222',name:'Servidor de teste',iconURL:()=>null};
const member={user,displayName:user.username,displayAvatarURL:()=>'',presence:{status:'online'},displayHexColor:'#000000'};
guild.members={me:member,list:async()=>new Collection([[user.id,member]])};
const messages=new Collection(),channel={id:'333333333333333333',name:'geral',guild,guildId:guild.id,type:ChannelType.GuildText,
  topic:'Conversa de teste para o assistente',isThread:()=>false,permissionsFor:()=>({has:()=>true}),sendTyping:async()=>{}};
const message=content=>({id:String(444444444444444444n+BigInt(messages.size)),channel,channelId:channel.id,guildId:guild.id,
  content,author:user,member,createdTimestamp:Date.now(),attachments:new Collection(),reactions:{cache:new Collection()}});
channel.send=async data=>{const m=message(data.content);messages.set(m.id,m);client.emit('messageCreate',m);return m;};
const initial=message('Precisamos revisar o projeto amanhã.');messages.set(initial.id,initial);
channel.messages={fetch:async arg=>typeof arg==='string'?messages.get(arg):new Collection(messages)};
guild.channels={fetch:async()=>{},fetchActiveThreads:async()=>{},cache:new Collection([[channel.id,channel]])};
client.guilds={cache:new Collection([[guild.id,guild]])};client.channels={cache:new Collection([[channel.id,channel]]),fetch:async()=>channel};
const ai=new Assistant({apiKey:'',provider:async(payload,{signal,onDelta})=>{
  const userInput=payload.input.filter(i=>i.role==='user').at(-1),content=userInput?.content;
  const text=typeof content==='string'?content:content?.find(i=>i.type==='input_text')?.text||'';
  if(text.includes('falha controlada'))throw new HttpError(503,'Falha controlada do modelo de teste.');
  if(text.includes('demore'))await new Promise(resolve=>{const timer=setTimeout(resolve,20000);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
  if(text.includes('Crie uma tarefa')&&!payload.input.some(i=>i.type==='function_call_output'))return{output:[{type:'function_call',name:'workspace',call_id:'fixture-call',arguments:JSON.stringify({action:'add',collection:'tasks',text:'Revisar projeto',id:null,due:null,completed:null})}]};
  const answer=payload.input.some(i=>i.type==='function_call_output')?'Tarefa salva: **Revisar projeto**.':
    Array.isArray(content)&&content.some(i=>i.type==='input_image')?'Recebi a imagem no formato multimodal. **Teste de visão concluído.**':
    text.includes('Resuma')?'O grupo precisa **revisar o projeto amanhã**.':
    'Resposta de teste: **contexto recebido**.\n\n```js\nconst ok = true;\n```\n\n<img src=x onerror="window.pwned=true">';
  for(const chunk of answer.match(/.{1,30}|\n/g)||[]){if(signal.aborted)break;onDelta(chunk);await new Promise(r=>setTimeout(r,15));}
  return {output:[{type:'message',content:[{type:'output_text',text:answer,annotations:[]}]}],usage:{input_tokens:50,output_tokens:20}};
}});
const server=createPanel(client,{assistant:ai,password:'test-private-panel-password-123456789',origins:['http://127.0.0.1:4173']});
server.listen(4180,'127.0.0.1',()=>console.log('Test fixture: http://127.0.0.1:4180'));
process.on('SIGTERM',()=>server.closePanel());process.on('SIGINT',()=>server.closePanel());
