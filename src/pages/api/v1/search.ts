import { getCollection } from 'astro:content';
import { blogSearch } from '@/lib/search';

let isIndexed = false;
let isIndexing = false;

async function indexPosts() {
  // Prevent concurrent indexing operations
  if (isIndexed || isIndexing) {
    return;
  }
  isIndexing = true;
  try {
    console.time('⚡ Bolt: search indexing');
    const posts = await getCollection('blog');
    for (const post of posts) {
      // ⚡ Bolt: Use direct body access instead of expensive .render()
      // This avoids compiling Markdown to components during search indexing.
      const content = (post as any).body || post.data.description || '';
      blogSearch.addPost(post, content);
    }
    console.timeEnd('⚡ Bolt: search indexing');
    isIndexed = true;
  } finally {
    isIndexing = false;
  }
}

export const GET = async ({ url }) => {
  const query = url.searchParams.get('q');
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
    );
  }

  await indexPosts();
  const results = blogSearch.search(query);

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
  );
};