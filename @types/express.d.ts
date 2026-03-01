import type {
   AuthCurrentUser,
   OAuthAccessContext,
} from '../src/modules/auth/services/auth-context.service';

declare global {
   namespace Express {
      interface Request {
         user?: AuthCurrentUser;
         oauth?: OAuthAccessContext;
      }
   }
}

export {};
