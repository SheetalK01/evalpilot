import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { TestCaseResponse } from '@evalpilot/shared';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../types/auth';
import { CreateTestCaseDto, ReorderCasesDto, TestCaseDto, UpdateTestCaseDto } from './test-cases.dto';
import { TestCasesService } from './test-cases.service';

@ApiTags('Test cases')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class TestCasesController {
  constructor(private readonly cases: TestCasesService) {}

  @Get('suites/:suiteId/cases')
  @ApiOperation({ summary: 'All test cases of a suite, in run order' })
  @ApiOkResponse({ type: [TestCaseDto] })
  list(@CurrentUser() user: AuthUser, @Param('suiteId') suiteId: string): Promise<TestCaseResponse[]> {
    return this.cases.list(user.id, suiteId);
  }

  @Post('suites/:suiteId/cases')
  @ApiCreatedResponse({ type: TestCaseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Param('suiteId') suiteId: string,
    @Body() dto: CreateTestCaseDto,
  ): Promise<TestCaseResponse> {
    return this.cases.create(user.id, suiteId, dto);
  }

  @Post('suites/:suiteId/cases/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the run order; `ids` must contain every case exactly once' })
  @ApiOkResponse({ type: [TestCaseDto] })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('suiteId') suiteId: string,
    @Body() dto: ReorderCasesDto,
  ): Promise<TestCaseResponse[]> {
    return this.cases.reorder(user.id, suiteId, dto);
  }

  @Patch('cases/:id')
  @ApiOkResponse({ type: TestCaseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTestCaseDto,
  ): Promise<TestCaseResponse> {
    return this.cases.update(user.id, id, dto);
  }

  @Delete('cases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.cases.remove(user.id, id);
  }
}
