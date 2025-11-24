import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { File } from '@app/database/entities/file.entity';
import { User } from '@app/database/entities/user.entity';
import { UploadFileDto, UpdateFileDto, DeleteFilesDto, GetFilesDto } from './dto';

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly r2Endpoint: string;
  private readonly r2PublicUrl: string;
  private readonly r2Region: string;

  // Allowed file types: images, documents, PDFs, Excel files
  private readonly allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    // Documents
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    // PDF
    'application/pdf',
    // Text files
    'text/plain',
    'text/csv',
  ];

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    // Initialize Cloudflare R2 S3 Client
    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.r2Endpoint = process.env.R2_ENDPOINT_URL || '';
    this.r2PublicUrl = process.env.R2_PUBLIC_URL || '';
    this.r2Region = process.env.R2_REGION || '';

    // Validate R2 credentials
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      console.error('❌ R2 Credentials Error:');
      console.error('   R2_ACCESS_KEY_ID:', accessKeyId ? 'Set' : '❌ NOT SET');
      console.error('   R2_SECRET_ACCESS_KEY:', secretAccessKey ? 'Set' : '❌ NOT SET');
      console.error('💡 Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables');
      throw new Error(
        'R2 credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables.',
      );
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.r2Endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    console.log('✅ Cloudflare R2 Client initialized');
    console.log(`   Bucket: ${this.bucketName}`);
    console.log(`   Endpoint: ${this.r2Endpoint}`);
  }

  /**
   * Get file type from MIME type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType === 'application/pdf') {
      return 'pdf';
    }
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType === 'text/csv'
    ) {
      return 'excel';
    }
    if (
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType === 'text/plain'
    ) {
      return 'document';
    }
    return 'other';
  }

  /**
   * Upload single or multiple files to Cloudflare R2 and save to database
   */
  async uploadFiles(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<File[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate file types
    for (const file of files) {
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.originalname}. Allowed types: images, documents, PDFs, Excel files.`,
        );
      }
    }

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const uploadedFiles: File[] = [];

      // Upload each file
      for (const file of files) {
        // Generate unique file name
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${userId}-${timestamp}-${randomString}.${fileExtension}`;

        // Upload to Cloudflare R2
        const uploadCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000',
        });

        await this.s3Client.send(uploadCommand);

        // Get file type
        const fileType = this.getFileType(file.mimetype);

        // Save to database with full public URL
        const fileEntity = this.fileRepository.create({
          user: user,
          fileUrl: `${this.r2Region}/${fileName}`,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType,
          status: 'active',
        });

        const savedFile = await this.fileRepository.save(fileEntity);
        uploadedFiles.push(savedFile);
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error uploading files to R2:', error);
      throw new BadRequestException('Failed to upload files');
    }
  }

  /**
   * Get files for a user with cursor-based pagination
   * Uses updatedAt (DESC) and id (DESC) as sort keys with index
   */
  async getUserFiles(
    userId: string,
    getFilesDto: GetFilesDto = {},
  ): Promise<{ files: File[]; nextCursor: string | null }> {
    const limit = getFilesDto.limit || 20;
    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .where('file.user_id = :userId', { userId })
      .andWhere('file.status = :status', { status: 'active' })
      .orderBy('file.updated_at', 'DESC')
      .addOrderBy('file.id', 'DESC')
      .limit(limit + 1); // Fetch one extra to check if there's more

    // Apply cursor if provided
    if (getFilesDto.cursor) {
      try {
        const decoded = Buffer.from(getFilesDto.cursor, 'base64').toString('utf-8');
        const [updatedAt, id] = decoded.split('_');
        if (updatedAt && id) {
          queryBuilder.andWhere(
            '(file.updated_at < :updatedAt OR (file.updated_at = :updatedAt AND file.id < :id))',
            {
              updatedAt: parseInt(updatedAt, 10),
              id,
            },
          );
        }
      } catch (error) {
        // Invalid cursor, ignore it
        console.warn('Invalid cursor provided:', error);
      }
    }

    const files = await queryBuilder.getMany();

    // Check if there's a next page
    const hasMore = files.length > limit;
    const resultFiles = hasMore ? files.slice(0, limit) : files;

    // Generate next cursor from the last item
    let nextCursor: string | null = null;
    if (hasMore && resultFiles.length > 0) {
      const lastFile = resultFiles[resultFiles.length - 1];
      const cursorData = `${lastFile.updatedAt}_${lastFile.id}`;
      nextCursor = Buffer.from(cursorData).toString('base64');
    }

    return {
      files: resultFiles,
      nextCursor,
    };
  }

  async getTotalFilesCount(userId: string): Promise<number> {
    return await this.fileRepository.count({ where: { user: { id: userId }, status: 'active' } });
  }

  /**
   * Get single file by ID
   */
  async getFileById(fileId: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, user: { id: userId } },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    userId: string,
    updateDto: UpdateFileDto,
  ): Promise<File> {
    const file = await this.getFileById(fileId, userId);

    if (updateDto.status !== undefined) {
      file.status = updateDto.status;
    }

    return await this.fileRepository.save(file);
  }

  /**
   * Delete multiple files (hard delete - permanent delete)
   */
  async deleteFiles(fileIds: string[], userId: string): Promise<void> {
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException('No file IDs provided');
    }

    // Get all files that belong to the user
    const files = await this.fileRepository.find({
      where: {
        id: In(fileIds),
        user: { id: userId },
      },
    });

    if (files.length === 0) {
      throw new NotFoundException('No files found to delete');
    }

    // Verify all requested files were found
    const foundIds = files.map((f) => f.id);
    const notFoundIds = fileIds.filter((id) => !foundIds.includes(id));
    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Files not found: ${notFoundIds.join(', ')}`,
      );
    }

    try {
      // Delete from Cloudflare R2
      for (const file of files) {
        // Extract file key from public URL
        const fileKey = file.fileUrl.split('/')[file.fileUrl.split('/').length - 1];
        console.log('🗑️  Deleting file from R2:', fileKey);

        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
          });

          await this.s3Client.send(deleteCommand);
          console.log('✅ File deleted from R2:', fileKey);
        } catch (error) {
          console.error(`❌ Error deleting file ${fileKey} from R2:`, error);
          // Continue with other files even if one fails
        }
      }

      // Hard delete from database
      await this.fileRepository.remove(files);
      console.log(`✅ ${files.length} file(s) deleted from database`);
    } catch (error) {
      console.error('❌ Error deleting files:', error);
      throw new BadRequestException(
        'Failed to delete files: ' + (error.message || 'Unknown error'),
      );
    }
  }
}

