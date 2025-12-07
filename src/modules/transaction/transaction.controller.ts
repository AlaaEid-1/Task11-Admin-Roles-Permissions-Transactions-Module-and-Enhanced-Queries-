import { Controller, Get, Query, Param, Req } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { Roles } from 'src/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import type { PaginatedResult } from 'src/types/util.types';
import {
  TransactionOverviewDTO,
  TransactionResponseDTO,
} from './dto/transaction.dto';
import {
  transactionQuerySchema,
  type TransactionQueryType,
} from './util/transaction.validation.schema';

@Controller('transaction')
@Roles(['CUSTOMER'])
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  findAll(
    @Req() request: Express.Request,
    @Query(new ZodValidationPipe(transactionQuerySchema))
    query: TransactionQueryType,
  ): Promise<PaginatedResult<TransactionOverviewDTO>> {
    return this.transactionService.findAll(BigInt(request.user!.id), query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: Express.Request,
  ): Promise<TransactionResponseDTO> {
    return this.transactionService.findOne(
      BigInt(id),
      BigInt(request.user!.id),
    );
  }
}
