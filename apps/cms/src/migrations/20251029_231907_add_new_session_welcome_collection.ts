import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
   CREATE TABLE "new_session_welcome" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "new_session_welcome_id" integer;
  CREATE INDEX "new_session_welcome_updated_at_idx" ON "new_session_welcome" USING btree ("updated_at");
  CREATE INDEX "new_session_welcome_created_at_idx" ON "new_session_welcome" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_new_session_welcome_fk" FOREIGN KEY ("new_session_welcome_id") REFERENCES "public"."new_session_welcome"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_new_session_welcome_id_idx" ON "payload_locked_documents_rels" USING btree ("new_session_welcome_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
   ALTER TABLE "new_session_welcome" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "new_session_welcome" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_new_session_welcome_fk";
  
  DROP INDEX "payload_locked_documents_rels_new_session_welcome_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "new_session_welcome_id";`)
}
