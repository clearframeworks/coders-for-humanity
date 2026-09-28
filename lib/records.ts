import { createClient, isDemo } from "./supabase";
type Row = { id: string; [key: string]: unknown };
type Member = {
  id: string;
  role: string;
  profiles: { name: string; username: string };
};
type ProjectRecords = {
  sources: { id: string; title: string; url: string }[];
  metrics: {
    id: string;
    name: string;
    value: number;
    unit: string;
    source_url: string;
    measured_at: string;
  }[];
  milestones: { id: string; title: string; status: string }[];
  repositories: { id: string; name: string; url: string }[];
  members: Member[];
  maintainers: Member[];
  deployments: { id: string; name: string; url: string; status: string }[];
  decisions: { id: string; title: string }[];
  funding: Row[];
};
export async function projectRecords(
  projectId: string,
): Promise<ProjectRecords> {
  const empty: ProjectRecords = {
    sources: [],
    metrics: [],
    milestones: [],
    repositories: [],
    members: [],
    maintainers: [],
    deployments: [],
    decisions: [],
    funding: [],
  };
  if (isDemo()) return empty;
  const db = await createClient();
  const specs = [
    ["sources", "research_sources", "*"],
    ["milestones", "project_milestones", "*"],
    ["repositories", "project_repositories", "*"],
    ["members", "project_members", "id,role,profiles!inner(name,username)"],
    [
      "maintainers",
      "project_maintainers",
      "id,role,profiles!inner(name,username)",
    ],
    ["deployments", "project_deployments", "*"],
    ["decisions", "decisions", "*"],
    ["funding", "funding_records", "*"],
  ] as const;
  const results = await Promise.all(
    specs.map(([, table, select]) =>
      db.from(table).select(select).eq("project_id", projectId),
    ),
  );
  if (results.some((r) => r.error))
    throw new Error("Project records are temporarily unavailable.");
  const metricResult = await db
    .from("impact_records")
    .select(
      "id,value,source_url,measured_at,project_metrics!inner(name,unit,project_id)",
    )
    .eq("project_metrics.project_id", projectId)
    .eq("verified", true);
  if (metricResult.error)
    throw new Error("Impact records are temporarily unavailable.");
  const metrics = (
    metricResult.data as unknown as {
      id: string;
      value: number;
      source_url: string;
      measured_at: string;
      project_metrics: { name: string; unit: string };
    }[]
  ).map((r) => ({ ...r, ...r.project_metrics }));
  return {
    ...empty,
    ...Object.fromEntries(specs.map(([key], i) => [key, results[i].data])),
    metrics,
  } as ProjectRecords;
}
export type LedgerRecord = {
  id: string;
  source_name?: string;
  description?: string;
  amount: number;
  currency: string;
  received_at?: string;
  incurred_at?: string;
  source_url: string;
};
export async function ledger() {
  if (isDemo())
    return { funding: [] as LedgerRecord[], expenses: [] as LedgerRecord[] };
  const db = await createClient();
  const [f, e] = await Promise.all([
    db.from("funding_records").select("*"),
    db.from("expense_records").select("*"),
  ]);
  if (f.error || e.error)
    throw new Error("The public ledger is temporarily unavailable.");
  return {
    funding: f.data as LedgerRecord[],
    expenses: e.data as LedgerRecord[],
  };
}
export async function impactRecords() {
  if (isDemo()) return [];
  const db = await createClient();
  const { data, error } = await db
    .from("impact_records")
    .select(
      "*,project_metrics!inner(name,unit,methodology,projects!inner(name,slug,is_demo))",
    )
    .eq("verified", true)
    .eq("project_metrics.projects.is_demo", false);
  if (error) throw new Error("Impact records are temporarily unavailable.");
  return data as {
    id: string;
    value: number;
    source_url: string;
    measured_at: string;
    limitations: string;
    project_metrics: {
      name: string;
      unit: string;
      methodology: string;
      projects: { name: string; slug: string };
    };
  }[];
}
