import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';

type TemplateContext = Record<string, unknown>;

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

const getTemplate = (templateName: string): Handlebars.TemplateDelegate => {
   const cachedTemplate = templateCache.get(templateName);
   if (cachedTemplate) return cachedTemplate;

   const templatePath = join(__dirname, `${templateName}.hbs`);
   const templateSource = readFileSync(templatePath, 'utf-8');
   const template = Handlebars.compile(templateSource);
   templateCache.set(templateName, template);

   return template;
};

export const renderHbsTemplate = (
   templateName: string,
   context: TemplateContext,
) => {
   return getTemplate(templateName)(context);
};
