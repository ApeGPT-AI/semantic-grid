import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Migration code
  await payload.db.drizzle.execute(sql`
   CREATE UNIQUE INDEX "dashboards_owner_user_id_idx" ON "dashboards" USING btree ("owner_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Migration code
  await payload.db.drizzle.execute(sql`
   DROP INDEX "dashboards_owner_user_id_idx";`)
}
