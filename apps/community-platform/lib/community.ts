import { cache } from "react";
import { createClient, configured, isDemo } from "./supabase";
export type CommunityPost = {
  id: string;
  author_id: string;
  project_id: string | null;
  parent_id: string | null;
  kind: "discussion" | "question" | "update";
  title: string;
  body: string;
  created_at: string;
  profiles: {
    name: string;
    username: string;
  } | null;
};
export const communityReady = () => configured() && !isDemo();
export const getViewer = cache(async () => {
  if (!communityReady()) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await db
    .from("profiles")
    .select("id,name,username,is_public")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Your profile could not be loaded.");
  return {
    id: user.id,
    profile: profile as {
      id: string;
      name: string;
      username: string;
      is_public: boolean;
    } | null,
  };
});
export const getPosts = cache(
  async (project?: string, parent?: string): Promise<CommunityPost[]> => {
    if (!communityReady()) return [];
    const db = await createClient();
    let query = db
      .from("community_posts")
      .select(
        "id,author_id,project_id,parent_id,kind,title,body,created_at,profiles!community_posts_author_id_fkey(name,username)",
      )
      .order("created_at", { ascending: !!parent })
      .limit(50);
    query = parent
      ? query.eq("parent_id", parent)
      : query.is("parent_id", null);
    if (project) query = query.eq("project_id", project);
    const { data, error } = await query;
    if (error)
      throw new Error("Community conversations are temporarily unavailable.");
    return data as unknown as CommunityPost[];
  },
);
export async function getPost(id: string): Promise<CommunityPost | null> {
  if (!communityReady() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("community_posts")
    .select(
      "id,author_id,project_id,parent_id,kind,title,body,created_at,profiles!community_posts_author_id_fkey(name,username)",
    )
    .eq("id", id)
    .is("parent_id", null)
    .maybeSingle();
  if (error) throw new Error("This conversation could not be loaded.");
  return data as unknown as CommunityPost | null;
}
