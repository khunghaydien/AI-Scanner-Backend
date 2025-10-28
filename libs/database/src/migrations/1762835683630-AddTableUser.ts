import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTableUser1762835683630 implements MigrationInterface {
  name = 'AddTableUser1762835683630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for trigram similarity search
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(60) NOT NULL, "password" text NOT NULL, "user_name" character varying(255) NOT NULL, "full_name" character varying(255) NOT NULL, "last_login_at" bigint, "status" character varying DEFAULT 'active', "role" character varying DEFAULT 'user', "created_at" bigint NOT NULL, "updated_at" bigint NOT NULL, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_d34106f8ec1ebaf66f4f8609dd6" UNIQUE ("user_name"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")); COMMENT ON COLUMN "user"."status" IS 'active, inactive'; COMMENT ON COLUMN "user"."role" IS 'admin, user'`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_38e15bde06ed62070bbcfa2acd" ON "user" ("updated_at", "user_name") `
    );

    // Create GIN index with trigram on full_name for fuzzy search
    await queryRunner.query(
      `CREATE INDEX "idx_user_full_name_gin_trgm" ON "user" USING gin ("full_name" gin_trgm_ops);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop GIN index with trigram
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_user_full_name_gin_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_38e15bde06ed62070bbcfa2acd"`);
    await queryRunner.query(`DROP TABLE "user"`);
    // Note: We don't drop the pg_trgm extension as it might be used by other tables
    // If you want to drop it, uncomment the line below:
    // await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm;`);
  }
}
