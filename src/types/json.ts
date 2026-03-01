import { Prisma } from '../../.prisma/client';

export type JsonValue = Prisma.JsonValue;
export type JsonObject = Prisma.JsonObject;
export type JsonRecord = Record<string, JsonValue>;
