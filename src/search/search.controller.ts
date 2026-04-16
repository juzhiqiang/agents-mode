import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) { }

  @Get('test')
  search(@Query('prompt') prompt: string): Promise<string> {
    return this.searchService.search(prompt);
  }

  @Get('test-search')
  async testSearchTool(@Query('q') q?: string) {
    return this.searchService.testSearchTool(q);
  }

  @Get('react')
  async reactSearch(@Query('q') q: string): Promise<string> {
    return this.searchService.reactSearch(q);
  }
}
