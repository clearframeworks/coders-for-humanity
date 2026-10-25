"""Bind the published installer manifest to the current full-source download."""
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
downloads = root / "apps/community-platform/public/downloads"
manifest = json.loads((downloads / "finance-installer-manifest.json").read_text(encoding="utf-8-sig"))
source_hash = hashlib.sha256((downloads / "finance-workspace.zip").read_bytes()).hexdigest()
if manifest["sourceArchiveSha256"] != source_hash:
    raise SystemExit("Installer source is stale. Rebuild and review the installer with the updated source ZIP.")
if not re.fullmatch(r"[0-9a-f]{64}", manifest["installerSha256"]):
    raise SystemExit("Invalid installer checksum.")
if "--installer" in sys.argv:
    installer = Path(sys.argv[sys.argv.index("--installer") + 1])
    if hashlib.sha256(installer.read_bytes()).hexdigest() != manifest["installerSha256"]:
        raise SystemExit("The installer does not match the reviewed release manifest.")
print("Installer manifest matches the current source ZIP" + (" and installer." if "--installer" in sys.argv else "."))
