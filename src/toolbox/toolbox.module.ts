import { Module } from '@nestjs/common';
import { ToolExecutorService } from './toolExecutor.service';

@Module({
    providers: [ToolExecutorService],
    exports: [ToolExecutorService],
})

export class ToolboxModule { }
