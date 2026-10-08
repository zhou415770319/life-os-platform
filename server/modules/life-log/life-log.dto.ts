import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateLifeLogDtoClass {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  eventCategory!: string;

  @IsString()
  @IsNotEmpty()
  contentSummary!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
