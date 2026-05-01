import { OmrTemplateRulesService } from '../../shared/omr-template-rules.service';

describe('OmrTemplateRulesService', () => {
   const service = new OmrTemplateRulesService();

   function buildLayout(overrides?: {
      registration?: Record<string, unknown>;
      questionsBlock?: Record<string, unknown>;
   }) {
      return {
         page: {
            format: 'A4',
            orientation: 'portrait',
            widthMm: 210,
            heightMm: 297,
            safeMarginMm: 5,
         },
         fixedBlocks: {
            registration: {
               type: 'bubble_grid',
               fixed: true,
               locked: false,
               digits: 7,
               rows: 10,
               columns: 7,
               xMm: 20,
               yMm: 102,
               widthMm: 54.25,
               heightMm: 60.5,
               bubbleDiameterMm: 4,
               colGapMm: 8,
               rowGapMm: 6,
               strictOneMarkPerColumn: true,
               ...overrides?.registration,
            },
         },
         questionsBlock: {
            questionCount: 10,
            alternatives: ['A', 'B', 'C', 'D', 'E'],
            columns: 1,
            rowsPerColumn: 10,
            xMm: 20,
            yMm: 170,
            widthMm: 49.5,
            heightMm: 69,
            bubbleDiameterMm: 4,
            optionGapMm: 5.7,
            rowGapMm: 6,
            colGapMm: 41.8,
            ...overrides?.questionsBlock,
         },
      };
   }

   it('preserva as dimensoes visuais informadas pelo editor ao compilar geometria', () => {
      const layout = buildLayout({
         registration: { widthMm: 54.25, heightMm: 60.5 },
         questionsBlock: { widthMm: 49.5, heightMm: 69 },
      });

      const geometry = service.compileGeometry(layout, 10);

      expect(geometry.registration.widthMm).toBe(54.25);
      expect(geometry.registration.heightMm).toBe(60.5);
      expect(geometry.questions.widthMm).toBe(49.5);
      expect(geometry.questions.heightMm).toBe(69);
   });

   it.each([
      { questionCount: 10, widthMm: 49, heightMm: 68.6 },
      { questionCount: 25, widthMm: 132.6, heightMm: 68.6 },
      { questionCount: 60, widthMm: 174.4, heightMm: 146.2 },
   ])(
      'mantem as dimensoes visuais do editor para $questionCount questoes',
      ({ questionCount, widthMm, heightMm }) => {
         const layout = buildLayout({
            questionsBlock: {
               questionCount,
               xMm: 20,
               yMm: 20,
               widthMm,
               heightMm,
            },
         });

         const geometry = service.compileGeometry(layout, questionCount);

         expect(geometry.questions.widthMm).toBeCloseTo(widthMm, 3);
         expect(geometry.questions.heightMm).toBeCloseTo(heightMm, 3);
      },
   );

   it('usa as dimensoes visuais do editor para limitar blocos no canto inferior direito', () => {
      const layout = buildLayout({
         registration: {
            xMm: 999,
            yMm: 999,
            widthMm: 54.25,
            heightMm: 60.5,
         },
         questionsBlock: {
            xMm: 999,
            yMm: 999,
            widthMm: 49.5,
            heightMm: 69,
         },
      });

      const geometry = service.compileGeometry(layout, 10);

      expect(geometry.registration.xMm).toBe(150.75);
      expect(geometry.registration.yMm).toBe(231.5);
      expect(geometry.questions.xMm).toBe(155.5);
      expect(geometry.questions.yMm).toBe(223);
   });
});
