import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeTableFiles1764166275290 implements MigrationInterface {
    name = 'ChangeTableFiles1764166275290'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_files_created_at_id"`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "file_url"`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "file_size"`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "mime_type"`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "file_type"`);
        await queryRunner.query(`ALTER TABLE "files" ADD "file_urls" jsonb NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "files"."file_urls" IS 'URLs of the files stored in Cloudflare R2'`);
        await queryRunner.query(`ALTER TABLE "files" ADD "thumbnail_url" character varying(255) NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "files"."thumbnail_url" IS 'Thumbnail URL (usually the first file)'`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_a7435dbb7583938d5e7d1376041"`);
        await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_270998ac6401c38560cbb4abd9" ON "files" ("updated_at", "id") `);
        await queryRunner.query(`CREATE INDEX "IDX_802597577fa37467aaab481e0b" ON "files" ("created_at", "id") `);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_a7435dbb7583938d5e7d1376041" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_a7435dbb7583938d5e7d1376041"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_802597577fa37467aaab481e0b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_270998ac6401c38560cbb4abd9"`);
        await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_a7435dbb7583938d5e7d1376041" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`COMMENT ON COLUMN "files"."thumbnail_url" IS 'Thumbnail URL (usually the first file)'`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "thumbnail_url"`);
        await queryRunner.query(`COMMENT ON COLUMN "files"."file_urls" IS 'URLs of the files stored in Cloudflare R2'`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "file_urls"`);
        await queryRunner.query(`ALTER TABLE "files" ADD "file_type" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "files" ADD "mime_type" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "files" ADD "file_size" bigint`);
        await queryRunner.query(`ALTER TABLE "files" ADD "file_url" text NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_files_created_at_id" ON "files" ("created_at", "id") `);
    }

}
