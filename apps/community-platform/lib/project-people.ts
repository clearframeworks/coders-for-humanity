import { communityReady } from "./community";
import { createClient } from "./supabase";

export type ProjectPerson = {
  id: string;
  role: string;
  profiles: { name: string; username: string };
};
export type ProjectPeople = {
  status: "ready" | "unavailable" | "disconnected";
  members: ProjectPerson[];
  maintainers: ProjectPerson[];
  joined: boolean;
};

export async function getProjectPeople(projectId: string, viewerId?: string | Promise<string | undefined>): Promise<ProjectPeople> {
  const empty = { members: [], maintainers: [], joined: false };
  if (!communityReady()) return { ...empty, status: "disconnected" };
  try {
    const db = await createClient();
    const [members, maintainers, membership] = await Promise.all([
      db.from("project_members").select("id,role,profiles!inner(name,username,is_public)").eq("project_id", projectId).eq("profiles.is_public", true),
      db.from("project_maintainers").select("id,role,profiles!inner(name,username,is_public)").eq("project_id", projectId).eq("profiles.is_public", true),
      Promise.resolve(viewerId).then(async (id) => {
        if (!id) return { data: null, error: null };
        const { data, error } = await db.from("project_members").select("id").eq("project_id", projectId).eq("user_id", id).maybeSingle();
        return { data, error };
      }),
    ]);
    if (members.error || maintainers.error || membership.error) return { ...empty, status: "unavailable" };
    // The directory lists public profiles only, even for a viewer whose own
    // private profile is readable under RLS. Own membership is checked apart.
    return {
      status: "ready",
      members: members.data as unknown as ProjectPerson[],
      maintainers: maintainers.data as unknown as ProjectPerson[],
      joined: Boolean(membership.data),
    };
  } catch {
    return { ...empty, status: "unavailable" };
  }
}
