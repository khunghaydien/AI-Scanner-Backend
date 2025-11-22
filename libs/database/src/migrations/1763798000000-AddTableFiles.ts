import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddTableFiles1763798000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create files table
    await queryRunner.createTable(
      new Table({
        name: 'files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'file_url',
            type: 'text',
            isNullable: false,
            comment: 'URL of the file stored in Cloudflare R2',
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Original file name',
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: true,
            comment: 'File size in bytes',
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'MIME type of the file',
          },
          {
            name: 'file_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'File type: image, document, pdf, excel, etc.',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
            comment: 'Optional description of the file',
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: true,
            default: "'active'",
            comment: 'active, deleted',
          },
          {
            name: 'created_at',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'bigint',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create foreign key to user table
    await queryRunner.createForeignKey(
      'files',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );

    // Create index on createdAt and id
    await queryRunner.createIndex(
      'files',
      new TableIndex({
        name: 'IDX_files_created_at_id',
        columnNames: ['created_at', 'id'],
      }),
    );

    // Create index on updatedAt and id (for cursor pagination)
    await queryRunner.createIndex(
      'files',
      new TableIndex({
        name: 'IDX_files_updated_at_id',
        columnNames: ['updated_at', 'id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('files', 'IDX_files_created_at_id');
    await queryRunner.dropIndex('files', 'IDX_files_updated_at_id');

    // Drop foreign key
    const table = await queryRunner.getTable('files');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('files', foreignKey);
    }

    // Drop table
    await queryRunner.dropTable('files');
  }
}

