import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CreateOrderDTO,
  CreateOrderReturnDTO,
  OrderOverviewResponseDTO,
} from './types/order.dto';
import { DatabaseService } from '../database/database.service';
import { MoneyUtil } from 'src/utils/money.util';
import { Prisma, Product } from 'generated/prisma';
import { Decimal } from 'generated/prisma/runtime/library';
import { PaginatedResult, PaginationQueryType } from 'src/types/util.types';

@Injectable()
export class OrderService {
  constructor(private readonly prismaService: DatabaseService) {}
  async create(createOrderDto: CreateOrderDTO, userId: number | bigint) {
    // MISSING order total
    // missing product price

    const productIds = createOrderDto.map((item) => item.productId);
    // get products
    const products = await this.prismaService.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        isDeleted: false,
      },
    });
    // validate all products exist like dto product ids
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid');
    }

    const orderProductsData = this.mapProductDtoToOrderProducts(
      createOrderDto,
      products,
    );

    const orderTotalPrice = MoneyUtil.calculateTotalAmount(
      orderProductsData.map((orderPrdouct) => ({
        price: orderPrdouct.pricePerItem as Decimal,
        quantity: orderPrdouct.totalQty,
      })),
    );

    // create order included created data (transaction , product)
    const createdOrder = await this.prismaService.order.create({
      data: {
        orderProducts: {
          createMany: { data: orderProductsData },
        },
        transactions: {
          create: { amount: orderTotalPrice, type: 'DEBIT', userId },
        },
        userId: BigInt(userId),
        orderStatus: 'PENDING',
      },
      include: {
        orderProducts: { include: { product: true } },
        transactions: true,
        orderReturns: {
          include: { returnedItems: { include: { product: true } } },
        },
      },
    });

    return createdOrder;
  }

  findAll(
    userId: bigint,
    query: PaginationQueryType,
  ): Promise<PaginatedResult<OrderOverviewResponseDTO>> {
    return this.prismaService.$transaction(async (prisma) => {
      // Handle pagination
      const skip = (Number(query.page ?? 1) - 1) * Number(query.limit ?? 10);
      const take = Number(query.limit ?? 10);
      const page = Number(query.page ?? 1);

      // Handle sorting - improve from 'newest' only
      const orderBy: Record<string, 'asc' | 'desc'> = {};
      if (query.sort === 'newest') {
        orderBy.createdAt = 'desc';
      } else {
        orderBy.createdAt = 'desc'; // default to newest
      }

      const orders = await prisma.order.findMany({
        skip,
        take,
        where: { userId },
        orderBy,
        include: {
          orderProducts: true,
          orderReturns: true,
          transactions: true,
        },
      });

      const count = await prisma.order.count({ where: { userId } });
      return {
        data: orders as unknown as OrderOverviewResponseDTO[],
        ...this.prismaService.formatPaginationResponse({
          page,
          count,
          limit: take,
        }),
      };
    });
  }

  findOne(id: number, userId: bigint) {
    return this.prismaService.order.findUniqueOrThrow({
      where: { id, userId },
      include: {
        orderProducts: { include: { product: true } },
        transactions: true,
        orderReturns: {
          include: { returnedItems: { include: { product: true } } },
        },
      },
    });
  }

  // update(id: number, updateOrderDto: UpdateOrderDto) {
  //   return `This action updates a #${id} order`;
  // }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  // helper methods

  private mapProductDtoToOrderProducts(
    createOrderDTO: CreateOrderDTO,
    products: Product[],
  ): Prisma.OrderProductCreateManyOrderInput[] {
    return createOrderDTO.map((item) => {
      const product = products.find(
        (p) => BigInt(p.id) === BigInt(item.productId),
      )!;
      return {
        productId: product.id,
        totalQty: item.qty,
        pricePerItem: product.price,
      };
    });
  }

  // returns logic

  async createReturn(createReturnDto: CreateOrderReturnDTO, userId: bigint) {
    const returnedProductsIdsInDTO = createReturnDto.items.map(
      (item) => item.productId,
    );
    await this.prismaService.$transaction(async (prismaTX) => {
      // is order belong to same user

      await prismaTX.order.findUniqueOrThrow({
        where: {
          userId,
          id: createReturnDto.orderId,
        },
      });
      // validate returns product ids already included in order && return qty is witin capacity total qty
      const existingOrderProducts = await prismaTX.orderProduct.findMany({
        where: {
          orderId: createReturnDto.orderId,
          productId: {
            in: returnedProductsIdsInDTO,
          },
        },
      });
      if (returnedProductsIdsInDTO.length !== existingOrderProducts.length) {
        throw new BadRequestException('Invalid return products');
      }
      // create return ({ returenditems:[createm]})

      await prismaTX.orderReturn.create({
        data: {
          orderId: BigInt(createReturnDto.orderId),
          returnedItems: {
            createMany: { data: createReturnDto.items },
          },
        },
      });
      // order_product - decrement qty

      for (const item of createReturnDto.items) {
        await prismaTX.orderProduct.update({
          where: {
            orderId_productId: {
              orderId: createReturnDto.orderId,
              productId: item.productId,
            },
          },
          data: {
            totalQty: {
              increment: -item.qty,
            },
          },
        });
      }
    });

    return this.findOne(createReturnDto.orderId, userId);
  }

  // admin actions
  updateOrderStatus(orderId: number, status: 'PENDING' | 'SUCCESS') {
    return this.prismaService.order.update({
      where: { id: orderId },
      data: { orderStatus: status },
    });
  }

  updateReturnStatus(
    returnId: number,
    status: 'PENDING' | 'PICKED' | 'REFUND',
  ) {
    return this.prismaService.orderReturn.update({
      where: { id: returnId },
      data: { status },
    });
  }
}
