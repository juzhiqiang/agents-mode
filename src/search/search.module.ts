import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ToolboxModule } from 'src/toolbox/toolbox.module';

@Module({
  imports: [
    ToolboxModule
  ],
  controllers: [SearchController],
  providers: [SearchService],
})

export class SearchModule { }
