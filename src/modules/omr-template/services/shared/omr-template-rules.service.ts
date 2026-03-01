import { BadRequestException, Injectable } from '@nestjs/common';

const QUESTION_COUNT_MIN = 10;
const QUESTION_COUNT_MAX = 60;
const QUESTION_COUNT_STEP = 5;

type ParsedLayout = {
   page?: Record<string, unknown>;
   fixedBlocks?: Record<string, unknown>;
   questionsBlock?: {
      questionCount?: number;
      xMm?: number;
      yMm?: number;
      widthMm?: number;
      heightMm?: number;
      columns?: number;
      rowsPerColumn?: number;
      alternatives?: unknown[];
      bubbleDiameterMm?: number;
      optionGapMm?: number;
      rowGapMm?: number;
      colGapMm?: number;
   };
   contentBlocks?: Record<string, unknown>;
   [key: string]: unknown;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const SAFE_MARGIN_MM = 5;
const FIDUCIAL_SIZE_MM = 5;
const FIDUCIAL_INSET_MM = SAFE_MARGIN_MM + 1;
const QUESTION_MAX_ROWS_PER_COLUMN = 10;
const QUESTION_MAX_COLUMNS_PER_ROW = 4;
const QUESTION_BLOCK_GAP_MM = 15;
const QUESTION_BLOCK_ROW_GAP_MM = 14;
const QUESTION_PREVIEW_EXTRA_WIDTH_MM = 15;
const QUESTION_PREVIEW_EXTRA_HEIGHT_MM = 5;
const REGISTRATION_PREVIEW_EXTRA_WIDTH_MM = 2;
const REGISTRATION_PREVIEW_EXTRA_HEIGHT_MM = 2;
const QUESTION_DEFAULT_ALTERNATIVES = ['A', 'B', 'C', 'D', 'E'] as const;

function asObject(value: unknown): Record<string, unknown> {
   if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
   }
   return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback: number): number {
   const numeric = Number(value);
   if (!Number.isFinite(numeric)) {
      return fallback;
   }
   return numeric;
}

function asArray(value: unknown): unknown[] {
   return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
   if (typeof value !== 'string') {
      return null;
   }

   const trimmed = value.trim();
   return trimmed.length > 0 ? trimmed : null;
}

function clamp(value: number, min: number, max: number): number {
   return Math.min(Math.max(value, min), max);
}

@Injectable()
export class OmrTemplateRulesService {
   parseLayoutJson(input: string): ParsedLayout {
      try {
         const parsed = JSON.parse(input) as ParsedLayout;

         if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Layout inválido');
         }

         return parsed;
      } catch {
         throw new BadRequestException(
            'layoutJson inválido: JSON mal formatado.',
         );
      }
   }

   resolveQuestionCount(layout: ParsedLayout): number {
      const raw = layout.questionsBlock?.questionCount;
      const questionCount = Number(raw);

      if (!Number.isInteger(questionCount)) {
         throw new BadRequestException(
            'questionsBlock.questionCount é obrigatório e deve ser inteiro.',
         );
      }

      if (
         questionCount < QUESTION_COUNT_MIN ||
         questionCount > QUESTION_COUNT_MAX
      ) {
         throw new BadRequestException(
            `questionCount deve estar entre ${QUESTION_COUNT_MIN} e ${QUESTION_COUNT_MAX}.`,
         );
      }

      if (questionCount % QUESTION_COUNT_STEP !== 0) {
         throw new BadRequestException(
            `questionCount deve ser múltiplo de ${QUESTION_COUNT_STEP}.`,
         );
      }

      return questionCount;
   }

   compileGeometry(layout: ParsedLayout, questionCount: number) {
      const page = asObject(layout.page);
      const pageWidthMm = asNumber(page.widthMm, A4_WIDTH_MM);
      const pageHeightMm = asNumber(page.heightMm, A4_HEIGHT_MM);

      const fixedBlocks = asObject(layout.fixedBlocks);
      const qrBlock = asObject(fixedBlocks.qr);
      const registrationBlock = asObject(fixedBlocks.registration);
      const questionBlock = asObject(layout.questionsBlock);

      const registrationDigits = Math.max(
         1,
         Math.round(asNumber(registrationBlock.digits, 7)),
      );
      const registrationRows = Math.max(
         1,
         Math.round(asNumber(registrationBlock.rows, 10)),
      );
      const registrationColumns = Math.max(
         1,
         Math.round(asNumber(registrationBlock.columns, registrationDigits)),
      );
      const registrationBubbleDiameterMm = asNumber(
         registrationBlock.bubbleDiameterMm,
         4,
      );
      const registrationColGapMm = asNumber(registrationBlock.colGapMm, 8);
      const registrationRowGapMm = asNumber(registrationBlock.rowGapMm, 6);
      const registrationGridWidthMm =
         (registrationColumns - 1) * registrationColGapMm +
         registrationBubbleDiameterMm;
      const registrationGridHeightMm =
         (registrationRows - 1) * registrationRowGapMm +
         registrationBubbleDiameterMm;
      const registrationRenderWidthMm =
         registrationGridWidthMm + REGISTRATION_PREVIEW_EXTRA_WIDTH_MM;
      const registrationRenderHeightMm =
         registrationGridHeightMm + REGISTRATION_PREVIEW_EXTRA_HEIGHT_MM;
      const registrationWidthMm = clamp(
         registrationRenderWidthMm,
         10,
         pageWidthMm - SAFE_MARGIN_MM * 2,
      );
      const registrationHeightMm = clamp(
         registrationRenderHeightMm,
         8,
         pageHeightMm - SAFE_MARGIN_MM * 2,
      );
      const registrationXMm = clamp(
         asNumber(registrationBlock.xMm, 20),
         SAFE_MARGIN_MM,
         Math.max(
            SAFE_MARGIN_MM,
            pageWidthMm - SAFE_MARGIN_MM - registrationWidthMm,
         ),
      );
      const registrationYMm = clamp(
         asNumber(registrationBlock.yMm, 40),
         SAFE_MARGIN_MM,
         Math.max(
            SAFE_MARGIN_MM,
            pageHeightMm - SAFE_MARGIN_MM - registrationHeightMm,
         ),
      );

      const questionAlternatives = asArray(questionBlock.alternatives)
         .map((value) => asString(value))
         .filter((value): value is string => Boolean(value));
      const alternatives =
         questionAlternatives.length > 0
            ? questionAlternatives
            : [...QUESTION_DEFAULT_ALTERNATIVES];
      const questionBubbleDiameterMm = asNumber(
         questionBlock.bubbleDiameterMm,
         4,
      );
      const questionOptionGapMm = asNumber(questionBlock.optionGapMm, 5.7);
      const questionRowGapMm = asNumber(questionBlock.rowGapMm, 6);
      const baseColumns = Math.max(
         1,
         Math.round(
            asNumber(questionBlock.columns, questionCount > 20 ? 2 : 1),
         ),
      );
      const baseRowsPerColumn = Math.max(
         1,
         Math.round(
            asNumber(
               questionBlock.rowsPerColumn,
               Math.ceil(questionCount / baseColumns),
            ),
         ),
      );
      const rowsPerColumn = Math.max(
         1,
         Math.min(baseRowsPerColumn, QUESTION_MAX_ROWS_PER_COLUMN),
      );
      const columns = Math.max(1, Math.ceil(questionCount / rowsPerColumn));
      const columnsPerRow = Math.max(
         1,
         Math.min(columns, QUESTION_MAX_COLUMNS_PER_ROW),
      );
      const blockRows = Math.max(1, Math.ceil(columns / columnsPerRow));
      const optionSpanMm =
         (alternatives.length - 1) * questionOptionGapMm +
         questionBubbleDiameterMm;
      const questionLabelGutterMm = Math.max(questionBubbleDiameterMm * 1.8, 7);
      const questionHeaderBandMm = Math.max(questionBubbleDiameterMm * 1.4, 5);
      const questionColGapMm = optionSpanMm + QUESTION_BLOCK_GAP_MM;
      const questionBlockHeightMm =
         (rowsPerColumn - 1) * questionRowGapMm + questionBubbleDiameterMm;
      const questionBlockWithHeaderHeightMm =
         questionHeaderBandMm + questionBlockHeightMm;
      const questionsRenderWidthMm =
         questionLabelGutterMm +
         optionSpanMm +
         (columnsPerRow - 1) * questionColGapMm +
         QUESTION_PREVIEW_EXTRA_WIDTH_MM;
      const questionsRenderHeightMm =
         blockRows * questionBlockWithHeaderHeightMm +
         (blockRows - 1) * QUESTION_BLOCK_ROW_GAP_MM +
         QUESTION_PREVIEW_EXTRA_HEIGHT_MM;
      const questionsWidthMm = clamp(
         questionsRenderWidthMm,
         10,
         pageWidthMm - SAFE_MARGIN_MM * 2,
      );
      const questionsHeightMm = clamp(
         questionsRenderHeightMm,
         8,
         pageHeightMm - SAFE_MARGIN_MM * 2,
      );
      const questionsXMm = clamp(
         asNumber(questionBlock.xMm, 20),
         SAFE_MARGIN_MM,
         Math.max(
            SAFE_MARGIN_MM,
            pageWidthMm - SAFE_MARGIN_MM - questionsWidthMm,
         ),
      );
      const questionsYMm = clamp(
         asNumber(questionBlock.yMm, 108),
         SAFE_MARGIN_MM,
         Math.max(
            SAFE_MARGIN_MM,
            pageHeightMm - SAFE_MARGIN_MM - questionsHeightMm,
         ),
      );

      const qrSizeMm = clamp(
         asNumber(qrBlock.sizeMm ?? qrBlock.widthMm, 25),
         12,
         Math.min(
            50,
            pageWidthMm - SAFE_MARGIN_MM * 2,
            pageHeightMm - SAFE_MARGIN_MM * 2,
         ),
      );
      const qrXmm = clamp(
         asNumber(qrBlock.xMm, 170),
         SAFE_MARGIN_MM,
         Math.max(SAFE_MARGIN_MM, pageWidthMm - SAFE_MARGIN_MM - qrSizeMm),
      );
      const qrYmm = clamp(
         asNumber(qrBlock.yMm, 24),
         SAFE_MARGIN_MM,
         Math.max(SAFE_MARGIN_MM, pageHeightMm - SAFE_MARGIN_MM - qrSizeMm),
      );

      return {
         page: {
            format: 'A4',
            orientation: 'portrait',
            widthMm: pageWidthMm,
            heightMm: pageHeightMm,
         },
         anchors: [
            {
               id: 0,
               position: 'top_left',
               xMm: FIDUCIAL_INSET_MM,
               yMm: FIDUCIAL_INSET_MM,
               sizeMm: FIDUCIAL_SIZE_MM,
               fixed: true,
            },
            {
               id: 1,
               position: 'top_right',
               xMm: pageWidthMm - FIDUCIAL_INSET_MM - FIDUCIAL_SIZE_MM,
               yMm: FIDUCIAL_INSET_MM,
               sizeMm: FIDUCIAL_SIZE_MM,
               fixed: true,
            },
            {
               id: 2,
               position: 'bottom_right',
               xMm: pageWidthMm - FIDUCIAL_INSET_MM - FIDUCIAL_SIZE_MM,
               yMm: pageHeightMm - FIDUCIAL_INSET_MM - FIDUCIAL_SIZE_MM,
               sizeMm: FIDUCIAL_SIZE_MM,
               fixed: true,
            },
            {
               id: 3,
               position: 'bottom_left',
               xMm: FIDUCIAL_INSET_MM,
               yMm: pageHeightMm - FIDUCIAL_INSET_MM - FIDUCIAL_SIZE_MM,
               sizeMm: FIDUCIAL_SIZE_MM,
               fixed: true,
            },
         ],
         qr: {
            xMm: qrXmm,
            yMm: qrYmm,
            sizeMm: qrSizeMm,
            widthMm: qrSizeMm,
            heightMm: qrSizeMm,
            fixed: false,
            hmacSigned: true,
         },
         registration: {
            type: 'bubble_grid',
            digits: registrationDigits,
            rows: registrationRows,
            columns: registrationColumns,
            xMm: registrationXMm,
            yMm: registrationYMm,
            widthMm: registrationWidthMm,
            heightMm: registrationHeightMm,
            startXmm: registrationXMm + registrationBubbleDiameterMm / 2,
            startYmm: registrationYMm + registrationBubbleDiameterMm / 2,
            bubbleDiameterMm: registrationBubbleDiameterMm,
            colGapMm: registrationColGapMm,
            rowGapMm: registrationRowGapMm,
            markerNudgeMm: 0,
            markerWidthMm: registrationColGapMm,
            markerHeightMm: registrationBubbleDiameterMm + 3.5,
            headerOffsetMm: Math.max(registrationBubbleDiameterMm * 1.5, 6),
            sideOffsetMm: Math.max(registrationBubbleDiameterMm, 4),
            strictOneMarkPerColumn: true,
            fixed: false,
         },
         questions: {
            type: 'bubble_grid',
            questionCount,
            alternatives,
            columns,
            rowsPerColumn,
            maxRowsPerColumn: QUESTION_MAX_ROWS_PER_COLUMN,
            maxColumnsPerRow: QUESTION_MAX_COLUMNS_PER_ROW,
            columnsPerRow,
            blockRows,
            xMm: questionsXMm,
            yMm: questionsYMm,
            widthMm: questionsWidthMm,
            heightMm: questionsHeightMm,
            startXmm:
               questionsXMm +
               questionLabelGutterMm +
               questionBubbleDiameterMm / 2,
            startYmm:
               questionsYMm +
               questionHeaderBandMm +
               questionBubbleDiameterMm / 2,
            colGapMm: questionColGapMm,
            rowGapMm: questionRowGapMm,
            optionGapMm: questionOptionGapMm,
            bubbleDiameterMm: questionBubbleDiameterMm,
            questionBlockGapMm: QUESTION_BLOCK_GAP_MM,
            questionBlockRowGapMm: QUESTION_BLOCK_ROW_GAP_MM,
            questionLabelGutterMm,
            headerBandMm: questionHeaderBandMm,
            questionBlockWithHeaderHeightMm,
         },
         sourceLayout: layout,
      };
   }
}
