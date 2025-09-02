import Handlebars from 'handlebars';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type ClientLoginCodeEmailContext = {
   to: { email: string; name: string };
   code: string;
   expirationMinutes: number;
   name: string;
   appName: string;
   currentYear?: number;
};

type CompileArgs = ClientLoginCodeEmailContext & {
   logoUrl: string;
};

export const clientLoginCodeTemplate = async (
   args: ClientLoginCodeEmailContext,
) => {
   const rootDir = path.resolve(__dirname, '../../../../../');
   const templatePath = path.join(
      rootDir,
      'src/modules/auth/templates/client-login-code/client-login-code.hbs',
   );

   const [template] = await Promise.all([
      fs.readFile(templatePath, { encoding: 'utf-8' }),
   ]);

   const hbsTemplate = Handlebars.compile<CompileArgs>(template);

   return hbsTemplate({
      ...args,
      currentYear: new Date().getFullYear(),
      logoUrl: 'https://your-domain.com/logo.png',
   });
};
