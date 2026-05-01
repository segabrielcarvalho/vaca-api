import { getRegistrationRenderMetrics } from '../../pdf/registration-render-metrics.util';

describe('registration-render-metrics.util', () => {
   it('resolve marcadores, labels e bolhas a partir da origem visual do editor', () => {
      const metrics = getRegistrationRenderMetrics({
         digits: 7,
         rows: 10,
         columns: 7,
         colGapMm: 8,
         rowGapMm: 6,
         bubbleDiameterMm: 4,
         startXmm: 22,
         startYmm: 104,
         markerNudgeMm: 0,
         markerWidthMm: 8,
         markerHeightMm: 7.5,
         headerOffsetMm: 6,
         sideOffsetMm: 4,
      });

      expect(metrics.gridLeftMm).toBeCloseTo(20, 3);
      expect(metrics.gridTopMm).toBeCloseTo(102, 3);
      expect(metrics.markerRects[0]).toEqual({
         xMm: 18,
         yMm: 93.5,
         widthMm: 8,
         heightMm: 7.5,
      });
      expect(metrics.rowLabels[9]).toEqual({
         text: '9',
         xMm: 16,
         yCenterMm: 158,
      });
      expect(metrics.bubbleCenters[metrics.bubbleCenters.length - 1]).toEqual({
         xMm: 70,
         yMm: 158,
      });
   });
});
