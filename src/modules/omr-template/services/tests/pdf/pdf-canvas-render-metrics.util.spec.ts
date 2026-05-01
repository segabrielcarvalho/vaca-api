import {
   EDITOR_BLOCK_PADDING_PX,
   EDITOR_HEADER_CREATE_FONT_SIZE_PX,
   editorPxToMm,
   editorCssPtToPdfPt,
   editorCssPxToPdfPt,
   editorPxToPdfPt,
   mmToPt,
   resolveEditorTextBox,
   resolveBubbleLabelBaselineY,
   resolveQuestionHeaderBaselineY,
   resolveQuestionLabelXmm,
   resolveStructuredHeaderLayout,
   resolveTextBaselineYForTopLine,
   resolveTextBaselineYForCenteredLine,
   resolveTextLineTopY,
   toPdfRect,
} from '../../pdf/pdf-canvas-render-metrics.util';

describe('pdf-canvas-render-metrics.util', () => {
   it('converte pixels renderizados em milimetros pelo tamanho real do canvas', () => {
      expect(editorPxToMm(280, 560, 210)).toBeCloseTo(105, 4);
      expect(editorPxToMm(280, 700, 210)).toBeCloseTo(84, 4);
   });

   it('converte pixels do canvas para pontos fisicos do PDF', () => {
      expect(editorPxToPdfPt(4)).toBeCloseTo(4.2519, 3);
      expect(editorPxToPdfPt(11)).toBeCloseTo(11.6929, 3);
   });

   it('converte retangulo mm de origem superior esquerda para PDF points', () => {
      const rect = toPdfRect(mmToPt(297), 20, 40, 52, 60);

      expect(rect.x).toBeCloseTo(56.693, 3);
      expect(rect.y).toBeCloseTo(558.425, 3);
      expect(rect.width).toBeCloseTo(147.402, 3);
      expect(rect.height).toBeCloseTo(170.079, 3);
   });

   it('converte fonte CSS sem aplicar escala fisica do canvas novamente', () => {
      expect(editorCssPtToPdfPt(14)).toBeCloseTo(14, 4);
      expect(editorCssPxToPdfPt(11)).toBeCloseTo(8.25, 4);
   });

   it('resolve a caixa interna de texto com o padding do bloco do editor', () => {
      const box = resolveEditorTextBox({
         pageHeightPt: 841.8898,
         xMm: 80,
         yMm: 102,
         widthMm: 118,
         heightMm: 20,
         paddingPx: EDITOR_BLOCK_PADDING_PX,
      });

      expect(box.x).toBeCloseTo(231.023, 2);
      expect(box.y).toBeCloseTo(500.315, 3);
      expect(box.width).toBeCloseTo(325.984, 3);
      expect(box.height).toBeCloseTo(48.189, 3);
   });

   it('posiciona texto pelo topo usando baseline de line-box aproximado do browser', () => {
      const textBox = {
         x: 0,
         y: 100,
         width: 200,
         height: 50,
      };

      expect(resolveTextLineTopY(textBox)).toBeCloseTo(150, 3);
      expect(resolveTextBaselineYForTopLine(textBox, 12, 1.2)).toBeCloseTo(
         140.184,
         3,
      );
   });

   it('centraliza labels com baseline baseado em ascender realista', () => {
      expect(resolveTextBaselineYForCenteredLine(400, 8.25)).toBeCloseTo(
         397.521,
         3,
      );
   });

   it('resolve linhas e celulas do cabecalho estruturado como o preview do editor', () => {
      const header = resolveStructuredHeaderLayout(
         toPdfRect(mmToPt(297), 15, 52, 190, 45),
         editorCssPxToPdfPt(EDITOR_HEADER_CREATE_FONT_SIZE_PX),
      );

      expect(header.rows.banner.height).toBeCloseTo(27.73, 3);
      expect(header.rows.discipline.height).toBeCloseTo(24.403, 3);
      expect(header.rows.assessment.y).toBeCloseTo(566.929, 3);
      expect(header.professorDate.professor.width).toBeCloseTo(312.378, 3);
      expect(header.assessment.assessmentName.width).toBeCloseTo(255.118, 3);
      expect(header.assessment.grade.x).toBeCloseTo(297.638, 3);
      expect(header.bannerTextBaselineY).toBeCloseTo(675.732, 3);
   });

   it('ancora alternativas no topo visual do bloco de questoes', () => {
      expect(resolveQuestionHeaderBaselineY(841.8898, 195.88, 9)).toBeCloseTo(
         279.277,
         3,
      );
   });

   it('centraliza labels de bolhas pela coordenada fisica do centro', () => {
      expect(resolveBubbleLabelBaselineY(841.8898, 203.48, 8.25)).toBeCloseTo(
         262.617,
         3,
      );
   });

   it('mantem o numero da questao no inicio visual do bloco', () => {
      expect(resolveQuestionLabelXmm(12.76)).toBeCloseTo(12.76, 2);
   });
});
