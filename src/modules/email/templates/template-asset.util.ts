import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const assetBase64Cache = new Map<string, string>();

export const getTemplateAssetBase64 = (assetName: string): string => {
   const cached = assetBase64Cache.get(assetName);
   if (cached) return cached;

   const assetPath = join(__dirname, assetName);
   const base64 = readFileSync(assetPath).toString('base64');
   assetBase64Cache.set(assetName, base64);

   return base64;
};
