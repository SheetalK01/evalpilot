import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { CsvImportResultResponse, Paginated, SuiteResponse } from '@evalpilot/shared';
import type { Response } from 'express';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../projects/projects.dto';
import type { AuthUser } from '../types/auth';
import { CreateSuiteDto, CsvImportResultDto, SuiteDto, SuitePageDto, UpdateSuiteDto } from './suites.dto';
import { SuitesService } from './suites.service';

/** Accepts the raw file (`Content-Type: text/csv`) or JSON `{ "csv": "..." }`. */
export function csvTextFrom(body: unknown): string {
  if (typeof body === 'string' && body.length > 0) return body;
  if (typeof body === 'object' && body !== null && typeof (body as { csv?: unknown }).csv === 'string') {
    return (body as { csv: string }).csv;
  }
  throw new BadRequestException('Send the CSV file with Content-Type: text/csv');
}

@ApiTags('Suites')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class SuitesController {
  constructor(private readonly suites: SuitesService) {}

  @Get('projects/:projectId/suites')
  @ApiOkResponse({ type: SuitePageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SuiteResponse>> {
    return this.suites.list(user.id, projectId, query);
  }

  @Post('projects/:projectId/suites')
  @ApiCreatedResponse({ type: SuiteDto })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSuiteDto,
  ): Promise<SuiteResponse> {
    return this.suites.create(user.id, projectId, dto);
  }

  @Get('suites/:id')
  @ApiOkResponse({ type: SuiteDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SuiteResponse> {
    return this.suites.get(user.id, id);
  }

  @Patch('suites/:id')
  @ApiOkResponse({ type: SuiteDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSuiteDto,
  ): Promise<SuiteResponse> {
    return this.suites.update(user.id, id, dto);
  }

  @Delete('suites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.suites.remove(user.id, id);
  }

  @Get('suites/:id/export.csv')
  @ApiOperation({ summary: 'Download the test cases as CSV (columns: name, input, checks, tags)' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file' })
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { fileName, csv } = await this.suites.exportCsv(user.id, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return csv;
  }

  @Post('suites/:id/import')
  @ApiOperation({ summary: 'Append test cases from a CSV file; invalid rows are reported, not imported' })
  @ApiConsumes('text/csv')
  @ApiBody({
    schema: {
      type: 'string',
      example:
        'name,input,checks,tags\nRefund,Can I return it?,"[{""type"":""contains"",""value"":""30 days""}]",smoke',
    },
  })
  @ApiCreatedResponse({ type: CsvImportResultDto })
  importCsv(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CsvImportResultResponse> {
    return this.suites.importCsv(user.id, id, csvTextFrom(body));
  }
}
