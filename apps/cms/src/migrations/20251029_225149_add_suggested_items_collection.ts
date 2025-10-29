import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "suggested_prompts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "suggested_prompts_id" integer;
  CREATE INDEX "suggested_prompts_updated_at_idx" ON "suggested_prompts" USING btree ("updated_at");
  CREATE INDEX "suggested_prompts_created_at_idx" ON "suggested_prompts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suggested_prompts_fk" FOREIGN KEY ("suggested_prompts_id") REFERENCES "public"."suggested_prompts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_suggested_prompts_id_idx" ON "payload_locked_documents_rels" USING btree ("suggested_prompts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "suggested_prompts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "suggested_prompts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_suggested_prompts_fk";
  
  DROP INDEX "payload_locked_documents_rels_suggested_prompts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "suggested_prompts_id";`)
}
