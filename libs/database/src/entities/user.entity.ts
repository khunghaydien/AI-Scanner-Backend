import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Media } from './media.entity';

@Entity('user')
@Index(['updatedAt', 'userName'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'email',
    type: 'varchar',
    nullable: false,
    length: 60,
    unique: true,
  })
  email: string;

  @Column({
    name: 'password',
    type: 'text',
    nullable: false,
  })
  password: string;

  @Column({
    name: 'user_name',
    type: 'varchar',
    nullable: false,
    unique: true,
    length: 255,
  })
  userName: string;

  @Column({
    name: 'full_name',
    type: 'varchar',
    nullable: false,
    length: 255,
  })
  fullName: string;

  @Column({
    name: 'last_login_at',
    type: 'bigint',
    nullable: true,
  })
  lastLoginAt: number;

  @Column({
    name: 'status',
    comment: 'active, inactive',
    type: 'varchar',
    nullable: true,
    default: 'active',
  })
  status: string;

  @Column({
    name: 'role',
    comment: 'admin, user',
    type: 'varchar',
    nullable: true,
    default: 'user',
  })
  role: string;

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

  @OneToMany(() => Media, (media) => media.user)
  media: Media[];

  @BeforeInsert()
  createDates() {
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.userName = `${this.role}_${this.createdAt.toString()}`;
  }

  @BeforeUpdate()
  updateDates() {
    this.updatedAt = Date.now();
  }
}
