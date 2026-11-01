import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createFixtureService, fixtureKey, fixtureSession, personas, projectId, taskId } from "./fixture-service";

test("real Supabase SDK crosses loopback HTTP into migrated PostgreSQL roles and work RPCs", async () => {
  const service = await createFixtureService(54339);
  const client = (persona?: keyof typeof personas) => createClient("http://127.0.0.1:54339", fixtureKey, {
    db: { schema: "cfh" }, auth: { persistSession: false, autoRefreshToken: false },
    global: persona ? { headers: { Authorization: `Bearer ${fixtureSession(persona).access_token}` } } : {},
  });
  try {
    const anonymous = client(), alice = client("alice"), bruno = client("bruno"), chris = client("chris"), newcomer = client("newcomer");
    const initial = await anonymous.from("profiles").select("username");
    assert.ifError(initial.error);
    assert.deepEqual(initial.data?.map((row) => row.username).sort(), ["test-alice", "test-bruno"]);
    const privateOwn = await chris.from("profiles").select("*").eq("id", personas.chris.id).single();
    assert.equal(privateOwn.data?.is_public, false);
    assert.ifError((await chris.from("profiles").update({ is_public: true }).eq("id", personas.chris.id).select("id").single()).error);
    assert.ifError((await chris.rpc("join_project", { project_input: projectId })).error);
    assert.ifError((await chris.from("profiles").update({ is_public: false }).eq("id", personas.chris.id).select("id").single()).error);
    const publicMembers = await anonymous.from("project_members").select("id,role,profiles!inner(name,username)").eq("project_id", projectId);
    assert.ifError(publicMembers.error);
    assert.deepEqual(publicMembers.data, [], "A later-private contributor's name remains hidden in the public project directory");
    const privateViewerDirectory = await chris.from("project_members").select("id,role,profiles!inner(name,username,is_public)").eq("project_id", projectId).eq("profiles.is_public", true);
    assert.ifError(privateViewerDirectory.error);
    assert.deepEqual(privateViewerDirectory.data, [], "A private member's own profile is excluded from the public project directory");
    assert.equal((await chris.from("project_members").select("id").eq("project_id", projectId).eq("user_id", personas.chris.id).maybeSingle()).data !== null, true);
    const denied = await alice.from("profiles").update({ name: "ATTACK" }).eq("id", personas.chris.id).select("id");
    assert.ifError(denied.error);
    assert.deepEqual(denied.data, []);
    const created = await newcomer.from("profiles").insert({ id: personas.newcomer.id, username: "test-newcomer", name: "TEST New Contributor", is_public: false }).select("id,username,is_public").single();
    assert.ifError(created.error);
    assert.equal(created.data?.is_public, false);
    const duplicate = await newcomer.from("profiles").update({ username: "test-alice" }).eq("id", personas.newcomer.id).select("id").single();
    assert.equal(duplicate.error?.code, "23505");
    const published = await newcomer.from("profiles").update({ is_public: true }).eq("id", personas.newcomer.id).select("id").single();
    assert.ifError(published.error);
    assert.equal((await anonymous.from("profiles").select("id").eq("id", personas.newcomer.id)).data?.length, 1);
    assert.ifError((await alice.rpc("join_project", { project_input: projectId })).error);
    assert.ifError((await alice.rpc("claim_task", { task_id_input: taskId })).error);
    const embedded = await alice.from("task_assignments").select("task_id,tasks(title,status)").eq("user_id", personas.alice.id);
    assert.ifError(embedded.error);
    assert.equal((embedded.data?.[0]?.tasks as unknown as { status: string }).status, "CLAIMED");
    assert.ifError((await alice.rpc("update_work", { task_input: taskId, status_input: "IN PROGRESS" })).error);
    assert.ifError((await alice.rpc("update_work", { task_input: taskId, status_input: "REVIEW", evidence_input: "https://example.invalid/test-evidence" })).error);
    const reviewQueue = await bruno.from("tasks").select("id,title,acceptance,objective,submission_evidence,submission_version,projects(name,slug),task_assignments(user_id)").eq("status", "REVIEW").eq("is_demo", false).in("project_id", [projectId]).order("created_at", { ascending: true }).limit(100);
    assert.ifError(reviewQueue.error);
    assert.equal(reviewQueue.data?.length, 1);
    assert.equal(reviewQueue.data?.[0]?.id, taskId);
    assert.ifError((await anonymous.from("profiles").select("id").eq("is_public", true)).error);
    assert.equal((await anonymous.from("profiles").select("id").eq("is_public", false)).data?.length, 0);
    const selfReview = await alice.rpc("review_work", { task_input: taskId, outcome_input: "APPROVED", body_input: "TEST self review must be rejected.", version_input: 1 });
    assert.ok(selfReview.error);
    assert.ok((await bruno.rpc("review_work", { task_input: taskId, outcome_input: "APPROVED", body_input: "TEST stale review must be rejected against the stored submission.", version_input: 99 })).error);
    assert.ifError((await bruno.rpc("review_work", { task_input: taskId, outcome_input: "APPROVED", body_input: "TEST independently checked every acceptance criterion.", version_input: 1 })).error);
    assert.ifError((await bruno.rpc("update_work", { task_input: taskId, status_input: "COMPLETE", version_input: 1 })).error);
    assert.equal((await anonymous.from("tasks").select("status").eq("id", taskId).single()).data?.status, "COMPLETE");
    const post = await alice.rpc("publish_post", { title_input: "TEST useful discussion", body_input: "Synthetic system test discussion body.", kind_input: "discussion", project_input: null, parent_input: null });
    assert.ifError(post.error);
    assert.ifError((await bruno.rpc("publish_post", { title_input: "", body_input: "Synthetic reply with useful information.", kind_input: "discussion", project_input: null, parent_input: post.data })).error);
    assert.ifError((await alice.rpc("save_post", { post_input: post.data, saved_input: true })).error);
    const saved = await alice.from("saved_posts").select("post_id,community_posts(id,title,body)").eq("user_id", personas.alice.id);
    assert.ifError(saved.error);
    assert.equal(saved.data?.length, 1);
    const notifications = await alice.from("notifications").select("id,read_at");
    assert.ok(notifications.data?.length);
    assert.ifError((await alice.rpc("read_notifications")).error);
    assert.ok((await alice.from("notifications").select("read_at")).data?.every((row) => row.read_at));
    const explanation = "Synthetic local system-test explanation with sufficient context for research review.";
    const payload = { title: "TEST independent community proposal", sources: ["https://example.invalid/source"], ...Object.fromEntries(["problem", "evidence", "existing_solutions", "people_affected", "intervention", "technology_rationale", "risks", "expertise", "deployment", "measurement"].map((name) => [name, explanation])) };
    const proposal = await alice.rpc("submit_proposal", { payload });
    assert.ifError(proposal.error);
    assert.equal((await alice.from("proposals").select("id").eq("id", proposal.data)).data?.length, 1);
    assert.deepEqual((await bruno.from("proposals").select("id").eq("id", proposal.data)).data, []);
    for (const path of ["/rest/v1/profiles", "/rest/v1/profiles?is_public=eq.not-a-boolean", "/rest/v1/profiles?name=ilike.*", "/rest/v1/profiles?select=unknown_column", "/rest/v1/profiles?select=unknown_column(*)", "/rest/v1/profiles?order=id.sideways", "/rest/v1/profiles?limit=bad", "/rest/v1/profiles?unknown_column=eq.value", "/rest/v1/rpc/not_a_supported_function", "/rest/v1/not_a_table"]) {
      const response = await fetch(`http://127.0.0.1:54339${path}`, { headers: path === "/rest/v1/profiles" ? {} : { "accept-profile": "cfh" } });
      assert.equal(response.status, 400);
    }
    const armed = await fetch("http://127.0.0.1:54339/__test/fail-next", { method: "POST", body: JSON.stringify({ path: "/rest/v1/profiles", method: "PATCH" }) });
    assert.equal(armed.status, 200);
    assert.equal((await alice.from("profiles").update({ name: "TEST recoverable change" }).eq("id", personas.alice.id).select("id").single()).error?.code, "TEST_INJECTED_FAILURE");
    assert.ifError((await alice.from("profiles").update({ name: "TEST recovered change" }).eq("id", personas.alice.id).select("id").single()).error);
    const transcript = await (await fetch("http://127.0.0.1:54339/__test/requests")).json();
    assert.ok(transcript.some((entry: { status: number }) => entry.status === 503));
    assert.ok(transcript.every((entry: object) => Object.keys(entry).sort().join(",") === "actor,method,path,status"));
    const consolePage = await fetch("http://127.0.0.1:54339/__test/console");
    assert.match(await consolePage.text(), /LOCAL TEST ENVIRONMENT/);
    const login = await fetch("http://127.0.0.1:54339/__test/login?persona=alice", { redirect: "manual" });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get("location"), "http://127.0.0.1:3101/account");
    assert.match(login.headers.get("set-cookie") || "", /^cfh-auth=base64-/);
    const guest = await fetch("http://127.0.0.1:54339/__test/login?persona=guest", { redirect: "manual" });
    assert.match(guest.headers.get("set-cookie") || "", /Max-Age=0/);
    assert.equal((await fetch("http://127.0.0.1:54339/__test/login?persona=not-real", { redirect: "manual" })).status, 400);
    assert.equal((await fetch("http://127.0.0.1:54339/__test/reset", { method: "POST", headers: { origin: "https://external.example.invalid" } })).status, 403);
    assert.equal((await fetch("http://127.0.0.1:54339/__test/login?persona=alice", { headers: { referer: "https://external.example.invalid/" }, redirect: "manual" })).status, 403);
  } finally { await service.close(); }
});
