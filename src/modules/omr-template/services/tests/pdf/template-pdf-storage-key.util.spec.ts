import { buildTemplatePdfStorageKey } from '../../pdf/template-pdf-storage-key.util';

describe('template-pdf-storage-key.util', () => {
   it('monta chave do PDF com nome legivel do template', () => {
      expect(
         buildTemplatePdfStorageKey({
            templateId: 'template-123',
            version: 3,
            generationIndex: 2,
            templateName: '1ª Verificação de Aprendizagem - Questões Objetivas',
         }),
      ).toBe(
         'omr/templates/template-123/v3/pdf/g2/1a-verificacao-de-aprendizagem-questoes-objetivas-v3.pdf',
      );
   });

   it('usa fallback seguro quando o nome nao tem caracteres validos', () => {
      expect(
         buildTemplatePdfStorageKey({
            templateId: 'template-123',
            version: 1,
            generationIndex: 1,
            templateName: '***',
         }),
      ).toBe('omr/templates/template-123/v1/pdf/g1/template-omr-v1.pdf');
   });
});
