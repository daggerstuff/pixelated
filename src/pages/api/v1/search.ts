import { getCollection } from "astro:content";
import { blogSearch } from "@/lib/search";

let isIndexed = false;

async function indexPosts() {
  if (isIndexed) {
    return;
  }

  console.time("⚡ Bolt: search indexing");
  const posts = await getCollection("blog");
  for (const post of posts) {
    // ⚡ Bolt: Use direct body access instead of expensive .render()
    // This avoids compiling Markdown to components during search indexing.
    const content = (post as any).body || post.data.description || "";
    blogSearch.addPost(post, content);
  }
  console.timeEnd("⚡ Bolt: search indexing");
  isIndexed = true;
}

export const GET = async ({ url }) => {
  const query = url.searchParams.get("q");
  if (!query) {
    return new Response(
      JSON.stringify({
        version: "v1",
        results: [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-API-Version": "v1",
        },
      },
    );
  }

  await indexPosts();
  const results = blogSearch.search(query);

  return new Response(
    JSON.stringify({
      version: "v1",
      results,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-API-Version": "v1",
      },
    },
  );
};
