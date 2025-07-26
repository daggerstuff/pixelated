import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { blogSearch } from '@/lib/search'

let isIndexed = false

async function indexPosts() {
  if (isIndexed) {
    return
  }

  const posts = await getCollection('blog')
  for (const post of posts) {
    const { Content } = await post.render()
    const content = Content.toString()
    blogSearch.addPost(post, content)
  }
  isIndexed = true
}

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')
  if (!query) {
    return new Response(
      JSON.stringify({
        version: 'v1',
        results: [],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': 'v1',
        },
      },
    )
  }

  await indexPosts()
  const results = blogSearch.search(query)

  return new Response(
    JSON.stringify({
      version: 'v1',
      results,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': 'v1',
      },
    },
  )
}
