import { Module } from '@nestjs/common';
import { PlaneController } from './plansolve.controller';
import { PlaneService } from './plansolve.service';

@Module({
  imports: [
  ],
  controllers: [PlaneController],
  providers: [PlaneService],
})

export class PlanSolveModule { }
