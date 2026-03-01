export default function getMimeTypeByBase64(fileInBase64: string): string {
   const match = fileInBase64.match(/^data:(.+);base64,/);
   if (!match) {
      throw new Error('Não foi possível identificar o mime type');
   }
   return match[1];
}
