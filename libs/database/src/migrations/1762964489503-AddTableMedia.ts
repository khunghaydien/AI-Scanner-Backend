import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTableMedia1762964489503 implements MigrationInterface {
    name = 'AddTableMedia1762964489503'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_user_full_name_gin_trgm"`);
        await queryRunner.query(`CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_url" text NOT NULL, "file_name" character varying(255) NOT NULL, "file_size" bigint, "mime_type" character varying(100), "file_type" character varying(50), "description" text, "status" character varying DEFAULT 'active', "created_at" bigint NOT NULL, "updated_at" bigint NOT NULL, "user_id" uuid, CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id")); COMMENT ON COLUMN "media"."file_url" IS 'URL of the file stored in Cloudflare R2'; COMMENT ON COLUMN "media"."file_name" IS 'Original file name'; COMMENT ON COLUMN "media"."file_size" IS 'File size in bytes'; COMMENT ON COLUMN "media"."mime_type" IS 'MIME type of the file'; COMMENT ON COLUMN "media"."file_type" IS 'File type: image, document, pdf, excel, etc.'; COMMENT ON COLUMN "media"."description" IS 'Optional description of the file'; COMMENT ON COLUMN "media"."status" IS 'active, deleted'`);
        await queryRunner.query(`CREATE INDEX "IDX_9d2ed43f5d3b63b638a1319c48" ON "media" ("created_at", "id") `);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "FK_c0dd13ee4ffc96e61bdc1fb592d" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_c0dd13ee4ffc96e61bdc1fb592d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d2ed43f5d3b63b638a1319c48"`);
        await queryRunner.query(`DROP TABLE "media"`);
        await queryRunner.query(`CREATE INDEX "idx_user_full_name_gin_trgm" ON "user" ("full_name") `);
    }

}
