import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
   @Get()
   healthCheck(): { status: string; timestamp: string } {
      return {
         status: 'ok',
         timestamp: new Date().toISOString(),
      };
   }
}
