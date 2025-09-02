import {
   CanActivate,
   ExecutionContext,
   ForbiddenException,
   Injectable,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
   constructor() {}

   async canActivate(context: ExecutionContext): Promise<boolean> {
      const ctx = context.switchToHttp().getRequest();
      const apiKey = ctx.headers['x-api-key'];
      if (!apiKey) throw new ForbiddenException();

      const isValid = true;

      if (!isValid) throw new ForbiddenException();

      return true;
   }
}
