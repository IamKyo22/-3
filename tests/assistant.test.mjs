import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter, once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Collection, ChannelType } from 'discord.js';
import { AssistantStore, settingsPatch } from '../lib/assistant-store.mjs';
import { Assistant } from '../lib/assistant.mjs';
import { AutoDM, splitReply } from '../lib/auto-dm.mjs';
import { imageInput, discordImages, openAIProvider } from '../lib/openai-provider.mjs';
import { createPanel } from '../server.mjs';

const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA5sAAAAASUVORK5CYII=';
const response=text=>({output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:30,output_tokens:20}});
const call=args=>({output:[{type:'function_call',call_id:'call-1',name:'workspace',arguments:JSON.stringify(args)}]});
const ask=(ai,thread,text,images=[])=>{
  ai.start(thread.id,thread.scope,{text,images,requestId:randomUUID()});return ai.jobs.get(thread.id).promise;
};

test('histórico persiste; escopos não vazam; imagens antigas têm retenção limitada', t=>{
  const folder=mkdtempSync(join(tmpdir(),'botcord-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const file=join(folder,'private','assistant.json'),store=new AssistantStore(file);
  const owner=store.create(),dm=store.create('dm:999999999999999999','DM');
  const note=store.editWorkspace('owner','notes','add',{text:'Anotação privada do dono'});
  assert.throws(()=>store.editWorkspace(dm.scope,'notes','delete',{id:note.id}),/Item não encontrado/);
  for(let i=0;i<3;i++)store.append(owner.id,'owner',{role:'user',content:'Imagem '+i,images:[{name:'image.png',url:pixel}]});
  assert.equal(store.get(owner.id,'owner').messages[0].images[0].url,undefined);
  assert.equal(store.get(owner.id,'owner').messages.at(-1).images[0].url,pixel);
  const restored=new AssistantStore(file);assert.equal(restored.workspace('owner').notes[0].text,'Anotação privada do dono');
  assert.equal(restored.workspace(dm.scope).notes.length,0);assert.throws(()=>restored.get(owner.id,dm.scope));
  assert.equal(statSync(file).mode & 0o777,0o600);
  assert.throws(()=>settingsPatch(JSON.parse('{"__proto__":"x"}')));
  assert.throws(()=>settingsPatch({dailyLimit:0}));assert.throws(()=>settingsPatch({allowedUsers:['admin']}));
});

test('visão valida bytes e não busca URLs locais, redirects ou arquivos enormes', async()=>{
  assert.equal(imageInput([{url:pixel}]).length,1);
  for(const url of ['http://127.0.0.1/secret','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,PHN2Zz4='])assert.throws(()=>imageInput([{url}]));
  assert.throws(()=>imageInput(Array(4).fill({url:pixel})));
  let requests=0;
  const files=[{name:'secret.png',url:'http://127.0.0.1/secret',contentType:'image/png'},
    {name:'look.png',url:'https://cdn.discordapp.com/attachments/1/2/look.png',contentType:'image/png'}];
  const result=await discordImages(files,async(url,opts)=>{requests++;assert.equal(opts.redirect,'error');return new Response(Buffer.from(pixel.split(',')[1],'base64'));});
  assert.equal(requests,1);assert.equal(result.images.length,1);assert.deepEqual(result.skipped,['secret.png']);
  const tooLarge=await discordImages([files[1]],async()=>new Response('x',{headers:{'content-length':String(5*1024*1024)}}));
  assert.equal(tooLarge.images.length,0);
});

test('provider interpreta SSE fragmentado, mantém segredo e trata resposta incompleta', async()=>{
  const output=response('Olá 👋');let deltas='';let request;
  const events=[{type:'response.output_text.delta',delta:'Olá 👋'},{type:'response.completed',response:output}];
  const bytes=Buffer.from(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join(''));
  const provider=openAIProvider('private-test-key',async(url,options)=>{
    request={url,options};return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.subarray(i,i+3));c.close();}}));
  });
  const result=await provider({model:'test-model',store:false},{onDelta:d=>deltas+=d});
  assert.equal(deltas,'Olá 👋');assert.equal(result.output[0].content[0].text,'Olá 👋');
  assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(request.options.body).stream,true);
  const rejected=openAIProvider('secret',async()=>new Response('secret upstream body',{status:401}));
  await assert.rejects(rejected({}),e=>e.status===503&&!e.message.includes('secret'));
  const incomplete=openAIProvider('secret',async()=>new Response('data: {"type":"response.incomplete"}\n\n'));
  await assert.rejects(incomplete({}),/limite de geração/);
});

test('modelo recebe imagens, usa ferramentas reais e mantém memória da DM isolada', async()=>{
  const store=new AssistantStore(),owner=store.create(),dm=store.create('dm:999999999999999999','DM');
  store.editWorkspace('owner','memories','add',{text:'SEGREDO DO OPERADOR'});
  const payloads=[];
  const ai=new Assistant({store,provider:async(payload,options)=>{
    payloads.push(structuredClone(payload));
    if(payloads.length===1)return call({action:'add',collection:'tasks',text:'Revisar exercício',due:null,id:null,completed:null});
    options.onDelta('Tarefa salva.');return response('Tarefa salva.');
  }});
  const answer=await ask(ai,dm,'Salve uma tarefa com base na imagem.',[{name:'test.png',url:pixel}]);
  assert.equal(answer.content,'Tarefa salva.');assert.equal(store.workspace(dm.scope).tasks.length,1);assert.equal(store.workspace('owner').tasks.length,0);
  assert.equal(JSON.stringify(payloads).includes('SEGREDO DO OPERADOR'),false);
  assert.equal(payloads[0].input.at(-1).content[1].type,'input_image');assert.equal(payloads[0].store,false);
  assert.equal(payloads[1].input.at(-1).type,'function_call_output');assert.equal(store.data.usage.calls,2);
  assert.equal(ai.status().threads.some(t=>t.id===dm.id),false);assert.equal(ai.status().threads[0].id,owner.id);
});

test('envios têm idempotência, limite diário, cancelamento e nenhum histórico inventado sem chave', async()=>{
  const missing=new Assistant({apiKey:''}),t=missing.store.create();
  assert.throws(()=>missing.start(t.id,'owner',{text:'oi',requestId:randomUUID()}),/OPENAI_API_KEY/);assert.equal(t.messages.length,0);
  let finish;
  const ai=new Assistant({provider:async(_,o)=>new Promise(resolve=>{finish=resolve;o.signal.addEventListener('abort',()=>resolve(response('Não enviar')));})});
  const thread=ai.store.create(),requestId=randomUUID();
  ai.start(thread.id,'owner',{text:'oi',requestId});const job=ai.jobs.get(thread.id);
  assert.equal(ai.start(thread.id,'owner',{text:'oi',requestId}).duplicate,true);
  assert.throws(()=>ai.start(thread.id,'owner',{text:'rascunho alterado',requestId}),/outro conteúdo/);
  assert.equal(thread.messages.length,1);ai.cancel(thread.id);finish(response('Não enviar'));await job.promise;
  assert.equal(ai.jobs.size,0);assert.equal(thread.messages.at(-1).cancelled,true);
  ai.configure({dailyLimit:1});assert.throws(()=>ai.start(thread.id,'owner',{text:'mais',requestId:randomUUID()}),/Limite diário/);
});

test('consultas de chats externos não recebem memória privada nem podem executar ações', async()=>{
  const store=new AssistantStore(),thread=store.create();thread.contextOnly=true;
  store.editWorkspace('owner','memories','add',{text:'MEMÓRIA PRIVADA'});
  const ai=new Assistant({store,provider:async(payload)=>{
    assert.deepEqual(payload.tools,[]);assert.equal(JSON.stringify(payload.input).includes('MEMÓRIA PRIVADA'),false);
    return call({action:'add',collection:'notes',text:'Pedido injetado no chat',due:null,id:null,completed:null});
  }});
  const result=await ask(ai,thread,'Resuma este chat externo.');
  assert.equal(result,null);assert.equal(store.workspace('owner').notes.length,0);
  assert.match(thread.messages.at(-1).error,/não pode executar ferramentas/);
});

function dmFixture(ai,delay=60000) {
  const sent=[],channel={id:'222222222222222222',type:ChannelType.DM,sendTyping:async()=>{},send:async data=>{sent.push(data);}};
  const auto=new AutoDM({},ai,{delay});let count=0;
  const message=(content='Oi',extra={})=>({id:String(333333333333333333n+BigInt(++count)),content,createdTimestamp:Date.now(),channel,
    author:{id:'999999999999999999',bot:false},attachments:new Collection(),...extra});
  return {auto,sent,channel,message};
}
test('automação responde somente DMs autorizadas; agrupa, ignora bots e permite opt-out', async t=>{
  const ai=new Assistant({provider:async()=>response('Olá, sou seu assistente virtual.')});
  const f=dmFixture(ai);t.after(()=>f.auto.close());ai.configure({autoDM:true,allowedUsers:['999999999999999999']});
  await f.auto.handle(f.message('bot',{author:{id:'999999999999999999',bot:true}}));assert.equal(f.auto.pending.size,0);
  await f.auto.handle(f.message('fora',{author:{id:'888888888888888888',bot:false}}));assert.equal(f.auto.pending.size,0);
  const first=f.message('Olá');await f.auto.handle(first);await f.auto.handle(first);await f.auto.handle(f.message('Pode ajudar?'));
  assert.equal(f.auto.pending.get(f.channel.id).messages.length,2);
  await f.auto.flush(f.channel.id);assert.equal(f.sent.length,1);assert.match(f.sent[0].content,/Nova · IA/);
  assert.deepEqual(f.sent[0].allowedMentions,{parse:[],repliedUser:false});assert.match(f.sent[0].content,/pausar-ia/);
  await f.auto.handle(f.message('/pausar-ia'));assert.equal(f.auto.eligible(f.channel.id,'999999999999999999'),false);
  await f.auto.handle(f.message('não responda'));assert.equal(f.auto.pending.size,0);
  for(const part of splitReply('😀'.repeat(6000)))assert.ok(part.length<=1900);
});
test('assumir a DM ou desligar automação cancela geração antes do envio', async t=>{
  let resolveResponse;
  const ai=new Assistant({provider:async()=>new Promise(r=>{resolveResponse=r;})});
  const f=dmFixture(ai);t.after(()=>f.auto.close());ai.configure({autoDM:true,dmPolicy:'all'});
  await f.auto.handle(f.message());const run=f.auto.flush(f.channel.id);
  // Allow the bounded image loader to finish before the provider starts.
  await new Promise(r=>setImmediate(r));assert.equal(typeof resolveResponse,'function');
  f.auto.takeover(f.channel.id);resolveResponse(response('Não deve aparecer no Discord'));await run;
  assert.equal(f.sent.length,0);assert.equal(f.auto.eligible(f.channel.id,'999999999999999999'),false);
  assert.equal(ai.jobs.size,0);
});

test('rotas da IA autenticam, rejeitam acesso a escopo DM e mantêm dados privados fora de arquivos estáticos', async t=>{
  const ai=new Assistant({provider:async()=>response('Tudo certo.')});const dm=ai.store.create('dm:999999999999999999','privado');
  const client=new EventEmitter();client.isReady=()=>true;client.guilds={cache:new Collection()};client.channels={cache:new Collection()};
  const password='test-private-password-'.repeat(3),panel=createPanel(client,{assistant:ai,password,origins:['https://allowed.example']});
  panel.listen(0,'127.0.0.1');await once(panel,'listening');t.after(()=>panel.closePanel());
  const base='http://127.0.0.1:'+panel.address().port;
  const request=(path,method='GET',data,token)=>fetch(base+path,{method,headers:{Origin:'https://allowed.example','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});
  assert.equal((await request('/api/assistant')).status,401);
  const {token}=await (await request('/api/login','POST',{password})).json();
  assert.equal((await request('/api/assistant/threads/'+dm.id,'GET',undefined,token)).status,404);
  for(const path of ['/data/assistant.json','/lib/assistant.mjs','/.env'])assert.equal((await request(path)).status,404);
  const thread=await (await request('/api/assistant/threads','POST',{},token)).json();
  const accepted=await request('/api/assistant/threads/'+thread.id+'/messages','POST',{text:'Oi',requestId:randomUUID()},token);
  assert.equal(accepted.status,202);
  const loaded=await (await request('/api/assistant/threads/'+thread.id,'GET',undefined,token)).json();
  assert.equal(loaded.messages.at(-1).content,'Tudo certo.');
  assert.equal(JSON.stringify(await (await request('/api/assistant','GET',undefined,token)).json()).includes(password),false);
});
