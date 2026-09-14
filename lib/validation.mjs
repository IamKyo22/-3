export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const deny = (status, message) => { throw new HttpError(status, message); };
export function snowflake(value) {
  if (typeof value !== 'string' || !/^\d{17,20}$/.test(value)) deny(400, 'ID do Discord inválido.');
  return value;
}
export function messageContent(value, hasFiles = false) {
  if (typeof value !== 'string' || value.length > 2000 || (!hasFiles && !value.trim()))
    deny(400, 'Escreva uma mensagem de até 2000 caracteres ou anexe um arquivo.');
  return value;
}
export function profileImage(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    deny(400, 'Selecione uma imagem PNG, JPG, WEBP ou GIF.');
  if (Buffer.from(value.split(',')[1], 'base64').length > 2 * 1024 * 1024)
    deny(400, 'Cada imagem do perfil pode ter até 2 MB.');
  return value;
}
export function attachments(value = []) {
  if (!Array.isArray(value) || value.length > 3) deny(400, 'Você pode enviar até 3 anexos.');
  let total = 0;
  return value.map(file => {
    if (!file || typeof file.name !== 'string' || typeof file.data !== 'string' ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) deny(400, 'Anexo inválido.');
    const attachment = Buffer.from(file.data, 'base64');
    total += attachment.length;
    if (total > 8 * 1024 * 1024) deny(413, 'O total dos anexos deve ser de até 8 MB.');
    return { attachment, name: file.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120) || 'arquivo' };
  });
}
export function profilePatch(data) {
  const patch = {};
  if (data.username !== undefined) {
    if (typeof data.username !== 'string' || data.username.trim().length < 2 || data.username.trim().length > 32)
      deny(400, 'O nome precisa ter de 2 a 32 caracteres.');
    patch.username = data.username.trim();
  }
  for (const key of ['avatar', 'banner']) if (data[key] !== undefined) patch[key] = profileImage(data[key]);
  return patch;
}
