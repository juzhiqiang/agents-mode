import { Controller, Get, Query } from '@nestjs/common';
import { PlaneService } from './plansolve.service';

@Controller("plane")
export class PlaneController {
  constructor(private readonly planeService: PlaneService) { }

  @Get('test')
  search(@Query('prompt') prompt: string): Promise<string | null> {
    return this.planeService.run(prompt);
  }

}
