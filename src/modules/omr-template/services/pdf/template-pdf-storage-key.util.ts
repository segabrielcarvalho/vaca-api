type BuildTemplatePdfStorageKeyInput = {
   templateId: string;
   version: number;
   generationIndex: number;
   templateName: string;
};

function slugifyTemplateName(value: string): string {
   const slug = value
      .replace(/ª/g, 'a')
      .replace(/º/g, 'o')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

   return slug.length > 0 ? slug : 'template-omr';
}

export function buildTemplatePdfStorageKey({
   templateId,
   version,
   generationIndex,
   templateName,
}: BuildTemplatePdfStorageKeyInput): string {
   const versionLabel = `v${version}`;
   const generationLabel = `g${generationIndex}`;
   const fileName = `${slugifyTemplateName(templateName)}-${versionLabel}.pdf`;

   return `omr/templates/${templateId}/${versionLabel}/pdf/${generationLabel}/${fileName}`;
}
