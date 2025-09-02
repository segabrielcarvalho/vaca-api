import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
   files: ['**/*.{js,mjs,cjs,ts,tsx}'],
   languageOptions: {
      parser: tsParser,
      parserOptions: {
         project: 'tsconfig.json',
         tsconfigRootDir: __dirname,
         sourceType: 'module',
      },
      globals: { ...globals.node, ...globals.jest },
   },
   plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
   },
   rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': 'error',
   },
});
