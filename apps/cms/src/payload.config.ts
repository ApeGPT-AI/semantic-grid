// storage-adapter-import-placeholder
import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Dashboards } from '@/collections/Dashboards'
import { DashboardItems } from '@/collections/DashboardItems'
import { Queries } from '@/collections/Queries'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// For more information on configuring Payload, see: https://payloadcms.github.io/payload/docs/configuration

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Dashboards, DashboardItems, Queries, Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    push: false,
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
    },
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
})
