import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SUPPORTED_ARUCO_IDS = new Set([0, 1, 2, 3]);

const ARUCO_ASSETS_RELATIVE_PATH = [
   'modules',
   'omr-template',
   'services',
   'pdf',
   'assets',
   'aruco',
   'dict_4x4_50',
] as const;

function resolveArucoAssetsBasePath(): string {
   const candidates = [
      join(__dirname, 'assets', 'aruco', 'dict_4x4_50'),
      join(process.cwd(), 'src', ...ARUCO_ASSETS_RELATIVE_PATH),
      join(process.cwd(), 'dist', 'src', ...ARUCO_ASSETS_RELATIVE_PATH),
      join(process.cwd(), 'dist', ...ARUCO_ASSETS_RELATIVE_PATH),
   ];

   return (
      candidates.find((candidatePath) => existsSync(candidatePath)) ??
      candidates[0]
   );
}

const ARUCO_ASSETS_BASE_PATH = resolveArucoAssetsBasePath();

const markerBufferCache = new Map<number, Buffer | null>();

function resolveMarkerPath(markerId: number): string {
   return join(ARUCO_ASSETS_BASE_PATH, `id-${markerId}.png`);
}

export function getArucoMarkerPngById(markerId: number): Buffer | null {
   if (!Number.isInteger(markerId) || !SUPPORTED_ARUCO_IDS.has(markerId)) {
      return null;
   }

   if (markerBufferCache.has(markerId)) {
      return markerBufferCache.get(markerId) ?? null;
   }

   try {
      const markerBuffer = readFileSync(resolveMarkerPath(markerId));
      markerBufferCache.set(markerId, markerBuffer);
      return markerBuffer;
   } catch {
      markerBufferCache.set(markerId, null);
      return null;
   }
}
