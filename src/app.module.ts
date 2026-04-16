import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from './search/search.module';
import { PlanSolveModule } from './planSolve/plansolve.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，不需要在每个 Module 重复 import
    }),
    SearchModule,
    PlanSolveModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
