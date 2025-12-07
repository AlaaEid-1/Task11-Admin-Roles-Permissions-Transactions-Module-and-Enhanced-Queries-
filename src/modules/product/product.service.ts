import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProductQuery } from './types/product.types';
import { Prisma } from 'generated/prisma';
import type { CreateProductDTO, UpdateProductDTO } from './types/product.dto';
import { FileService } from '../file/file.service';
import { SideEffectQueue } from 'src/utils/side-effects';

@Injectable()
export class ProductService {
  constructor(
    private prismaService: DatabaseService,
    private fileService: FileService,
  ) {}
  create(
    createProductDto: CreateProductDTO,
    user: Express.Request['user'],
    file?: Express.Multer.File,
  ) {
    const dataPayload: Prisma.ProductUncheckedCreateInput = {
      ...createProductDto,
      merchantId: Number(user!.id),
    };

    if (file) {
      dataPayload.Asset = {
        create: this.fileService.createFileAssetData(file, Number(user!.id)),
      };
    }

    return this.prismaService.product.create({
      data: dataPayload,
      include: { Asset: true },
    });
  }

  findAll(query: ProductQuery) {
    return this.prismaService.$transaction(async (prisma) => {
      // Handle search/where clause
      const whereClause: Prisma.ProductWhereInput = query.name
        ? { name: { contains: query.name }, isDeleted: false }
        : { isDeleted: false };

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

      // Handle field selection
      const select = query.fields
        ? query.fields.reduce(
            (acc, field) => {
              acc[field] = true;
              return acc;
            },
            {} as Record<string, boolean>,
          )
        : undefined;

      const products = await prisma.product.findMany({
        skip,
        take,
        where: whereClause,
        orderBy,
        ...(select && { select }),
        ...(select ? {} : { include: { Asset: true } }),
      });
      const count = await prisma.product.count({
        where: whereClause,
      });
      return {
        data: products,
        ...this.prismaService.formatPaginationResponse({
          page,
          count,
          limit: take,
        }),
      };
    });
  }

  findOne(id: number) {
    return this.prismaService.product.findUnique({
      where: { id },
      include: { Asset: true },
    });
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDTO,
    user: Express.Request['user'],
    file?: Express.Multer.File,
  ) {
    // get instance side effects queue
    const sideEffects = new SideEffectQueue();

    // run prisma transaction { invoke fileservice.deleteFile (prismaTX,productId,user,sideEffect) , prisma update product  }
    const updatedProduct = await this.prismaService.$transaction(
      async (prismaTX) => {
        if (file) {
          await this.fileService.deleteProductAsset(
            prismaTX,
            id,
            Number(user!.id),
            sideEffects,
          );
        }

        const dataPayload: Prisma.ProductUncheckedUpdateInput = {
          ...updateProductDto,
        };
        if (file) {
          dataPayload.Asset = {
            create: this.fileService.createFileAssetData(
              file,
              Number(user!.id),
            ),
          };
        }
        // order is important here
        return await prismaTX.product.update({
          where: { id, merchantId: Number(user!.id) },
          data: dataPayload,
          include: { Asset: true },
        });
      },
    );

    await sideEffects.runAll();
    return updatedProduct;
  }

  remove(id: number, user: Express.Request['user']) {
    return this.prismaService.product.update({
      where: { id, merchantId: Number(user!.id) },
      data: { isDeleted: true },
    });
  }
}
