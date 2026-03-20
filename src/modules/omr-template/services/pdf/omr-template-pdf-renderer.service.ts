import { Injectable } from '@nestjs/common';
import {
   PDFDocument,
   StandardFonts,
   rgb,
   type PDFFont,
   type PDFPage,
   type RGB,
} from 'pdf-lib';
import { getArucoMarkerPngById } from './aruco-marker-assets.util';
import { getRegistrationRenderMetrics } from './registration-render-metrics.util';

const MM_TO_PT = 72 / 25.4;
const DEFAULT_PAGE_WIDTH_MM = 210;
const DEFAULT_PAGE_HEIGHT_MM = 297;
const OMR_NUMBER_FONT_SIZE_PT = 8.2;
const OMR_QUESTION_HEADER_FONT_SIZE_PT = OMR_NUMBER_FONT_SIZE_PT + 1;
const OMR_NUMBER_COLOR = rgb(0.09, 0.13, 0.22);
const OMR_NUMBER_BASELINE_OFFSET_PT = 2.5;

type JsonObject = Record<string, unknown>;

type RenderTemplatePdfInput = {
   templateName: string;
   layoutJson: unknown;
   compiledGeometryJson: unknown;
};

function asObject(value: unknown): JsonObject {
   if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
   }

   return value as JsonObject;
}

function asArray(value: unknown): unknown[] {
   return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback: number): number {
   const parsed = Number(value);
   return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown): string | null {
   if (typeof value !== 'string') return null;
   const trimmed = value.trim();
   return trimmed.length > 0 ? trimmed : null;
}

function mmToPt(valueMm: number): number {
   return valueMm * MM_TO_PT;
}

function toPdfRect(
   pageHeightPt: number,
   xMm: number,
   yMm: number,
   widthMm: number,
   heightMm: number,
) {
   const x = mmToPt(xMm);
   const y = pageHeightPt - mmToPt(yMm) - mmToPt(heightMm);
   const width = mmToPt(widthMm);
   const height = mmToPt(heightMm);
   return { x, y, width, height };
}

function parseHexColor(input: string | null | undefined, fallback: RGB): RGB {
   if (!input) return fallback;
   const value = input.trim().replace('#', '');
   const valid = value.length === 3 || value.length === 6;
   if (!valid) return fallback;

   const normalized =
      value.length === 3
         ? value
              .split('')
              .map((char) => `${char}${char}`)
              .join('')
         : value;

   const asInt = Number.parseInt(normalized, 16);
   if (!Number.isFinite(asInt)) return fallback;

   return rgb(
      ((asInt >> 16) & 0xff) / 255,
      ((asInt >> 8) & 0xff) / 255,
      (asInt & 0xff) / 255,
   );
}

function decodeBase64Data(data: string | null | undefined): {
   bytes: Uint8Array;
   mimeType: string | null;
} | null {
   if (!data) return null;

   const dataUrlMatch = data.match(/^data:(.+?);base64,(.+)$/i);
   if (dataUrlMatch) {
      return {
         mimeType: dataUrlMatch[1] ?? null,
         bytes: Buffer.from(dataUrlMatch[2], 'base64'),
      };
   }

   try {
      return {
         mimeType: null,
         bytes: Buffer.from(data, 'base64'),
      };
   } catch {
      return null;
   }
}

function markdownToPlainText(markdown: string | null | undefined): string {
   if (!markdown) return '';

   return markdown
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^[-*+]\s+/gm, '- ')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .trim();
}

function drawWrappedText(input: {
   page: PDFPage;
   text: string;
   rect: { x: number; y: number; width: number; height: number };
   font: PDFFont;
   fontSize: number;
   color: RGB;
   lineHeight?: number;
}) {
   const { page, text, rect, font, fontSize, color } = input;
   const lineHeight = input.lineHeight ?? fontSize * 1.2;
   if (!text.trim()) return;

   const paragraphs = text.split('\n');
   const lines: string[] = [];

   paragraphs.forEach((paragraph) => {
      if (!paragraph.trim()) {
         lines.push('');
         return;
      }

      const words = paragraph.split(/\s+/);
      let current = '';

      words.forEach((word) => {
         const candidate = current ? `${current} ${word}` : word;
         if (font.widthOfTextAtSize(candidate, fontSize) <= rect.width) {
            current = candidate;
         } else {
            if (current) lines.push(current);
            current = word;
         }
      });

      if (current) lines.push(current);
   });

   const maxLines = Math.max(1, Math.floor(rect.height / lineHeight));
   const visible = lines.slice(0, maxLines);

   visible.forEach((line, index) => {
      const y = rect.y + rect.height - fontSize - index * lineHeight;
      if (y < rect.y) return;
      page.drawText(line, {
         x: rect.x,
         y,
         size: fontSize,
         font,
         color,
      });
   });
}

@Injectable()
export class OmrTemplatePdfRendererService {
   async render(input: RenderTemplatePdfInput): Promise<{
      pdfBuffer: Buffer;
      previewImageBuffer: null;
   }> {
      const layout = asObject(input.layoutJson);
      const geometry = asObject(input.compiledGeometryJson);
      const layoutPage = asObject(layout.page);
      const contentBlocks = asObject(layout.contentBlocks);

      const pageWidthMm = asNumber(layoutPage.widthMm, DEFAULT_PAGE_WIDTH_MM);
      const pageHeightMm = asNumber(
         layoutPage.heightMm,
         DEFAULT_PAGE_HEIGHT_MM,
      );
      const pageWidthPt = mmToPt(pageWidthMm);
      const pageHeightPt = mmToPt(pageHeightMm);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      await this.drawFiducials(page, pageHeightPt, geometry, pdfDoc);
      await this.drawLogo(page, pdfDoc, pageHeightPt, contentBlocks);
      this.drawTitle(
         page,
         pageHeightPt,
         contentBlocks,
         input.templateName,
         fontRegular,
         fontBold,
      );
      this.drawStructuredHeader(
         page,
         pageHeightPt,
         contentBlocks,
         fontRegular,
         fontBold,
      );

      this.drawRegistrationBlock(page, pageHeightPt, geometry, fontBold);
      this.drawQuestionsBlock(
         page,
         pageHeightPt,
         geometry,
         fontRegular,
         fontBold,
      );
      this.drawMarkdownBlocks(page, pageHeightPt, contentBlocks, fontRegular);

      const bytes = await pdfDoc.save();

      return {
         pdfBuffer: Buffer.from(bytes),
         previewImageBuffer: null,
      };
   }

   private async drawFiducials(
      page: PDFPage,
      pageHeightPt: number,
      geometry: JsonObject,
      pdfDoc: PDFDocument,
   ): Promise<void> {
      const anchors = asArray(geometry.anchors);
      const embeddedMarkers = new Map<
         number,
         Awaited<ReturnType<PDFDocument['embedPng']>>
      >();

      for (const [index, entry] of anchors.entries()) {
         const anchor = asObject(entry);
         const xMm = asNumber(anchor.xMm, 0);
         const yMm = asNumber(anchor.yMm, 0);
         const sizeMm = asNumber(anchor.sizeMm, 5);
         const rect = toPdfRect(pageHeightPt, xMm, yMm, sizeMm, sizeMm);
         const markerIdValue = Number(anchor.id);
         const markerId = Number.isInteger(markerIdValue)
            ? markerIdValue
            : index;
         const markerPng = getArucoMarkerPngById(markerId);

         if (markerPng) {
            let embeddedMarker = embeddedMarkers.get(markerId);
            if (!embeddedMarker) {
               embeddedMarker = await pdfDoc.embedPng(markerPng);
               embeddedMarkers.set(markerId, embeddedMarker);
            }

            page.drawImage(embeddedMarker, rect);
            continue;
         }

         page.drawRectangle({
            ...rect,
            borderWidth: 1.2,
            borderColor: rgb(0.12, 0.12, 0.12),
         });
      }
   }

   private async drawLogo(
      page: PDFPage,
      pdfDoc: PDFDocument,
      pageHeightPt: number,
      contentBlocks: JsonObject,
   ) {
      const logo = asObject(contentBlocks.logo);
      const imageBase64 = asString(logo.imageBase64);
      if (!imageBase64) return;

      const decoded = decodeBase64Data(imageBase64);
      if (!decoded) return;

      let embedded:
         | Awaited<ReturnType<PDFDocument['embedPng']>>
         | Awaited<ReturnType<PDFDocument['embedJpg']>>;
      if (
         decoded.mimeType?.includes('jpeg') ||
         decoded.mimeType?.includes('jpg')
      ) {
         embedded = await pdfDoc.embedJpg(decoded.bytes);
      } else {
         embedded = await pdfDoc.embedPng(decoded.bytes);
      }

      const rect = toPdfRect(
         pageHeightPt,
         asNumber(logo.xMm, 20),
         asNumber(logo.yMm, 20),
         asNumber(logo.widthMm, 40),
         asNumber(logo.heightMm, 20),
      );

      const contained = embedded.scaleToFit(rect.width, rect.height);
      page.drawImage(embedded, {
         x: rect.x + (rect.width - contained.width) / 2,
         y: rect.y + (rect.height - contained.height) / 2,
         width: contained.width,
         height: contained.height,
      });
   }

   private drawTitle(
      page: PDFPage,
      pageHeightPt: number,
      contentBlocks: JsonObject,
      fallbackTemplateName: string,
      fontRegular: PDFFont,
      fontBold: PDFFont,
   ) {
      const title = asObject(contentBlocks.title);
      if (Object.keys(title).length === 0) return;

      const style = asObject(title.style);
      const rawValue = asString(title.value) ?? fallbackTemplateName;
      const uppercase = Boolean(style.uppercase);
      const text = uppercase ? rawValue.toUpperCase() : rawValue;
      const fontSizePt = asNumber(style.fontSizePt, 16);
      const align = asString(style.textAlign) ?? 'left';
      const isBold = (asString(style.fontWeight) ?? 'bold') !== 'normal';
      const font = isBold ? fontBold : fontRegular;

      const rect = toPdfRect(
         pageHeightPt,
         asNumber(title.xMm, 20),
         asNumber(title.yMm, 8),
         asNumber(title.widthMm, 170),
         asNumber(title.heightMm, 10),
      );

      const textWidth = font.widthOfTextAtSize(text, fontSizePt);
      const x =
         align === 'center'
            ? rect.x + (rect.width - textWidth) / 2
            : align === 'right'
              ? rect.x + rect.width - textWidth
              : rect.x;
      const y = rect.y + Math.max(0, (rect.height - fontSizePt) / 2);

      page.drawText(text, {
         x,
         y,
         size: fontSizePt,
         font,
         color: rgb(0.1, 0.14, 0.2),
      });
   }

   private drawStructuredHeader(
      page: PDFPage,
      pageHeightPt: number,
      contentBlocks: JsonObject,
      fontRegular: PDFFont,
      fontBold: PDFFont,
   ) {
      const header = asObject(contentBlocks.header);
      const structured = asObject(header.structured);
      if (
         Object.keys(header).length === 0 ||
         Object.keys(structured).length === 0
      )
         return;

      const rect = toPdfRect(
         pageHeightPt,
         asNumber(header.xMm, 15),
         asNumber(header.yMm, 52),
         asNumber(header.widthMm, 180),
         asNumber(header.heightMm, 42),
      );

      const showBorders = structured.showBorders !== false;
      const bannerEnabled = structured.bannerEnabled !== false;
      const topBarBg = parseHexColor(
         asString(structured.topBarBgColor),
         rgb(0.1, 0.24, 0.43),
      );
      const topBarText = parseHexColor(
         asString(structured.topBarTextColor),
         rgb(1, 1, 1),
      );

      if (showBorders) {
         page.drawRectangle({
            ...rect,
            borderWidth: 0.8,
            borderColor: rgb(0.2, 0.2, 0.2),
         });
      }

      const rowHeights = [0.22, 0.195, 0.195, 0.195, 0.195].map(
         (ratio) => rect.height * ratio,
      );
      let cursorTop = rect.y + rect.height;

      const fields = new Map<string, { label: string; enabled: boolean }>();
      asArray(structured.fields).forEach((item) => {
         const field = asObject(item);
         const key = asString(field.key);
         if (!key) return;
         fields.set(key, {
            label: asString(field.label) ?? key,
            enabled: field.enabled !== false,
         });
      });

      const drawCell = (
         x: number,
         y: number,
         width: number,
         height: number,
         key: string,
      ) => {
         const field = fields.get(key);
         if (!field?.enabled) return;
         page.drawText(`${field.label}`, {
            x: x + 3,
            y: y + Math.max(2, height / 2 - 4.5),
            size: 8.5,
            font: fontRegular,
            color: rgb(0.1, 0.1, 0.1),
         });

         if (key === 'date') {
            page.drawText('____/____/______', {
               x: x + Math.min(width - 52, 52),
               y: y + Math.max(2, height / 2 - 4.5),
               size: 8.2,
               font: fontBold,
               color: rgb(0.15, 0.15, 0.15),
            });
         }
      };

      const bannerHeight = rowHeights[0] ?? rect.height * 0.2;
      cursorTop -= bannerHeight;
      if (bannerEnabled) {
         page.drawRectangle({
            x: rect.x,
            y: cursorTop,
            width: rect.width,
            height: bannerHeight,
            color: topBarBg,
         });
         page.drawText(asString(structured.bannerText) ?? '', {
            x: rect.x + 3,
            y: cursorTop + Math.max(2, bannerHeight / 2 - 4.2),
            size: 8.5,
            font: fontBold,
            color: topBarText,
         });
      }

      const drawRowBorder = (y: number) => {
         if (!showBorders) return;
         page.drawLine({
            start: { x: rect.x, y },
            end: { x: rect.x + rect.width, y },
            thickness: 0.7,
            color: rgb(0.2, 0.2, 0.2),
         });
      };

      drawRowBorder(cursorTop);

      const row1 = rowHeights[1] ?? rect.height * 0.2;
      cursorTop -= row1;
      drawCell(rect.x, cursorTop, rect.width, row1, 'discipline');
      drawRowBorder(cursorTop);

      const row2 = rowHeights[2] ?? rect.height * 0.2;
      cursorTop -= row2;
      const leftW = rect.width * 0.62;
      const rightW = rect.width - leftW;
      drawCell(rect.x, cursorTop, leftW, row2, 'professor');
      drawCell(rect.x + leftW, cursorTop, rightW, row2, 'date');
      if (showBorders) {
         page.drawLine({
            start: { x: rect.x + leftW, y: cursorTop },
            end: { x: rect.x + leftW, y: cursorTop + row2 },
            thickness: 0.7,
            color: rgb(0.2, 0.2, 0.2),
         });
      }
      drawRowBorder(cursorTop);

      const row3 = rowHeights[3] ?? rect.height * 0.2;
      cursorTop -= row3;
      drawCell(rect.x, cursorTop, rect.width, row3, 'studentName');
      drawRowBorder(cursorTop);

      const row4 = rowHeights[4] ?? rect.height * 0.2;
      cursorTop -= row4;
      const w1 = rect.width * 0.5;
      const w2 = rect.width * 0.25;
      const w3 = rect.width - w1 - w2;
      drawCell(rect.x, cursorTop, w1, row4, 'assessmentName');
      drawCell(rect.x + w1, cursorTop, w2, row4, 'grade');
      drawCell(rect.x + w1 + w2, cursorTop, w3, row4, 'signature');

      if (showBorders) {
         page.drawLine({
            start: { x: rect.x + w1, y: cursorTop },
            end: { x: rect.x + w1, y: cursorTop + row4 },
            thickness: 0.7,
            color: rgb(0.2, 0.2, 0.2),
         });
         page.drawLine({
            start: { x: rect.x + w1 + w2, y: cursorTop },
            end: { x: rect.x + w1 + w2, y: cursorTop + row4 },
            thickness: 0.7,
            color: rgb(0.2, 0.2, 0.2),
         });
      }
   }

   private drawRegistrationBlock(
      page: PDFPage,
      pageHeightPt: number,
      geometry: JsonObject,
      fontBold: PDFFont,
   ) {
      const registration = asObject(geometry.registration);
      if (Object.keys(registration).length === 0) return;

      const xMm = asNumber(registration.xMm, 20);
      const yMm = asNumber(registration.yMm, 102);
      const columns = Math.max(
         1,
         Math.round(asNumber(registration.columns, 7)),
      );
      const digits = Math.max(
         1,
         Math.round(asNumber(registration.digits, columns)),
      );
      const rows = Math.max(1, Math.round(asNumber(registration.rows, 10)));
      const colGapMm = asNumber(registration.colGapMm, 8);
      const rowGapMm = asNumber(registration.rowGapMm, 6);
      const bubbleDiameterMm = asNumber(registration.bubbleDiameterMm, 4);
      const startXmm = asNumber(
         registration.startXmm,
         xMm + bubbleDiameterMm / 2,
      );
      const startYmm = asNumber(
         registration.startYmm,
         yMm + bubbleDiameterMm / 2,
      );
      const metrics = getRegistrationRenderMetrics({
         digits,
         rows,
         columns,
         colGapMm,
         rowGapMm,
         bubbleDiameterMm,
         startXmm,
         startYmm,
         markerNudgeMm: asNumber(registration.markerNudgeMm, 0),
         markerWidthMm: asNumber(registration.markerWidthMm, colGapMm),
         markerHeightMm: asNumber(
            registration.markerHeightMm,
            bubbleDiameterMm + 3.5,
         ),
         headerOffsetMm: asNumber(
            registration.headerOffsetMm,
            Math.max(bubbleDiameterMm * 1.5, 6),
         ),
         sideOffsetMm: asNumber(
            registration.sideOffsetMm,
            Math.max(bubbleDiameterMm, 4),
         ),
      });

      for (const markerRectMm of metrics.markerRects) {
         const markerRect = toPdfRect(
            pageHeightPt,
            markerRectMm.xMm,
            markerRectMm.yMm,
            markerRectMm.widthMm,
            markerRectMm.heightMm,
         );
         page.drawRectangle({
            ...markerRect,
            borderWidth: 0.7,
            borderColor: rgb(0.38, 0.41, 0.47),
         });
      }

      for (const rowLabel of metrics.rowLabels) {
         page.drawText(rowLabel.text, {
            x: mmToPt(rowLabel.xMm),
            y:
               pageHeightPt -
               mmToPt(rowLabel.yCenterMm) -
               OMR_NUMBER_BASELINE_OFFSET_PT,
            size: OMR_NUMBER_FONT_SIZE_PT,
            font: fontBold,
            color: OMR_NUMBER_COLOR,
         });
      }

      for (const bubbleCenter of metrics.bubbleCenters) {
         page.drawCircle({
            x: mmToPt(bubbleCenter.xMm),
            y: pageHeightPt - mmToPt(bubbleCenter.yMm),
            size: mmToPt(bubbleDiameterMm / 2),
            borderWidth: 0.7,
            borderColor: rgb(0.12, 0.12, 0.12),
         });
      }
   }

   private drawQuestionsBlock(
      page: PDFPage,
      pageHeightPt: number,
      geometry: JsonObject,
      fontRegular: PDFFont,
      fontBold: PDFFont,
   ) {
      const questions = asObject(geometry.questions);
      if (Object.keys(questions).length === 0) return;

      const xMm = asNumber(questions.xMm, 20);
      const yMm = asNumber(questions.yMm, 170);
      const questionCount = Math.max(
         0,
         Math.round(asNumber(questions.questionCount, 10)),
      );
      const columns = Math.max(1, Math.round(asNumber(questions.columns, 1)));
      const rowsPerColumn = Math.max(
         1,
         Math.round(asNumber(questions.rowsPerColumn, 10)),
      );
      const maxColumnsPerRow = Math.max(
         1,
         Math.round(asNumber(questions.maxColumnsPerRow, 4)),
      );
      const columnsPerRow = Math.max(
         1,
         Math.min(
            columns,
            Math.round(asNumber(questions.columnsPerRow, maxColumnsPerRow)),
         ),
      );
      const colGapMm = asNumber(questions.colGapMm, 41.8);
      const rowGapMm = asNumber(questions.rowGapMm, 6);
      const optionGapMm = asNumber(questions.optionGapMm, 5.7);
      const bubbleDiameterMm = asNumber(questions.bubbleDiameterMm, 4);
      const alternatives = asArray(questions.alternatives)
         .map((value) => asString(value))
         .filter((value): value is string => Boolean(value));
      const safeAlternatives =
         alternatives.length > 0 ? alternatives : ['A', 'B', 'C', 'D', 'E'];
      const questionLabelGutterMm = asNumber(
         questions.questionLabelGutterMm,
         Math.max(bubbleDiameterMm * 1.8, 7),
      );
      const headerBandMm = asNumber(
         questions.headerBandMm,
         Math.max(bubbleDiameterMm * 1.4, 5),
      );
      const questionBlockHeightMm =
         (rowsPerColumn - 1) * rowGapMm + bubbleDiameterMm;
      const questionBlockWithHeaderHeightMm = asNumber(
         questions.questionBlockWithHeaderHeightMm,
         headerBandMm + questionBlockHeightMm,
      );
      const questionBlockRowGapMm = asNumber(
         questions.questionBlockRowGapMm,
         14,
      );

      for (let col = 0; col < columns; col += 1) {
         const blockColumnInRow = col % columnsPerRow;
         const blockRow = Math.floor(col / columnsPerRow);
         const blockOriginXmm = xMm + blockColumnInRow * colGapMm;
         const blockOriginYmm =
            yMm +
            blockRow *
               (questionBlockWithHeaderHeightMm + questionBlockRowGapMm);

         safeAlternatives.forEach((option, optionIdx) => {
            const x = mmToPt(
               blockOriginXmm +
                  questionLabelGutterMm +
                  optionIdx * optionGapMm +
                  bubbleDiameterMm / 2,
            );
            const y =
               pageHeightPt - mmToPt(blockOriginYmm + headerBandMm * 0.2) - 5;
            page.drawText(option, {
               x: x - 2,
               y,
               size: OMR_QUESTION_HEADER_FONT_SIZE_PT,
               font: fontBold,
               color: rgb(0.1, 0.14, 0.24),
            });
         });
      }

      for (let index = 0; index < questionCount; index += 1) {
         const col = Math.floor(index / rowsPerColumn);
         const row = index % rowsPerColumn;
         const questionNumber = index + 1;
         const blockColumnInRow = col % columnsPerRow;
         const blockRow = Math.floor(col / columnsPerRow);
         const blockOriginXmm = xMm + blockColumnInRow * colGapMm;
         const blockOriginYmm =
            yMm +
            blockRow *
               (questionBlockWithHeaderHeightMm + questionBlockRowGapMm);

         const numberXmm = blockOriginXmm + questionLabelGutterMm / 2 - 1.5;
         const numberYmm =
            blockOriginYmm +
            headerBandMm +
            row * rowGapMm +
            bubbleDiameterMm / 2;

         page.drawText(String(questionNumber), {
            x: mmToPt(numberXmm),
            y: pageHeightPt - mmToPt(numberYmm) - OMR_NUMBER_BASELINE_OFFSET_PT,
            size: OMR_NUMBER_FONT_SIZE_PT,
            font: fontBold,
            color: OMR_NUMBER_COLOR,
         });

         safeAlternatives.forEach((_, optionIdx) => {
            const centerXmm =
               blockOriginXmm +
               questionLabelGutterMm +
               optionIdx * optionGapMm +
               bubbleDiameterMm / 2;
            const centerYmm =
               blockOriginYmm +
               headerBandMm +
               row * rowGapMm +
               bubbleDiameterMm / 2;
            page.drawCircle({
               x: mmToPt(centerXmm),
               y: pageHeightPt - mmToPt(centerYmm),
               size: mmToPt(bubbleDiameterMm / 2),
               borderWidth: 0.7,
               borderColor: rgb(0.12, 0.12, 0.12),
            });
         });
      }
   }

   private drawMarkdownBlocks(
      page: PDFPage,
      pageHeightPt: number,
      contentBlocks: JsonObject,
      fontRegular: PDFFont,
   ) {
      const drawBlock = (blockName: 'instructions' | 'footer') => {
         const block = asObject(contentBlocks[blockName]);
         if (Object.keys(block).length === 0) return;

         const text = markdownToPlainText(asString(block.value) ?? '');
         if (!text) return;

         const rect = toPdfRect(
            pageHeightPt,
            asNumber(block.xMm, 20),
            asNumber(block.yMm, 240),
            asNumber(block.widthMm, 80),
            asNumber(block.heightMm, 18),
         );

         drawWrappedText({
            page,
            text,
            rect: {
               x: rect.x + 1,
               y: rect.y + 1,
               width: rect.width - 2,
               height: rect.height - 2,
            },
            font: fontRegular,
            fontSize: 8.4,
            color: rgb(0.26, 0.3, 0.4),
         });
      };

      drawBlock('instructions');
      drawBlock('footer');
   }
}
