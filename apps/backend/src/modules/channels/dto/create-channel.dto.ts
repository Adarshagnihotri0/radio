import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChannelDto {
  @ApiProperty({ example: 'Alpha Squad' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Downtown operations channel' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ example: '152.350' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  frequency!: string;

  @ApiProperty({ example: 40.7128, description: 'Center latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -74.006, description: 'Center longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 5, description: 'Geo-fence radius in kilometers', default: 5 })
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  radiusKm!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxUsers?: number;
}
