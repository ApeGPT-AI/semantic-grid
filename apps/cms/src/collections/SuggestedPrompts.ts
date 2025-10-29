import type { CollectionConfig } from 'payload'

export const SuggestedPrompts: CollectionConfig = {
  slug: 'suggested_prompts',
  admin: {
    useAsTitle: 'summary',
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
      name: 'summary',
      type: 'text',
      required: true,
    },
    {
      name: 'text',
      type: 'text',
      required: true,
    },
  ],
}
