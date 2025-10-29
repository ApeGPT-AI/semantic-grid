import type { CollectionConfig } from 'payload'

export const NewSessionWelcome: CollectionConfig = {
  slug: 'new_session_welcome',
  admin: {
    useAsTitle: 'text',
  },
  access: {
    read: () => true,
    create: ({ req: { user, headers } }) => {
      return Boolean(user) || Boolean(headers.get('x-api-key') === process.env.PAYLOAD_API_KEY)
    },
    update: ({ req: { user, headers } }) => {
      return Boolean(user) || Boolean(headers.get('x-api-key') === process.env.PAYLOAD_API_KEY)
    },
  },
  fields: [
    {
      name: 'text',
      type: 'text',
      required: true,
    },
  ],
}
