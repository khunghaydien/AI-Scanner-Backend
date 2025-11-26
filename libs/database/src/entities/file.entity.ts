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

@Entity('files')
@Index(['createdAt', 'id'])
@Index(['updatedAt', 'id'])
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'file_urls',
    type: 'jsonb',
    nullable: false,
    comment: 'URLs of the files stored in Cloudflare R2',
  })
  fileUrls: string[];

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    nullable: false,
    length: 255,
    comment: 'Thumbnail URL (usually the first file)',
  })
  thumbnailUrl: string;

  @Column({
    name: 'file_name',
    type: 'varchar',
    nullable: false,
    length: 255,
    comment: 'Original file name',
  })
  fileName: string;

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

