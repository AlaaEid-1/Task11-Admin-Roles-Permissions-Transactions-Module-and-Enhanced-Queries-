import { TransactionType, PaymentMethod } from 'generated/prisma';
import { Decimal } from 'generated/prisma/runtime/library';

export class TransactionResponseDTO {
  id?: bigint;
  amount?: Decimal;
  userId?: bigint;
  orderId?: bigint;
  orderReturnId?: bigint | null;
  type?: TransactionType;
  paymentMethod?: PaymentMethod;
  createdAt?: Date;
}

export class TransactionOverviewDTO {
  id?: bigint;
  amount?: Decimal;
  type?: TransactionType;
  paymentMethod?: PaymentMethod;
  orderId?: bigint;
  createdAt?: Date;
}
