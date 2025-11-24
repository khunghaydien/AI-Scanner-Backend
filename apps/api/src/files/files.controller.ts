import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@app/auth';
import { ResponseDto } from '@app/common';
import { FilesService, UpdateFileDto, DeleteFilesDto, GetFilesDto } from '@app/files';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 50)) // Max 50 files per request
  async uploadFiles(
    @Request() req: any,
    @UploadedFiles(new ParseFilePipe({ fileIsRequired: true }))
    files: Express.Multer.File[],
  ) {
    const userId = req.user.id;
    const result = await this.filesService.uploadFiles(userId, files);
    return ResponseDto.created(
      result,
      `Successfully uploaded ${result.length} file(s)`,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserFiles(@Request() req: any, @Query() query: GetFilesDto) {
    const userId = req.user.id;
    const result = await this.filesService.getUserFiles(userId, query);
    return ResponseDto.success(
      {
        files: result.files,
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      },
      'Files retrieved successfully',
    );
  }

  @Get('total')
  @HttpCode(HttpStatus.OK)
  async getTotalFilesCount(@Request() req: any) {
    const userId = req.user.id;
    const totalCount = await this.filesService.getTotalFilesCount(userId);
    return ResponseDto.success(totalCount, 'Total files count retrieved successfully');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getFileById(@Request() req: any, @Param('id') fileId: string) {
    const userId = req.user.id;
    const file = await this.filesService.getFileById(fileId, userId);
    return ResponseDto.success(file, 'File retrieved successfully');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateFile(
    @Request() req: any,
    @Param('id') fileId: string,
    @Body() updateDto: UpdateFileDto,
  ) {
    const userId = req.user.id;
    const result = await this.filesService.updateFile(fileId, userId, updateDto);
    return ResponseDto.success(result, 'File updated successfully');
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteFiles(
    @Request() req: any,
    @Body() deleteDto: DeleteFilesDto,
  ) {
    const userId = req.user.id;
    await this.filesService.deleteFiles(deleteDto.fileIds, userId);
    return ResponseDto.success(
      {},
      `Successfully deleted ${deleteDto.fileIds.length} file(s)`,
    );
  }
}

