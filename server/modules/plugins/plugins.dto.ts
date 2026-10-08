import { IsBoolean, IsOptional, IsObject, IsString, MaxLength, IsNotEmpty, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import type { PluginCardConfig, PluginLifecycleStatus, PluginRiskLevel } from '@shared/api.interface';

export class UpdatePluginDtoClass {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Partial<PluginCardConfig>;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(['discovered', 'resolving', 'loading', 'active', 'suspended', 'unloaded'])
  lifecycleStatus?: PluginLifecycleStatus;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: PluginRiskLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}

export class InstallPluginDtoClass {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pluginKey!: string;
}
