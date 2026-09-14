import { HttpError, deny } from './validation.mjs';

export function imageInput(input) {
  if (!Array.isArray(input) || input.length > 3) deny(400, 'Envie até três imagens.');
  let total = 0;
  return input.map(image => {
    if (typeof image?.url !== 'string') deny(400, 'Imagem inválida.');
    const match = image.url.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) deny(400, 'Use uma imagem PNG, JPG, WEBP ou GIF.');
    const bytes = Buffer.from(match[2], 'base64'); total += bytes.length;
    if (!bytes.length || bytes.length > 4 * 1024 * 1024 || total > 8 * 1024 * 1024) deny(413, 'Até 4 MB por imagem e 8 MB no total.');
    const hex = bytes.subarray(0,12).toString('hex');
    const valid = match[1] === 'png' ? hex.startsWith('89504e470d0a1a0a') :
      match[1] === 'jpeg' ? hex.startsWith('ffd8ff') :
      match[1] === 'gif' ? bytes.subarray(0,6).toString() === 'GIF89a' || bytes.subarray(0,6).toString() === 'GIF87a' :
      bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
    if (!valid) deny(400, 'O conteúdo do arquivo não corresponde a uma imagem válida.');
    return { name: String(image.name || 'imagem').slice(0,120), url: image.url };
  });
}

export async function discordImages(attachments, fetcher = fetch) {
  const images = [], skipped = attachments.slice(3).map(a=>a.name);
  let total = 0;
  for (const a of attachments.slice(0,3)) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(a.contentType || a.type || '')) { skipped.push(a.name); continue; }
    try {
      const url = new URL(a.url);
      if (url.protocol !== 'https:' || url.port || url.username || url.password ||
          !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) || !url.pathname.startsWith('/attachments/')) throw new Error('origin');
      const response = await fetcher(url.href, { redirect: 'error', signal: AbortSignal.timeout(12000) });
      if (!response.ok || Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw new Error('size');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 4 * 1024 * 1024 || total + size > 8 * 1024 * 1024) throw new Error('size');
        chunks.push(chunk);
      }
      total += size;
      const [image] = imageInput([{ name: a.name, url: 'data:' + (a.contentType || a.type) + ';base64,' + Buffer.concat(chunks).toString('base64') }]);
      images.push(image);
    } catch { skipped.push(a.name); }
  }
  return { images, skipped };
}

function providerError(status) {
  if (status === 401 || status === 403) return new HttpError(503, 'A chave da OpenAI não tem acesso. Confira a chave e o modelo no servidor.');
  if (status === 429) return new HttpError(429, 'A OpenAI limitou as chamadas ou o saldo da API acabou. Confira o faturamento e tente depois.');
  if (status === 400 || status === 404) return new HttpError(503, 'A OpenAI recusou o modelo ou a imagem. Confira OPENAI_MODEL e os formatos aceitos.');
  return new HttpError(503, 'A OpenAI está indisponível. Tente novamente em instantes.');
}

export function openAIProvider(apiKey, fetcher = fetch) {
  return async (payload, { signal, onDelta = () => {}, onStatus = () => {} } = {}) => {
    if (!apiKey) deny(503, 'Configure OPENAI_API_KEY no servidor para ativar a IA.');
    try {
      const response = await fetcher('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, stream: true }), signal
      });
      if (!response.ok) { await response.body?.cancel(); throw providerError(response.status); }
      const decoder = new TextDecoder(); let buffer = '', completed = null;
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true }).replace(/\r/g, '');
        if (buffer.length > 8 * 1024 * 1024) deny(502, 'Resposta da IA acima do limite.');
        let split;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0,split); buffer = buffer.slice(split+2);
          const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
          if (!data || data === '[DONE]') continue;
          const event = JSON.parse(data);
          if (event.type === 'response.output_text.delta') onDelta(event.delta || '');
          if (event.type === 'response.web_search_call.in_progress') onStatus('Pesquisando na web…');
          if (event.type === 'response.completed') completed = event.response;
          if (event.type === 'response.incomplete') deny(502, 'A resposta atingiu o limite de geração. Tente dividir o pedido em partes menores.');
          if (event.type === 'response.failed' || event.type === 'error') throw providerError(503);
        }
      }
      if (!completed) deny(502, 'A conexão com a IA terminou antes da resposta. Tente novamente.');
      return completed;
    } catch (error) {
      if (signal?.aborted) throw new HttpError(408, 'Geração interrompida ou tempo limite atingido.');
      if (error instanceof HttpError) throw error;
      throw providerError(503);
    }
  };
}
