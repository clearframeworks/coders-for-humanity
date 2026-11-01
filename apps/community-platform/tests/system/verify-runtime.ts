import { execFileSync } from "node:child_process";
import { runtimeInventory, migrationFingerprint, runtimePaths, type RuntimeFile } from "./runtime-inventory";

async function main() {
  const app = "http://127.0.0.1:3101", backend = "http://127.0.0.1:54329";
  const [manifest, health, inventory, migrations] = await Promise.all([
    fetch(`${app}/__cfh-system-fixture.json`).then((response) => response.json()),
    fetch(`${backend}/__test/health`).then((response) => response.json()),
    runtimeInventory(process.cwd()), migrationFingerprint(process.cwd()),
  ]);
  if (manifest.fixture !== "cfh-loopback-system" || manifest.appOrigin !== app || manifest.backendOrigin !== backend || !Array.isArray(manifest.runtimeFiles)) throw new Error("Expected a runner-owned system app manifest");
  const attested = new Map((manifest.runtimeFiles as RuntimeFile[]).map((file) => [file.path, file.sha256]));
  const current = new Map(inventory.files.map((file) => [file.path, file.sha256]));
  const differences = [...new Set([...attested.keys(), ...current.keys()])].filter((path) => attested.get(path) !== current.get(path)).sort();
  const currentGitHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const runtimeStatus = execFileSync("git", ["status", "--porcelain", "--", ...runtimePaths], { encoding: "utf8" }).trim();
  const sourceMatches = differences.length === 0 && manifest.sourceFingerprint === inventory.fingerprint;
  const backendMatches = manifest.backendRunId === health.runId && manifest.migrationFingerprint === health.migrationFingerprint && migrations === health.migrationFingerprint;
  const result = {
    appRunId: manifest.runId, backendRunId: health.runId, snapshotGitHead: manifest.sourceGitHead,
    currentGitHead, sourceFingerprint: inventory.fingerprint, runtimeFiles: inventory.files.length,
    sourceMatches, backendMatches, differences,
    boundToCurrentCommit: sourceMatches && backendMatches && runtimeStatus === "",
    uncommittedRuntimePaths: runtimeStatus ? runtimeStatus.split("\n") : [],
    boundary: "Local synthetic-auth system environment; source binding does not establish hosted authentication or deployment acceptance.",
  };
  console.log(JSON.stringify(result, null, 2));
  if (!sourceMatches || !backendMatches) process.exitCode = 1;
}
void main();
