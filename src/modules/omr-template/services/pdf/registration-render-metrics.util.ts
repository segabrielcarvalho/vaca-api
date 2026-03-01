type RegistrationRenderInput = {
   digits: number;
   rows: number;
   columns: number;
   colGapMm: number;
   rowGapMm: number;
   bubbleDiameterMm: number;
   startXmm: number;
   startYmm: number;
   markerNudgeMm?: number;
   markerWidthMm?: number;
   markerHeightMm?: number;
   headerOffsetMm?: number;
   sideOffsetMm?: number;
};

export type RegistrationMarkerRect = {
   xMm: number;
   yMm: number;
   widthMm: number;
   heightMm: number;
};

export type RegistrationRowLabel = {
   text: string;
   xMm: number;
   yCenterMm: number;
};

export type RegistrationBubbleCenter = {
   xMm: number;
   yMm: number;
};

export type RegistrationRenderMetrics = {
   markerRects: RegistrationMarkerRect[];
   rowLabels: RegistrationRowLabel[];
   bubbleCenters: RegistrationBubbleCenter[];
   markerWidthMm: number;
   markerHeightMm: number;
   headerOffsetMm: number;
   sideOffsetMm: number;
   markerNudgeMm: number;
   gridLeftMm: number;
   gridTopMm: number;
};

function clampPositiveInteger(value: number, fallback: number): number {
   const parsed = Math.round(Number(value));
   if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
   }
   return parsed;
}

function resolveMarkerWidthMm(
   colGapMm: number,
   markerWidthMm?: number,
): number {
   if (Number.isFinite(markerWidthMm)) {
      return Math.max(1, Number(markerWidthMm));
   }
   return Math.max(1, Number(colGapMm));
}

function resolveMarkerHeightMm(
   bubbleDiameterMm: number,
   markerHeightMm?: number,
): number {
   if (Number.isFinite(markerHeightMm)) {
      return Math.max(1, Number(markerHeightMm));
   }
   return bubbleDiameterMm + 3.5;
}

export function getRegistrationRenderMetrics(
   input: RegistrationRenderInput,
): RegistrationRenderMetrics {
   const rows = clampPositiveInteger(input.rows, 10);
   const columns = clampPositiveInteger(input.columns, 7);
   const digits = clampPositiveInteger(input.digits, columns);
   const bubbleDiameterMm = Math.max(1, Number(input.bubbleDiameterMm));
   const markerNudgeMm = Number.isFinite(input.markerNudgeMm)
      ? Number(input.markerNudgeMm)
      : 0;
   const markerWidthMm = resolveMarkerWidthMm(
      input.colGapMm,
      input.markerWidthMm,
   );
   const markerHeightMm = resolveMarkerHeightMm(
      bubbleDiameterMm,
      input.markerHeightMm,
   );
   const headerOffsetMm = Number.isFinite(input.headerOffsetMm)
      ? Math.max(0, Number(input.headerOffsetMm))
      : Math.max(bubbleDiameterMm * 1.5, 6);
   const sideOffsetMm = Number.isFinite(input.sideOffsetMm)
      ? Math.max(0, Number(input.sideOffsetMm))
      : Math.max(bubbleDiameterMm, 4);

   const gridLeftMm = input.startXmm - bubbleDiameterMm / 2;
   const gridTopMm = input.startYmm - bubbleDiameterMm / 2;
   const baseMarkerHeightMm = bubbleDiameterMm + 1;
   const topLiftMm = Math.max(0, markerHeightMm - baseMarkerHeightMm);

   const markerRects: RegistrationMarkerRect[] = [];
   for (let col = 0; col < digits; col += 1) {
      const markerXmm =
         gridLeftMm +
         col * input.colGapMm +
         (bubbleDiameterMm - markerWidthMm) / 2 -
         markerNudgeMm;
      markerRects.push({
         xMm: markerXmm,
         yMm: gridTopMm - headerOffsetMm - topLiftMm,
         widthMm: markerWidthMm,
         heightMm: markerHeightMm,
      });
   }

   const rowLabels: RegistrationRowLabel[] = [];
   for (let row = 0; row < rows; row += 1) {
      rowLabels.push({
         text: String(row),
         xMm: gridLeftMm - sideOffsetMm,
         yCenterMm: input.startYmm + row * input.rowGapMm,
      });
   }

   const bubbleCenters: RegistrationBubbleCenter[] = [];
   for (let col = 0; col < columns; col += 1) {
      for (let row = 0; row < rows; row += 1) {
         bubbleCenters.push({
            xMm: input.startXmm + col * input.colGapMm,
            yMm: input.startYmm + row * input.rowGapMm,
         });
      }
   }

   return {
      markerRects,
      rowLabels,
      bubbleCenters,
      markerWidthMm,
      markerHeightMm,
      headerOffsetMm,
      sideOffsetMm,
      markerNudgeMm,
      gridLeftMm,
      gridTopMm,
   };
}
