import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { NearbyChannelsDto } from './dto/nearby-channels.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('channels')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new geo-fenced channel' })
  @ApiResponse({ status: 201, description: 'Channel created' })
  async create(@Body() dto: CreateChannelDto, @Request() req: AuthenticatedRequest) {
    return this.channelsService.create(dto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all active channels (paginated)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.channelsService.findAll(pagination);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find channels within radius of coordinates' })
  async findNearby(@Query() dto: NearbyChannelsDto) {
    return this.channelsService.findNearby(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  async findOne(@Param('id') id: string) {
    return this.channelsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update channel' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.channelsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (deactivate) channel' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.channelsService.remove(id, req.user.sub);
  }
}
