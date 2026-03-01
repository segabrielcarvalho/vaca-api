#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const GENERATED_ROOT = path.resolve(
   __dirname,
   '../src/modules/graphql/@generated',
);

const SCALAR_TYPES = new Set([
   'String',
   'Boolean',
   'Int',
   'Float',
   'ID',
   'GraphQLISODateTime',
]);

function walkTsFiles(dir) {
   const entries = fs.readdirSync(dir, { withFileTypes: true });
   const files = [];

   for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
         files.push(...walkTsFiles(fullPath));
         continue;
      }

      const isTargetFile =
         fullPath.endsWith('.input.ts') || fullPath.endsWith('.args.ts');
      if (isTargetFile) {
         files.push(fullPath);
      }
   }

   return files;
}

function parseNamedImports(content) {
   const map = new Map();
   const regex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g;
   let match = regex.exec(content);

   while (match) {
      const [, symbolsRaw, moduleSpecifier] = match;
      const symbols = symbolsRaw
         .split(',')
         .map((s) => s.trim())
         .filter(Boolean);
      for (const symbol of symbols) {
         const [importedName] = symbol.split(/\s+as\s+/i).map((s) => s.trim());
         if (importedName) {
            map.set(importedName, moduleSpecifier);
         }
      }
      match = regex.exec(content);
   }

   return map;
}

function addTypeToClassTransformerImport(lines) {
   for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes("from 'class-transformer'")) {
         continue;
      }

      if (lines[i].includes('Type')) {
         return lines;
      }

      lines[i] = lines[i].replace('{', '{ Type,');
      return lines;
   }

   const lastImportIndex = lines.reduce((acc, line, index) => {
      if (line.startsWith('import ')) {
         return index;
      }
      return acc;
   }, -1);

   const importLine = "import { Type } from 'class-transformer';";
   if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importLine);
   } else {
      lines.unshift(importLine);
   }

   return lines;
}

function hasTypeDecoratorAhead(lines, startIndex) {
   for (let i = startIndex + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) {
         continue;
      }

      if (line.startsWith('@Type(')) {
         return true;
      }

      if (line.startsWith('@')) {
         continue;
      }

      return false;
   }

   return false;
}

function processFile(filePath) {
   const original = fs.readFileSync(filePath, 'utf8');
   const importMap = parseNamedImports(original);
   const lines = original.split('\n');
   let insertedDecorators = 0;

   for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const fieldMatch = line.match(
         /^(\s*)@Field\(\(\)\s*=>\s*(\[[^\]]+\]|[A-Za-z0-9_$.]+)(?:\s*,|\))/,
      );
      if (!fieldMatch) {
         continue;
      }

      if (hasTypeDecoratorAhead(lines, i)) {
         continue;
      }

      const [, indent, rawTypeName] = fieldMatch;
      const typeName = rawTypeName.replace(/^\[|\]$/g, '');
      const importLookupName = typeName.split('.')[0];

      if (SCALAR_TYPES.has(typeName)) {
         continue;
      }

      const moduleSpecifier = importMap.get(importLookupName);
      if (!moduleSpecifier) {
         continue;
      }

      if (!moduleSpecifier.startsWith('.')) {
         continue;
      }

      if (
         moduleSpecifier.endsWith('.enum') ||
         moduleSpecifier.includes('.enum')
      ) {
         continue;
      }

      lines.splice(i + 1, 0, `${indent}@Type(() => ${typeName})`);
      insertedDecorators += 1;
      i += 1;
   }

   if (!insertedDecorators) {
      return { changed: false, insertedDecorators: 0 };
   }

   addTypeToClassTransformerImport(lines);
   const updated = lines.join('\n');

   if (updated === original) {
      return { changed: false, insertedDecorators: 0 };
   }

   fs.writeFileSync(filePath, updated, 'utf8');
   return { changed: true, insertedDecorators };
}

function main() {
   if (!fs.existsSync(GENERATED_ROOT)) {
      console.error(`Generated folder not found: ${GENERATED_ROOT}`);
      process.exit(1);
   }

   const files = walkTsFiles(GENERATED_ROOT);
   let changedFiles = 0;
   let insertedDecorators = 0;

   for (const filePath of files) {
      const result = processFile(filePath);
      if (result.changed) {
         changedFiles += 1;
         insertedDecorators += result.insertedDecorators;
      }
   }

   console.log(
      `[post-generate] Added @Type decorators: ${insertedDecorators} in ${changedFiles} files`,
   );
}

main();
