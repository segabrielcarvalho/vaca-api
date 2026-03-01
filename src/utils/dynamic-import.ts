export type DynamicImport = <T = object>(modulePath: string) => Promise<T>;

export const dynamicImport: DynamicImport = new Function(
   'modulePath',
   'return import(modulePath)',
) as DynamicImport;
