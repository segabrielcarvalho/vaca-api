declare module 'file-mime' {
   export function detect(buffer: Buffer): string | null;
}
