const MM_TO_PT = 72 / 25.4;
const EDITOR_PAGE_WIDTH_MM = 210;
const EDITOR_CANVAS_WIDTH_PX = 560;
const PDF_PT_PER_CSS_PX = 72 / 96;
const HELVETICA_ASCENDER_RATIO = 0.718;
const HELVETICA_DESCENDER_RATIO = 0.117;

export const EDITOR_BLOCK_PADDING_PX = 4;
export const EDITOR_MARKDOWN_FONT_SIZE_PX = 11;
export const EDITOR_QUESTION_LABEL_FONT_SIZE_PX = 11;
export const EDITOR_QUESTION_HEADER_FONT_SIZE_PX = 12;
export const EDITOR_HEADER_DETAIL_FONT_SIZE_PX = 9;
export const EDITOR_HEADER_CREATE_FONT_SIZE_PX = 8;
export const EDITOR_LINE_HEIGHT_RATIO = 1.2;
export const HEADER_STRUCTURED_ROW_HEIGHT_UNITS = {
   banner: 1.25,
   discipline: 1.1,
   professorDate: 1.1,
   studentName: 1.1,
   assessment: 1.2,
} as const;

export type PdfRect = {
   x: number;
   y: number;
   width: number;
   height: number;
};

export function mmToPt(valueMm: number): number {
   return valueMm * MM_TO_PT;
}

export function editorPxToMm(
   valuePx: number,
   renderedCanvasPx = EDITOR_CANVAS_WIDTH_PX,
   pageMm = EDITOR_PAGE_WIDTH_MM,
): number {
   return (valuePx / renderedCanvasPx) * pageMm;
}

export function editorPxToPdfPt(valuePx: number): number {
   return mmToPt(editorPxToMm(valuePx));
}

export function editorCssPxToPdfPt(valuePx: number): number {
   return valuePx * PDF_PT_PER_CSS_PX;
}

export function editorCssPtToPdfPt(valuePt: number): number {
   return valuePt;
}

export function toPdfRect(
   pageHeightPt: number,
   xMm: number,
   yMm: number,
   widthMm: number,
   heightMm: number,
): PdfRect {
   const x = mmToPt(xMm);
   const y = pageHeightPt - mmToPt(yMm) - mmToPt(heightMm);
   const width = mmToPt(widthMm);
   const height = mmToPt(heightMm);
   return { x, y, width, height };
}

export function insetPdfRect(rect: PdfRect, insetPt: number): PdfRect {
   return {
      x: rect.x + insetPt,
      y: rect.y + insetPt,
      width: Math.max(0, rect.width - insetPt * 2),
      height: Math.max(0, rect.height - insetPt * 2),
   };
}

export function resolveEditorTextBox(input: {
   pageHeightPt: number;
   xMm: number;
   yMm: number;
   widthMm: number;
   heightMm: number;
   paddingPx?: number;
}): PdfRect {
   return insetPdfRect(
      toPdfRect(
         input.pageHeightPt,
         input.xMm,
         input.yMm,
         input.widthMm,
         input.heightMm,
      ),
      editorPxToPdfPt(input.paddingPx ?? EDITOR_BLOCK_PADDING_PX),
   );
}

export function resolveTextLineTopY(
   rect: Pick<PdfRect, 'y' | 'height'>,
): number {
   return rect.y + rect.height;
}

export function resolveTextBaselineYForTopLine(
   rect: Pick<PdfRect, 'y' | 'height'>,
   fontSizePt: number,
   lineHeightRatio = EDITOR_LINE_HEIGHT_RATIO,
): number {
   const topY = resolveTextLineTopY(rect);
   const lineHeightPt = fontSizePt * lineHeightRatio;
   const leadingTopPt = Math.max(0, lineHeightPt - fontSizePt) / 2;
   return topY - leadingTopPt - fontSizePt * HELVETICA_ASCENDER_RATIO;
}

export function resolveTextBaselineYFromTop(
   topY: number,
   fontSizePt: number,
   lineHeightRatio = EDITOR_LINE_HEIGHT_RATIO,
): number {
   return resolveTextBaselineYForTopLine(
      { y: topY, height: 0 },
      fontSizePt,
      lineHeightRatio,
   );
}

export function resolveTextBaselineYForCenteredLine(
   centerY: number,
   fontSizePt: number,
): number {
   return (
      centerY -
      ((HELVETICA_ASCENDER_RATIO - HELVETICA_DESCENDER_RATIO) * fontSizePt) / 2
   );
}

export function resolveQuestionHeaderBaselineY(
   pageHeightPt: number,
   blockOriginYmm: number,
   fontSizePt: number,
): number {
   return resolveTextBaselineYFromTop(
      pageHeightPt - mmToPt(blockOriginYmm),
      fontSizePt,
   );
}

export function resolveBubbleLabelBaselineY(
   pageHeightPt: number,
   bubbleCenterYmm: number,
   fontSizePt: number,
): number {
   return resolveTextBaselineYForCenteredLine(
      pageHeightPt - mmToPt(bubbleCenterYmm),
      fontSizePt,
   );
}

export function resolveQuestionLabelXmm(blockOriginXmm: number): number {
   return blockOriginXmm;
}

export function resolveStructuredHeaderLayout(
   rect: PdfRect,
   fontSizePt: number,
): {
   rows: {
      banner: PdfRect;
      discipline: PdfRect;
      professorDate: PdfRect;
      studentName: PdfRect;
      assessment: PdfRect;
   };
   professorDate: {
      professor: PdfRect;
      date: PdfRect;
   };
   assessment: {
      assessmentName: PdfRect;
      grade: PdfRect;
      signature: PdfRect;
   };
   bannerTextBaselineY: number;
} {
   const rowUnits = HEADER_STRUCTURED_ROW_HEIGHT_UNITS;
   const rowUnitTotal =
      rowUnits.banner +
      rowUnits.discipline +
      rowUnits.professorDate +
      rowUnits.studentName +
      rowUnits.assessment;
   const bannerHeight = (rect.height * rowUnits.banner) / rowUnitTotal;
   const disciplineHeight = (rect.height * rowUnits.discipline) / rowUnitTotal;
   const professorDateHeight =
      (rect.height * rowUnits.professorDate) / rowUnitTotal;
   const studentNameHeight =
      (rect.height * rowUnits.studentName) / rowUnitTotal;
   const assessmentHeight = (rect.height * rowUnits.assessment) / rowUnitTotal;

   const banner: PdfRect = {
      x: rect.x,
      y: rect.y + rect.height - bannerHeight,
      width: rect.width,
      height: bannerHeight,
   };
   const discipline: PdfRect = {
      x: rect.x,
      y: banner.y - disciplineHeight,
      width: rect.width,
      height: disciplineHeight,
   };
   const professorDate: PdfRect = {
      x: rect.x,
      y: discipline.y - professorDateHeight,
      width: rect.width,
      height: professorDateHeight,
   };
   const studentName: PdfRect = {
      x: rect.x,
      y: professorDate.y - studentNameHeight,
      width: rect.width,
      height: studentNameHeight,
   };
   const assessment: PdfRect = {
      x: rect.x,
      y: studentName.y - assessmentHeight,
      width: rect.width,
      height: assessmentHeight,
   };

   const professorWidth = rect.width * 0.58;
   const professor: PdfRect = {
      x: professorDate.x,
      y: professorDate.y,
      width: professorWidth,
      height: professorDate.height,
   };
   const date: PdfRect = {
      x: professorDate.x + professorWidth,
      y: professorDate.y,
      width: professorDate.width - professorWidth,
      height: professorDate.height,
   };

   const assessmentNameWidth = rect.width * (1.8 / 3.8);
   const gradeWidth = rect.width * (1 / 3.8);
   const assessmentName: PdfRect = {
      x: assessment.x,
      y: assessment.y,
      width: assessmentNameWidth,
      height: assessment.height,
   };
   const grade: PdfRect = {
      x: assessment.x + assessmentNameWidth,
      y: assessment.y,
      width: gradeWidth,
      height: assessment.height,
   };
   const signature: PdfRect = {
      x: grade.x + gradeWidth,
      y: assessment.y,
      width: assessment.width - assessmentNameWidth - gradeWidth,
      height: assessment.height,
   };

   return {
      rows: {
         banner,
         discipline,
         professorDate,
         studentName,
         assessment,
      },
      professorDate: {
         professor,
         date,
      },
      assessment: {
         assessmentName,
         grade,
         signature,
      },
      bannerTextBaselineY: Math.max(
         banner.y + 1,
         banner.y + banner.height - editorPxToPdfPt(12) - fontSizePt,
      ),
   };
}
