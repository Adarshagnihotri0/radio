import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatar?: string;
}
