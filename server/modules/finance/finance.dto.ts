import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

const ACCOUNT_TYPES = ['cash', 'bank', 'credit_card', 'investment', 'other'] as const;
const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
const BUDGET_PERIODS = ['monthly', 'weekly', 'yearly'] as const;

// ===== Account DTOs =====

export class CreateAccountDtoClass {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => String)
  @IsString()
  @IsIn(ACCOUNT_TYPES)
  type!: typeof ACCOUNT_TYPES[number];

  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class UpdateAccountDtoClass {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(ACCOUNT_TYPES)
  type?: typeof ACCOUNT_TYPES[number];

  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

// ===== Transaction DTOs =====

export class CreateTransactionDtoClass {
  @Type(() => String)
  @IsString()
  @IsIn(TRANSACTION_TYPES)
  type!: typeof TRANSACTION_TYPES[number];

  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  targetAccountId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

export class UpdateTransactionDtoClass {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(TRANSACTION_TYPES)
  type?: typeof TRANSACTION_TYPES[number];

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  targetAccountId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

// ===== Budget DTOs =====

export class CreateBudgetDtoClass {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsNumber()
  amount!: number;

  @Type(() => String)
  @IsString()
  @IsIn(BUDGET_PERIODS)
  period!: typeof BUDGET_PERIODS[number];

  @IsString()
  @IsNotEmpty()
  periodKey!: string;
}

export class UpdateBudgetDtoClass {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(BUDGET_PERIODS)
  period?: typeof BUDGET_PERIODS[number];

  @IsOptional()
  @IsString()
  periodKey?: string;
}
