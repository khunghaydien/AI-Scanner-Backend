import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('media')
@Index(['createdAt', 'id'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'file_url',
    type: 'text',
    nullable: false,
    comment: 'URL of the file stored in Cloudflare R2',
  })
  fileUrl: string;

  @Column({
    name: 'file_name',
    type: 'varchar',
    nullable: false,
    length: 255,
    comment: 'Original file name',
  })
  fileName: string;

  @Column({
    name: 'file_size',
    type: 'bigint',
    nullable: true,
    comment: 'File size in bytes',
  })
  fileSize: number;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    nullable: true,
    length: 100,
    comment: 'MIME type of the file',
  })
  mimeType: string;

  @Column({
    name: 'file_type',
    type: 'varchar',
    nullable: true,
    length: 50,
    comment: 'File type: image, document, pdf, excel, etc.',
  })
  fileType: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
    comment: 'Optional description of the file',
  })
  description: string;

  @Column({
    name: 'status',
    type: 'varchar',
    nullable: true,
    default: 'active',
    comment: 'active, deleted',
  })
  status: string;

  @Column({
    name: 'created_at',
    type: 'bigint',
    nullable: false,
  })
  createdAt: number;

  @Column({
    name: 'updated_at',
    type: 'bigint',
    nullable: false,
  })
  updatedAt: number;

  @BeforeInsert()
  createDates() {
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    if (!this.status) {
      this.status = 'active';
    }
  }

  @BeforeUpdate()
  updateDates() {
    this.updatedAt = Date.now();
  }
}


