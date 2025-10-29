import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

type StoredState = {
   redirect?: string;
   expiresAt: number;
};

@Injectable()
export class GoogleStateService {
   private readonly logger = new Logger(GoogleStateService.name);
   private readonly ttlMs = 5 * 60 * 1000;
   private readonly states = new Map<string, StoredState>();

   issueState(redirect?: string): string {
      this.pruneExpired();
      const state = randomBytes(16).toString('hex');
      this.states.set(state, {
         redirect,
         expiresAt: Date.now() + this.ttlMs,
      });
      return state;
   }

   consumeState(state: string | undefined) {
      if (!state) return null;
      const stored = this.states.get(state);
      if (!stored) {
         this.logger.debug(`Estado não encontrado ou já consumido: ${state}`);
         return null;
      }
      this.states.delete(state);
      if (stored.expiresAt < Date.now()) {
         this.logger.debug(`Estado expirado descartado: ${state}`);
         return null;
      }
      return stored;
   }

   private pruneExpired() {
      const now = Date.now();
      for (const [state, data] of this.states.entries()) {
         if (data.expiresAt < now) {
            this.states.delete(state);
         }
      }
   }
}
