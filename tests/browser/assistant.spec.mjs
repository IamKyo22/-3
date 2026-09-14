import { test, expect } from '@playwright/test';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA5sAAAAASUVORK5CYII=','base64');
async function login(page) {
  await page.goto('/-3/');await page.locator('#connectButton').click();
  await page.locator('#apiAddress').fill('http://127.0.0.1:4180');
  await page.locator('#panelPassword').fill('test-private-panel-password-123456789');
  await page.locator('#loginButton').click();
  await expect(page.locator('#connectButton')).toContainText('Conectado');
}
async function openAI(page){await page.getByRole('button',{name:'Meu assistente de IA',exact:true}).click();await expect(page.locator('#assistantView')).toBeVisible();}
test('demonstração honesta, IA desktop e mobile sem transbordamento', async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/-3/');await openAI(page);
  await expect(page.locator('#aiWelcome')).toBeVisible();await expect(page.locator('#aiConnection')).toContainText('Conecte seu bot');
  await page.screenshot({path:'test-results/assistant-desktop.png',fullPage:true});
  await page.locator('#aiInput').fill('Olá');await page.locator('#aiSend').click();
  await expect(page.locator('#apiAddress')).toBeVisible();await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await expect(page.locator('#aiMessages')).toBeEmpty();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#aiInput')).toBeVisible();await page.screenshot({path:'test-results/assistant-mobile.png',fullPage:true});
  await page.locator('#aiToolsToggle').click();await expect(page.locator('#assistantAside')).toBeVisible();
  await page.locator('#aiToolsToggle').click();await expect(page.locator('#assistantAside')).toBeHidden();
  expect(errors).toEqual([]);
});
test('IA pelo backend: imagem, streaming, contexto, tarefa real e interrupção', async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);await openAI(page);
  await expect(page.locator('#aiModel')).toHaveText('gpt-6-astra');
  await page.locator('#aiFiles').setInputFiles({name:'teste.png',mimeType:'image/png',buffer:pixel});
  await page.locator('#aiInput').fill('Analise esta imagem');await page.locator('#aiSend').click();
  await expect(page.locator('#aiMessages')).toContainText('Teste de visão concluído.');await expect(page.locator('#aiStop')).toBeHidden();
  await expect(page.locator('.ai-message-images img')).toHaveCount(1);
  await page.locator('#aiInput').fill('Crie uma tarefa para revisar o projeto');await page.locator('#aiSend').click();
  await expect(page.locator('#aiMessages')).toContainText('Tarefa salva: Revisar projeto.');
  await expect(page.locator('#aiSpaceItems')).toContainText('Revisar projeto');
  await page.getByRole('checkbox',{name:'Concluir Revisar projeto'}).check();
  await expect(page.locator('.ai-space-item.completed')).toContainText('Revisar projeto');
  await page.locator('#aiInput').fill('Agora demore antes de responder');await page.locator('#aiSend').click();
  await expect(page.locator('#aiStop')).toBeVisible();await page.locator('#aiStop').click();
  await expect(page.locator('#aiMessages .ai-error')).toContainText('Geração interrompida');
  await expect(page.locator('#aiStop')).toBeHidden();
  const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
  expect(stored).not.toContain('Analise esta imagem');expect(stored).not.toContain('test-private-panel-password');
  await page.screenshot({path:'test-results/assistant-conversation.png',fullPage:true});expect(errors).toEqual([]);
});
test('markdown seguro, resumo de canal, configurações e erro recuperável', async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);await page.locator('#channelAssistant').click();
  await page.getByRole('button',{name:'Resumir a conversa',exact:true}).click();
  await expect(page.locator('#aiMessages')).toContainText('revisar o projeto amanhã');
  await page.locator('#aiNew').click();await page.locator('#aiInput').fill('Escreva um código');await page.locator('#aiSend').click();
  await expect(page.locator('.ai-code pre')).toContainText('const ok = true;');
  await expect(page.locator('.ai-markdown img')).toHaveCount(0);expect(await page.evaluate(()=>window.pwned)).toBeUndefined();
  await page.locator('#aiInput').fill('falha controlada');await page.locator('#aiSend').click();
  await expect(page.locator('#aiMessages .ai-error')).toContainText('Falha controlada');
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(page.locator('#aiInput')).toHaveValue('falha controlada');
  await page.locator('#aiConfig').click();await page.locator('#aiConfigName').fill('Kyo Assistente');
  await page.locator('#aiInstructions').fill('Converse em português e seja claro.');
  await page.getByRole('button',{name:'Salvar preferências',exact:true}).click();await expect(page.locator('#aiName')).toHaveText('Kyo Assistente');
  await page.getByRole('button',{name:'DMs automáticas',exact:true}).click();
  await page.locator('#aiAutoDM').check();await page.locator('#aiAllowedUsers').fill('999999999999999999');
  await page.getByRole('button',{name:'Salvar automação',exact:true}).click();await expect(page.locator('#toast')).toHaveText('Automação salva.');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  expect(errors).toEqual([]);
});
