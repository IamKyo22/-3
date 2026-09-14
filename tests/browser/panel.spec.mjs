import { test, expect } from '@playwright/test';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA5sAAAAASUVORK5CYII=', 'base64');

test('conversa, resposta, edição, reação, exclusão e troca de canais', async ({ page }) => {
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/-3/');
  await expect(page.locator('#channelTitle')).toHaveText('geral');
  const payload = 'teste <img src=x onerror="window.pwned=true">';
  await page.locator('#messageInput').fill(payload); await page.getByRole('button',{ name:'Enviar mensagem',exact:true }).click();
  const item = page.locator('.message').filter({has:page.locator('.message-content',{hasText:payload})});
  await expect(item).toHaveCount(1); await expect(item.locator('.message-content img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.pwned)).toBeUndefined();
  const id = await item.getAttribute('id'); const row = page.locator('[id="' + id + '"]');
  await row.hover(); await row.getByRole('button',{name:'Responder',exact:true}).click();
  await expect(page.locator('#replyBar')).toBeVisible();
  await page.locator('#messageInput').fill('resposta de teste'); await page.locator('#messageInput').press('Enter');
  await expect(page.locator('.reply-preview').filter({hasText:payload.slice(0,20)})).toBeVisible();
  await row.hover(); await row.getByRole('button',{name:'Editar mensagem',exact:true}).click();
  await page.getByRole('textbox',{name:'Texto da mensagem',exact:true}).fill('mensagem editada');
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();
  await expect(row.locator('.message-content')).toContainText('mensagem editada');
  await row.hover(); await row.getByRole('button',{name:'Reagir',exact:true}).click();
  await page.getByRole('button',{name:'🔥',exact:true}).click();
  await expect(row.getByRole('button',{name:'🔥 1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await expect(page.locator('.message-content').filter({hasText:'mensagem editada'})).toHaveCount(0);
  await page.getByRole('button',{name:'a resenha',exact:true}).click();
  await expect(row.locator('.message-content')).toContainText('mensagem editada');
  await row.hover(); await row.getByRole('button',{name:'Excluir mensagem',exact:true}).click();
  await page.getByRole('button',{name:'Excluir',exact:true}).click();
  await expect(row).toHaveCount(0); expect(errors).toEqual([]);
});

test('perfil com avatar e banner, tema e persistência', async ({ page }) => {
  await page.goto('/-3/');
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await page.locator('#profileName').fill('Novo nick');
  await page.locator('#avatarUpload').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:pixel});
  await page.locator('#bannerUpload').setInputFiles({name:'banner.png',mimeType:'image/png',buffer:pixel});
  await expect(page.locator('.profile-preview img')).toHaveCount(2);
  await page.locator('#saveProfile').click();
  await expect(page.locator('#selfButton')).toContainText('Novo nick');
  await page.getByRole('button',{name:'Aparência',exact:true}).click();
  await page.locator('#themeSelect').selectOption('light');await page.locator('#compactInput').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.reload();await expect(page.locator('#selfButton')).toContainText('Novo nick');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await expect(page.locator('.profile-preview img')).toHaveCount(2);
});

test('imagem anexada e navegação mobile sem transbordamento', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});await page.goto('/-3/');
  await expect(page.locator('#messageInput')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#fileInput').setInputFiles({name:'anexo.png',mimeType:'image/png',buffer:pixel});
  await expect(page.locator('.file-chip')).toContainText('anexo.png');
  await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
  await expect(page.locator('.attachment img[alt="anexo.png"]')).toBeVisible();
  await page.getByRole('button',{name:'Abrir servidores e canais',exact:true}).click();
  await page.getByRole('button',{name:'Canal jogos',exact:true}).click();
  await expect(page.locator('#channelTitle')).toHaveText('jogos');
  await expect(page.locator('#navBackdrop')).toBeHidden();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('conexão real simulada: falha no envio preserva rascunho e sessão não é salva', async ({ page }) => {
  const guild='111111111111111111', channel='222222222222222222', token='mock-panel-session';
  const bot={id:'333333333333333333',username:'Meu bot',name:'Meu bot',bot:true,avatar:'',banner:null,status:'online',activity:''};
  const info={me:bot,guilds:[{id:guild,name:'Servidor real',icon:null}],dms:[],invite:'https://discord.com'};
  const cors={'Access-Control-Allow-Origin':'http://127.0.0.1:4173','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PATCH, PUT, DELETE, OPTIONS'};
  let sent=0;
  await page.route('https://panel.example.test/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
    let data={},status=200,contentType='application/json';
    if(url.pathname==='/api/login')data={token};
    else if(url.pathname==='/api/state')data=info;
    else if(url.pathname.endsWith('/channels'))data=[{id:channel,guildId:guild,name:'chat-real',category:'CANAIS',text:true,writable:true,topic:''}];
    else if(url.pathname.endsWith('/members'))data={members:[bot],after:null};
    else if(url.pathname.endsWith('/messages')&&req.method()==='GET')data=[];
    else if(url.pathname.endsWith('/messages')&&req.method()==='POST'){sent++;status=403;data={error:'Sem permissão para enviar.'};}
    else if(url.pathname==='/api/events'){contentType='application/x-ndjson';data='{"type":"heartbeat","ready":true}\n';}
    await route.fulfill({status,headers:cors,contentType,body:typeof data==='string'?data:JSON.stringify(data)});
  });
  await page.goto('/-3/');await page.getByRole('button',{name:'Conectar bot',exact:true}).click();
  await page.locator('#apiAddress').fill('https://panel.example.test');
  await page.locator('#panelPassword').fill('only-a-test-password');
  await page.locator('#loginButton').click();
  await expect(page.locator('#channelTitle')).toHaveText('chat-real');
  await page.locator('#messageInput').fill('manter este rascunho');await page.locator('#messageInput').press('Enter');
  await expect(page.locator('#toast')).toHaveText('Sem permissão para enviar.');
  await expect(page.locator('#messageInput')).toHaveValue('manter este rascunho');
  expect(sent).toBe(1);
  const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
  expect(stored).not.toContain(token);expect(stored).not.toContain('only-a-test-password');
});

test('desktop e atalhos', async ({page})=>{
  await page.goto('/-3/');
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox',{name:'Encontrar canal',exact:true}).fill('música');
  await page.getByRole('button',{name:'# música',exact:true}).click();
  await expect(page.locator('#channelTitle')).toHaveText('música');
  await page.getByRole('button',{name:'Canal geral',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
});
