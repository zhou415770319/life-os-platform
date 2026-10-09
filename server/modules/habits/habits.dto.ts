import { IsString, IsNotEmpty, IsOptional, MaxLength, IsInt, Min, Max } from 'class-validator';

export class CreateHabitDtoClass {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  frequency?: string;
}

export class UpdateHabitDtoClass {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  frequency?: string;
}

export class ToggleRecordDtoClass {
  @IsString()
  @IsNotEmpty()
  habitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  date!: string;
}

export class CreateEnergyDtoClass {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  recordDate!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  energyLevel!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  focusLevel!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mood?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
