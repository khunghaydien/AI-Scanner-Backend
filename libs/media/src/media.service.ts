import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Media } from '@app/database/entities/media.entity';
import { User } from '@app/database/entities/user.entity';
import { UploadFileDto, UpdateFileDto } from './dto';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

@Injectable()
export class MediaService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly r2Endpoint: string;
  private readonly r2PublicUrl: string;
  private readonly r2Region: string;
  private readonly execAsync = promisify(exec);

  // Allowed image types for scanner
  private readonly allowedImageMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
  ];

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
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
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
    if (mimeType.includes('pdf')) {
      return 'pdf';
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'excel';
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'document';
    }
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return 'presentation';
    }
    if (mimeType.startsWith('text/')) {
      return 'text';
    }
    return 'other';
  }

  /**
   * Upload file to Cloudflare R2 and save to database
   */
  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    uploadDto?: UploadFileDto,
  ): Promise<Media> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: images, documents, PDFs, Excel files.`,
      );
    }

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
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

      // Upload to Cloudflare R2
      await this.s3Client.send(uploadCommand);

      // Get file type
      const fileType = this.getFileType(file.mimetype);

      // Save to database with full public URL
      const media = this.mediaRepository.create({
        user: user,
        fileUrl: `${this.r2Region}/${fileName}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType,
        description: uploadDto?.description || undefined,
        status: 'active',
      });

      return await this.mediaRepository.save(media);
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Get all files for a user
   */
  async getUserFiles(userId: string): Promise<Media[]> {
    return await this.mediaRepository.find({
      where: { user: { id: userId }, status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get single file by ID
   */
  async getFileById(fileId: string, userId: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id: fileId, user: { id: userId } },
    });

    if (!media) {
      throw new NotFoundException('File not found');
    }

    return media;
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    userId: string,
    updateDto: UpdateFileDto,
  ): Promise<Media> {
    const media = await this.getFileById(fileId, userId);

    if (updateDto.description !== undefined) {
      media.description = updateDto.description;
    }

    if (updateDto.status !== undefined) {
      media.status = updateDto.status;
    }

    return await this.mediaRepository.save(media);
  }


  /**
   * Hard delete file (permanent delete)
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const media = await this.getFileById(fileId, userId);

    try {
      // Extract file key from public URL
      const fileKey = media.fileUrl.split('/')[media.fileUrl.split('/').length - 1];
      console.log('🗑️  Deleting file from R2:', fileKey);

      // Delete from Cloudflare R2
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(deleteCommand);
      console.log('✅ File deleted from R2:', fileKey);

      // Hard delete from database
      await this.mediaRepository.remove(media);
      console.log('✅ File deleted from database:', fileId);
    } catch (error) {
      console.error('❌ Error deleting file from R2:', error);
      throw new BadRequestException('Failed to delete file: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Download file from R2
   */
  private async downloadFileFromR2(fileKey: string): Promise<Buffer> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const response = await this.s3Client.send(getCommand);
      const stream = response.Body as Readable;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error downloading file from R2:', error);
      throw new BadRequestException('Failed to download file from R2');
    }
  }

  /**
   * Detect Python command (python3 or python)
   * Prefer virtual environment if available
   */
  private async detectPythonCommand(): Promise<string> {
    // Check for virtual environment first (for Docker/production)
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3');
    if (fs.existsSync(venvPython)) {
      return venvPython;
    }

    // Check for virtual environment with 'python' command
    const venvPythonAlt = path.join(process.cwd(), 'venv', 'bin', 'python');
    if (fs.existsSync(venvPythonAlt)) {
      return venvPythonAlt;
    }

    // Fallback to system python3
    try {
      await this.execAsync('python3 --version');
      return 'python3';
    } catch {
      // Fallback to system python
      try {
        await this.execAsync('python --version');
        return 'python';
      } catch {
        throw new Error(
          'Python is not installed. Please install Python 3 to use the scanner feature.',
        );
      }
    }
  }

  /**
   * Scan image using Python OpenCV + Tesseract
   */
  private async scanImageWithPython(
    imageBuffer: Buffer,
    outputPath: string,
  ): Promise<Buffer> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'scan_image.py');
    const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}.png`);

    try {
      // Detect Python command
      const pythonCmd = await this.detectPythonCommand();

      // Write input image to temp file
      fs.writeFileSync(tempInputPath, imageBuffer);

      // Run Python script
      console.log(`Running: ${pythonCmd} "${scriptPath}" "${tempInputPath}" "${outputPath}"`);
      const { stdout, stderr } = await this.execAsync(
        `${pythonCmd} "${scriptPath}" "${tempInputPath}" "${outputPath}"`,
      );

      // Log output for debugging
      if (stdout) {
        console.log('Python script stdout:', stdout);
      }
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python script stderr:', stderr);
      }

      // Read scanned image
      if (!fs.existsSync(outputPath)) {
        throw new Error(
          `Scanned image file was not created. Output path: ${outputPath}. Python stdout: ${stdout}. Python stderr: ${stderr}`,
        );
      }

      const scannedBuffer = fs.readFileSync(outputPath);

      // Cleanup temp files
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      return scannedBuffer;
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      console.error('Error scanning image with Python:', error);
      throw new BadRequestException(
        'Failed to scan image: ' + (error.message || 'Unknown error'),
      );
    }
  }

  /**
   * Extract document from background using Python script
   */
  private async extractDocumentWithPython(
    imageBuffer: Buffer,
    outputPath: string,
  ): Promise<Buffer> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_document.py');
    const tempInputPath = path.join(os.tmpdir(), `extract-input-${Date.now()}.png`);

    try {
      // Detect Python command
      const pythonCmd = await this.detectPythonCommand();

      // Write input image to temp file
      fs.writeFileSync(tempInputPath, imageBuffer);

      // Run Python script
      console.log(`Running: ${pythonCmd} "${scriptPath}" "${tempInputPath}" "${outputPath}"`);
      const { stdout, stderr } = await this.execAsync(
        `${pythonCmd} "${scriptPath}" "${tempInputPath}" "${outputPath}"`,
      );

      // Log output for debugging
      if (stdout) {
        console.log('Python script stdout:', stdout);
      }
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python script stderr:', stderr);
      }

      // Read extracted image
      if (!fs.existsSync(outputPath)) {
        throw new Error(
          `Extracted image file was not created. Output path: ${outputPath}. Python stdout: ${stdout}. Python stderr: ${stderr}`,
        );
      }

      const extractedBuffer = fs.readFileSync(outputPath);

      // Cleanup temp files
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      return extractedBuffer;
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      console.error('Error extracting document with Python:', error);
      throw new BadRequestException(
        'Failed to extract document: ' + (error.message || 'Unknown error'),
      );
    }
  }

  /**
   * Upload image and scan it to PDF (A4, black & white)
   * Returns both original image and scanned PDF Media
   */
  async uploadFileScanner(
    userId: string,
    file: Express.Multer.File,
    uploadDto?: UploadFileDto,
  ): Promise<{ original: Media; scanned: Media }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate that it's an image
    if (!this.allowedImageMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only image files are allowed for scanning.',
      );
    }

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // Step 1: Extract document from background (nhận ảnh trực tiếp từ buffer)
      const tempExtractedPath = path.join(
        os.tmpdir(),
        `extracted-${Date.now()}.png`,
      );
      console.log('🔍 Step 1: Extracting document from background...');
      const extractedBuffer = await this.extractDocumentWithPython(
        file.buffer, // Truyền trực tiếp buffer từ file upload
        tempExtractedPath,
      );

      // Step 2: Scan extracted image using Python (output as PDF)
      const tempScannedPath = path.join(
        os.tmpdir(),
        `scanned-${Date.now()}.pdf`,
      );
      console.log('🔍 Step 2: Scanning extracted image to PDF A4 (black & white)...');
      const scannedBuffer = await this.scanImageWithPython(
        extractedBuffer, // Scan ảnh đã extract, không phải ảnh gốc
        tempScannedPath,
      );

      // Step 3: Create a file-like object for the scanned PDF
      const originalNameWithoutExt = path.parse(file.originalname).name;
      const scannedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: `scanned-${originalNameWithoutExt}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: scannedBuffer.length,
        buffer: scannedBuffer,
        destination: '',
        filename: `scanned-${originalNameWithoutExt}.pdf`,
        path: '',
        stream: null as any,
      };

      // Step 4: Upload scanned PDF to R2 (chỉ upload output cuối cùng)
      const scannedMedia = await this.uploadFile(userId, scannedFile, {
        description: uploadDto?.description
          ? `Scanned PDF version of: ${uploadDto.description}`
          : 'Scanned document PDF',
      });
      console.log('✅ Scanned PDF uploaded to R2:', scannedMedia.id);

      // Step 5: Tạo original Media record (chỉ lưu metadata, không upload file lên R2)
      const originalMedia = this.mediaRepository.create({
        user: user,
        fileUrl: '', // Không có fileUrl vì không upload lên R2
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType: this.getFileType(file.mimetype),
        description: uploadDto?.description || 'Original image (not uploaded to R2)',
        status: 'active',
      });
      const savedOriginalMedia = await this.mediaRepository.save(originalMedia);

      return {
        original: savedOriginalMedia,
        scanned: scannedMedia,
      };
    } catch (error) {
      console.error('Error in uploadFileScanner:', error);
      throw new BadRequestException(
        'Failed to upload and scan file: ' + (error.message || 'Unknown error'),
      );
    }
  }

  /**
   * Extract document from background (e.g., ID card from black background)
   * Returns both original image and extracted image Media
   */
  async extractDocumentFromBackground(
    userId: string,
    file: Express.Multer.File,
    uploadDto?: UploadFileDto,
  ): Promise<{ original: Media; scanned: Media }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate that it's an image
    if (!this.allowedImageMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only image files are allowed for background extraction.',
      );
    }

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // Step 1: Extract document from background using Python (nhận ảnh trực tiếp từ buffer)
      const tempOutputPath = path.join(
        os.tmpdir(),
        `extracted-${Date.now()}.png`,
      );
      console.log('🔍 Extracting document from background...');
      const extractedBuffer = await this.extractDocumentWithPython(
        file.buffer, // Truyền trực tiếp buffer từ file upload, không cần download từ R2
        tempOutputPath,
      );

      // Step 2: Create a file-like object for the extracted image
      const originalNameWithoutExt = path.parse(file.originalname).name;
      const extractedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: `extracted-${originalNameWithoutExt}.png`,
        encoding: '7bit',
        mimetype: 'image/png',
        size: extractedBuffer.length,
        buffer: extractedBuffer,
        destination: '',
        filename: `extracted-${originalNameWithoutExt}.png`,
        path: '',
        stream: null as any,
      };

      // Step 3: Upload extracted image to R2 (chỉ upload output, không upload ảnh gốc)
      const scannedMedia = await this.uploadFile(userId, extractedFile, {
        description: uploadDto?.description
          ? `Extracted document from background: ${uploadDto.description}`
          : 'Extracted document from background',
      });
      console.log('✅ Extracted image uploaded to R2:', scannedMedia.id);

      // Step 4: Tạo original Media record (chỉ lưu metadata, không upload file lên R2)
      const originalMedia = this.mediaRepository.create({
        user: user,
        fileUrl: '', // Không có fileUrl vì không upload lên R2
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType: this.getFileType(file.mimetype),
        description: uploadDto?.description || 'Original image (not uploaded to R2)',
        status: 'active',
      });
      const savedOriginalMedia = await this.mediaRepository.save(originalMedia);

      return {
        original: savedOriginalMedia,
        scanned: scannedMedia,
      };
    } catch (error) {
      console.error('Error in extractDocumentFromBackground:', error);
      throw new BadRequestException(
        'Failed to extract document from background: ' + (error.message || 'Unknown error'),
      );
    }
  }
}
