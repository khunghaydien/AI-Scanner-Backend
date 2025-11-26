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
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { File } from '@app/database/entities/file.entity';
import { User } from '@app/database/entities/user.entity';
import { UpdateFileDto, DeleteFilesDto, GetFilesDto, MergeFilesDto } from './dto';

const execAsync = promisify(exec);

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly r2Endpoint: string;
  private readonly r2Region: string;

  // Allowed file types: images only
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
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
    this.r2Region = process.env.R2_REGION || '';

    // Validate R2 credentials
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
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
      maxAttempts: 3,
    });
  }

  /**
   * Upload multiple files to Cloudflare R2 and save a single record with:
   * - fileUrls: all uploaded file URLs (JSONB array)
   * - fileName: original name of the first file
   * - thumbnailUrl: URL of the first file
   */
  async uploadFiles(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<File[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate file types - only images allowed
    for (const file of files) {
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.originalname}. Only image files are allowed (JPEG, PNG, GIF, WebP, BMP, SVG).`,
        );
      }
    }

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const uploadPromises = files.map((file, index) => {
        return (async () => {
          try {
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileExtension = file.originalname.split('.').pop();
            const storedFileName = `${userId}-${timestamp}-${randomString}-${index}.${fileExtension}`;

            await this.s3Client.send(
              new PutObjectCommand({
                Bucket: this.bucketName,
                Key: storedFileName,
                Body: file.buffer,
                ContentType: file.mimetype,
                CacheControl: 'public, max-age=31536000',
              }),
            );

            return {
              url: `${this.r2Region}/${storedFileName}`,
              originalName: file.originalname,
              index,
            };
          } catch (error) {
            return null;
          }
        })();
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((r): r is { url: string; originalName: string; index: number } => r !== null)
        .sort((a, b) => a.index - b.index);

      if (successfulUploads.length === 0) {
        throw new BadRequestException('All files failed to upload');
      }

      const fileEntity = this.fileRepository.create({
        user: user,
        fileUrls: successfulUploads.map((u) => u.url),
        fileName: successfulUploads[0].originalName,
        thumbnailUrl: successfulUploads[0].url,
        status: 'active',
      });

      const savedFile = await this.fileRepository.save(fileEntity);
      return [savedFile];
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
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
   * Deletes all files from R2 in parallel, then removes from database
   */
  async deleteFiles(deleteFilesDto: DeleteFilesDto, userId: string): Promise<void> {
    if (!deleteFilesDto.fileIds || deleteFilesDto.fileIds.length === 0) {
      throw new BadRequestException('No file IDs provided');
    }

    // Get all files that belong to the user
    const files = await this.fileRepository.find({
      where: {
        id: In(deleteFilesDto.fileIds),
        user: { id: userId },
      },
    });

    if (files.length === 0) {
      throw new NotFoundException('No files found to delete');
    }

    // Verify all requested files were found
    const foundIds = files.map((f) => f.id);
    const notFoundIds = deleteFilesDto.fileIds.filter((id) => !foundIds.includes(id));
    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Files not found: ${notFoundIds.join(', ')}`,
      );
    }

    try {
      // Collect all file keys from all file URLs to delete
      const fileKeysToDelete: string[] = [];
      files.forEach((file) => {
        const urls = Array.isArray(file.fileUrls) ? file.fileUrls : [];
        urls.forEach((url) => {
          // Extract file key from public URL (format: region/filename)
          const parts = url.split('/');
          const fileKey = parts[parts.length - 1];
          if (fileKey) {
            fileKeysToDelete.push(fileKey);
          }
        });
      });

      const deletePromises = fileKeysToDelete.map(async (fileKey) => {
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: fileKey,
            }),
          );
        } catch (error) {
          // Continue with other files even if one fails
        }
      });

      await Promise.allSettled(deletePromises);
      await this.fileRepository.remove(files);
    } catch (error) {
      throw new BadRequestException(
        'Failed to delete files: ' + (error.message || 'Unknown error'),
      );
    }
  }

  /**
   * Process all images from file URLs and create a merged PDF
   * 1. Merge all images directly from URLs into one PDF (no extraction)
   * 2. Upload PDF to Cloudflare R2
   * 3. Return PDF URL
   */
  async convertToPdf(fileId: string, userId: string): Promise<string> {
    // Get file by ID and verify ownership
    const file = await this.fileRepository.findOne({
      where: { id: fileId, user: { id: userId } },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const urls = Array.isArray(file.fileUrls) ? file.fileUrls : [];
    if (urls.length === 0) {
      throw new BadRequestException('No image URLs found in file');
    }

    // Create temporary directory for processing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-process-'));
    
    // Detect Python path - try venv first, then system python3
    let pythonVenv = process.env.PYTHON_VENV_PATH || '/app/venv/bin/python3';
    if (!fs.existsSync(pythonVenv)) {
      pythonVenv = 'python3';
    }
    
    const scriptsPath = path.join(process.cwd(), 'scripts');

    try {
      // Merge all images directly from URLs into one PDF
      const pdfPath = path.join(tempDir, 'merged.pdf');
      const mergeScriptPath = path.join(scriptsPath, 'merge_images_to_pdf.py');
      const urlsStr = urls.map((u) => `"${u}"`).join(' ');
      
      await execAsync(
        `${pythonVenv} ${mergeScriptPath} "${pdfPath}" ${urlsStr}`,
        { timeout: 120000 }, // 2 minutes timeout
      );

      if (!fs.existsSync(pdfPath)) {
        throw new BadRequestException('Failed to create PDF');
      }

      // Upload PDF to Cloudflare R2
      const pdfBuffer = fs.readFileSync(pdfPath);
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const pdfFileName = `${userId}-${timestamp}-${randomString}.pdf`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: pdfFileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          CacheControl: 'public, max-age=31536000',
        }),
      );

      const pdfUrl = `${this.r2Region}/${pdfFileName}`;

      return pdfUrl;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to convert to PDF: ' + (error.message || 'Unknown error'),
      );
    } finally {
      // Cleanup temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Process all images from file URLs and create a merged scanned PDF (black & white)
   * 1. Scan all images directly from URLs (grayscale, denoise, threshold) and merge into one PDF
   * 2. Upload PDF to Cloudflare R2
   * 3. Return PDF URL
   */
  async convertToScan(fileId: string, userId: string): Promise<string> {
    // Get file by ID and verify ownership
    const file = await this.fileRepository.findOne({
      where: { id: fileId, user: { id: userId } },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const urls = Array.isArray(file.fileUrls) ? file.fileUrls : [];
    if (urls.length === 0) {
      throw new BadRequestException('No image URLs found in file');
    }

    // Create temporary directory for processing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-process-'));
    
    // Detect Python path - try venv first, then system python3
    let pythonVenv = process.env.PYTHON_VENV_PATH || '/app/venv/bin/python3';
    if (!fs.existsSync(pythonVenv)) {
      pythonVenv = 'python3';
    }
    
    const scriptsPath = path.join(process.cwd(), 'scripts');

    try {
      // Scan all images directly from URLs and merge into one PDF
      const pdfPath = path.join(tempDir, 'merged_scan.pdf');
      const mergeScriptPath = path.join(scriptsPath, 'merge_images_to_scan.py');
      const urlsStr = urls.map((u) => `"${u}"`).join(' ');
      
      await execAsync(
        `${pythonVenv} ${mergeScriptPath} "${pdfPath}" ${urlsStr}`,
        { timeout: 120000 }, // 2 minutes timeout
      );

      if (!fs.existsSync(pdfPath)) {
        throw new BadRequestException('Failed to create scanned PDF');
      }

      // Upload PDF to Cloudflare R2
      const pdfBuffer = fs.readFileSync(pdfPath);
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const pdfFileName = `${userId}-${timestamp}-${randomString}-scan.pdf`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: pdfFileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          CacheControl: 'public, max-age=31536000',
        }),
      );

      const pdfUrl = `${this.r2Region}/${pdfFileName}`;

      return pdfUrl;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to convert to scanned PDF: ' + (error.message || 'Unknown error'),
      );
    } finally {
      // Cleanup temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Merge multiple files into a single file
   * Combines all fileUrls from all files into one new file
   */
  async mergeFiles(mergeFilesDto: MergeFilesDto, userId: string): Promise<File> {
    if (!mergeFilesDto.fileIds || mergeFilesDto.fileIds.length === 0) {
      throw new BadRequestException('No file IDs provided');
    }

    // Get all files that belong to the user
    const files = await this.fileRepository.find({
      where: {
        id: In(mergeFilesDto.fileIds),
        user: { id: userId },
      },
    });

    if (files.length === 0) {
      throw new NotFoundException('No files found');
    }

    // Verify all requested files were found
    const foundIds = files.map((f) => f.id);
    const notFoundIds = mergeFilesDto.fileIds.filter((id) => !foundIds.includes(id));
    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Files not found: ${notFoundIds.join(', ')}`,
      );
    }

    // Collect all fileUrls from all files
    const allFileUrls: string[] = [];
    files.forEach((file) => {
      const urls = Array.isArray(file.fileUrls) ? file.fileUrls : [];
      allFileUrls.push(...urls);
    });

    if (allFileUrls.length === 0) {
      throw new BadRequestException('No image URLs found in files to merge');
    }

    // Get user for the new file
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create new file with merged URLs
    // Use first file's name and thumbnail as default
    const firstFile = files[0];
    const firstFileUrl = allFileUrls[0];

    const mergedFile = this.fileRepository.create({
      user: user,
      fileUrls: allFileUrls,
      fileName: firstFile.fileName,
      thumbnailUrl: firstFile.thumbnailUrl || firstFileUrl,
      status: 'active',
    });

    const savedFile = await this.fileRepository.save(mergedFile);

    return savedFile;
  }
}

