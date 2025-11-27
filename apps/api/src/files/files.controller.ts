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
import { FilesService, UpdateFileDto, DeleteFilesDto, GetFilesDto, MergeFilesDto } from '@app/files';

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

  @Post('merge')
  @HttpCode(HttpStatus.CREATED)
  async mergeFiles(@Request() req: any, @Body() mergeDto: MergeFilesDto) {
    const userId = req.user.id;
    const mergedFile = await this.filesService.mergeFiles(mergeDto, userId);
    return ResponseDto.created(
      mergedFile,
      `Successfully merged ${mergeDto.fileIds.length} file(s) into one file`,
    );
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
    await this.filesService.deleteFiles(deleteDto, userId);
    return ResponseDto.success(
      {},
      `Successfully deleted ${deleteDto.fileIds.length} file(s)`,
    );
  }

  @Post(':id/to-pdf')
  @HttpCode(HttpStatus.OK)
  async convertToPdf(@Request() req: any, @Param('id') fileId: string) {
    const userId = req.user.id;
    const pdfUrl = await this.filesService.convertToPdf(fileId, userId);
    return ResponseDto.success(
      { pdfUrl },
      'Successfully converted images to PDF',
    );
  }

  @Post(':id/to-scan')
  @HttpCode(HttpStatus.OK)
  async convertToScan(@Request() req: any, @Param('id') fileId: string) {
    const userId = req.user.id;
    const pdfUrl = await this.filesService.convertToScan(fileId, userId);
    return ResponseDto.success(
      { pdfUrl },
      'Successfully converted images to scanned PDF',
    );
  }

  @Post(':id/images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 50)) // Max 50 files per request
  async addImagesToFile(
    @Request() req: any,
    @Param('id') fileId: string,
    @UploadedFiles(new ParseFilePipe({ fileIsRequired: true }))
    files: Express.Multer.File[],
  ) {
    const userId = req.user.id;
    const result = await this.filesService.addImagesToFile(fileId, userId, files);
    return ResponseDto.success(
      result,
      `Successfully added ${files.length} image(s) to file`,
    );
  }
}

