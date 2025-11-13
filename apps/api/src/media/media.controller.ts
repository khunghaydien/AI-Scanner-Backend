import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@app/auth';
import { ResponseDto } from '@app/common';
import { MediaService, UpdateFileDto, UploadFileDto } from '@app/media';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Request() req: any,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
  ) {
    const userId = req.user.id;
    const result = await this.mediaService.uploadFile(userId, file, uploadDto);
    return ResponseDto.created(result, 'File uploaded successfully');
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserFiles(@Request() req: any) {
    const userId = req.user.id;
    const files = await this.mediaService.getUserFiles(userId);
    return ResponseDto.success(files, 'Files retrieved successfully');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getFileById(@Request() req: any, @Param('id') fileId: string) {
    const userId = req.user.id;
    const file = await this.mediaService.getFileById(fileId, userId);
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
    const result = await this.mediaService.updateFile(fileId, userId, updateDto);
    return ResponseDto.success(result, 'File updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Request() req: any, @Param('id') fileId: string) {
    const userId = req.user.id;
    await this.mediaService.deleteFile(fileId, userId);
    return ResponseDto.success({}, 'File deleted successfully');
  }

  @Post('scanner')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndScanFile(
    @Request() req: any,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
  ) {
    const userId = req.user.id;
    const result = await this.mediaService.uploadFileScanner(
      userId,
      file,
      uploadDto,
    );
    return ResponseDto.created(
      result,
      'File uploaded and scanned successfully',
    );
  }

  @Post('extract-background')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async extractDocumentFromBackground(
    @Request() req: any,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
  ) {
    const userId = req.user.id;
    const result = await this.mediaService.extractDocumentFromBackground(
      userId,
      file,
      uploadDto,
    );
    return ResponseDto.created(
      result,
      'Document extracted from background successfully',
    );
  }
}
