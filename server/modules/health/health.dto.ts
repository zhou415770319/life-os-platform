import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  HealthRecordType,
  HealthMetrics,
} from '@shared/api.interface';

export class CreateHealthRecordDtoClass {
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @IsIn(['body', 'exercise', 'sleep'])
  recordType!: HealthRecordType;

  @IsString()
  @IsNotEmpty()
  recordDate!: string;

  @IsOptional()
  @IsObject()
  metrics?: HealthMetrics;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateHealthRecordDtoClass {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(['body', 'exercise', 'sleep'])
  recordType?: HealthRecordType;

  @IsOptional()
  @IsString()
  recordDate?: string;

  @IsOptional()
  @IsObject()
  metrics?: HealthMetrics;

  @IsOptional()
  @IsString()
  note?: string;
}
