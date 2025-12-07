import { Injectable } from '@nestjs/common';
import { RegisterDTO, UserResponseDTO } from '../auth/dto/auth.dto';
import { DatabaseService } from '../database/database.service';
import { User } from 'generated/prisma';
import { removeFields } from 'src/utils/object.util';
import { PaginatedResult, PaginationQueryType } from 'src/types/util.types';
import { UpdateUserDTO } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prismaService: DatabaseService) {}
  create(registerDTO: RegisterDTO) {
    return this.prismaService.user.create({
      data: registerDTO,
    });
  }

  findAll(
    query: PaginationQueryType,
  ): Promise<PaginatedResult<Omit<User, 'password'>>> {
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

      // Handle field selection
      const select = query.fields
        ? query.fields.reduce(
            (acc, field) => {
              if (field !== 'password') {
                acc[field] = true;
              }
              return acc;
            },
            {} as Record<string, boolean>,
          )
        : undefined;

      const users = await prisma.user.findMany({
        skip,
        take,
        orderBy,
        ...(select && { select }),
        ...(select ? {} : { omit: { password: true } }),
      });
      const count = await prisma.user.count();
      return {
        data: users,
        ...this.prismaService.formatPaginationResponse({
          page,
          count,
          limit: take,
        }),
      };
    });
  }
  findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: { email },
    });
  }

  findOne(id: bigint) {
    return this.prismaService.user.findUnique({
      where: { id },
      omit: { password: true },
    });
  }

  update(id: bigint, userUpdatePayload: UpdateUserDTO) {
    return this.prismaService.user.update({
      where: { id },
      data: userUpdatePayload,
      omit: { password: true },
    });
  }

  remove(id: bigint) {
    return this.prismaService.user.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  mapUserWithoutPasswordAndCastBigint(user: User): UserResponseDTO['user'] {
    const userWithoutPassword = removeFields(user, ['password']);
    return {
      ...userWithoutPassword,
      id: String(userWithoutPassword.id),
    };
  }
}
