import type { JsonRecord, JsonValue } from 'src/types/json';

const isRecord = (value: JsonValue | undefined): value is JsonRecord =>
   typeof value === 'object' && value !== null && !Array.isArray(value);

export function getPath<T = JsonValue>(
   obj: JsonRecord | null | undefined,
   path: string,
): T | undefined {
   const result = path.split('.').reduce<JsonValue | undefined>((acc, key) => {
      if (!isRecord(acc)) return undefined;
      return acc[key];
   }, obj);
   return result as T | undefined;
}

export function setPath(obj: JsonRecord, path: string, value: JsonValue): void {
   const keys = path.split('.');
   let cur = obj;
   for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const next = cur[key];
      if (!isRecord(next)) {
         cur[key] = {};
      }
      cur = cur[key] as JsonRecord;
   }
   cur[keys[keys.length - 1]] = value;
}
