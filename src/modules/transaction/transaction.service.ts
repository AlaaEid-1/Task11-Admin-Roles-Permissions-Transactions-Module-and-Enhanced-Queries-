import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaginatedResult } from 'src/types/util.types';
import type { TransactionQueryType } from './util/transaction.validation.schema';
import {
  TransactionOverviewDTO,
  TransactionResponseDTO,
} from './dto/transaction.dto';

@Injectable()
export class TransactionService {
  constructor(private prismaService: DatabaseService) {}

  async findAll(
    userId: bigint,
    query: TransactionQueryType,
  ): Promise<PaginatedResult<TransactionOverviewDTO>> {
    return this.prismaService.$transaction(async (prisma) => {
      const skip = (query.page - 1) * query.limit;

      const orderBy: Record<string, 'asc' | 'desc'> = {};
      if (query.sortBy) {
        orderBy[query.sortBy] = query.sortOrder || 'desc';
      } else {
        orderBy.createdAt = 'desc';
      }

      const where: Record<string, unknown> = {
        userId,
      };

      if (query.type) {
        where.type = query.type;
      }

      const transactions = await prisma.userTransaction.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
        select: {
          id: true,
          amount: true,
          type: true,
          paymentMethod: true,
          orderId: true,
          createdAt: true,
        },
      });

      const total = await prisma.userTransaction.count({
        where,
      });

      return {
        data: transactions as unknown as TransactionOverviewDTO[],
        ...this.prismaService.formatPaginationResponse({
          page: query.page,
          count: total,
          limit: query.limit,
        }),
      };
    });
  }

  async findOne(
    transactionId: bigint,
    userId: bigint,
  ): Promise<TransactionResponseDTO> {
    return (await this.prismaService.userTransaction.findUniqueOrThrow({
      where: {
        id: transactionId,
        userId,
      },
    })) as unknown as TransactionResponseDTO;
  }

  async findByOrder(orderId: bigint, userId: bigint) {
    return await this.prismaService.userTransaction.findMany({
      where: {
        orderId,
        userId,
      },
    });
  }
}
