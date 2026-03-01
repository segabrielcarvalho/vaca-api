type EmailAction = {
   label: string;
   url: string;
};

type EmailTemplateParams = {
   title: string;
   greeting?: string;
   introLines?: string[];
   actions?: EmailAction[];
   footer?: string;
   note?: string;
};

const escapeHtml = (value: string) =>
   value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

const renderLines = (lines?: string[]) =>
   (lines ?? [])
      .filter((line) => line && line.trim())
      .map((line) => `<p style="margin:0 0 12px 0;">${line}</p>`)
      .join('');

const renderActions = (actions?: EmailAction[]) => {
   if (!actions?.length) return '';

   return actions
      .map(
         (action) => `
        <div style="margin:0 0 12px 0;">
          <a href="${action.url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;font-size:14px;">
            ${escapeHtml(action.label)}
          </a>
        </div>
      `,
      )
      .join('');
};

export const buildBasicEmailHtml = (params: EmailTemplateParams) => {
   const title = escapeHtml(params.title);
   const greeting = params.greeting ? escapeHtml(params.greeting) : 'Olá';

   return `
  <div style="background:#f6f7fb;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 26px;border:1px solid #e5e7eb;">
      <h1 style="font-size:18px;margin:0 0 12px 0;">${title}</h1>
      <p style="margin:0 0 16px 0;font-size:14px;color:#4b5563;">${greeting}</p>
      ${renderLines(params.introLines)}
      ${renderActions(params.actions)}
      ${params.footer ? `<p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">${params.footer}</p>` : ''}
      ${params.note ? `<p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;">${params.note}</p>` : ''}
    </div>
  </div>
  `;
};

export type { EmailAction, EmailTemplateParams };
