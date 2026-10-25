"""Build a reproducible full-source product ZIP; never package a runtime folder."""
from pathlib import Path
import hashlib
import io
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "products" / "finance-workspace"
OUTPUT = ROOT / "public" / "downloads"
ALLOWED_DIRS = {"dist", "server", "scripts", "tests", "browser-connector"}
ALLOWED_ROOT = {"package.json", "README.md", "LICENSE", ".gitignore",
                "Start-Finances.cmd", "Start-Finances.ps1", "Stop-Finances.cmd", "Stop-Finances.ps1"}
FORBIDDEN = {"runtime", "node_modules", ".openai", ".env", ".env.local", "__pycache__"}


def build():
    for required in ("package.json", "Start-Finances.cmd", "Start-Finances.ps1", "LICENSE", "server/index.mjs", "dist/index.html"):
        if not (SOURCE / required).is_file():
            raise ValueError(f"Missing product source: {required}")
    files = sorted((p for p in SOURCE.rglob("*") if p.is_file()), key=lambda p: p.relative_to(SOURCE).as_posix())
    payload = io.BytesIO()
    # Stored entries avoid differences between platform zlib implementations.
    with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_STORED) as archive:
        for path in files:
            relative = path.relative_to(SOURCE)
            if any(part in FORBIDDEN for part in relative.parts):
                continue
            if relative.parts[0] not in ALLOWED_DIRS and relative.as_posix() not in ALLOWED_ROOT:
                raise ValueError(f"Unreviewed product file: {relative}")
            if path.is_symlink() or path.suffix.lower() in {".sqlite", ".db", ".log", ".csv", ".zip"}:
                raise ValueError(f"Not distributable: {relative}")
            data = path.read_bytes()
            # Normalize text so Windows and Linux builds produce identical archives.
            if path.suffix.lower() in {".mjs", ".js", ".json", ".html", ".css", ".md", ".ps1", ".cmd"} or path.name in {"LICENSE", ".gitignore"}:
                data = data.replace(b"\r\n", b"\n")
            info = zipfile.ZipInfo("finance-workspace/" + relative.as_posix(), (2026, 10, 25, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return payload.getvalue()


if __name__ == "__main__":
    data = build()
    if not data:
        raise SystemExit("No source found")
    digest = (hashlib.sha256(data).hexdigest() + "  finance-workspace.zip\n").encode()
    artifacts = {"finance-workspace.zip": data, "finance-workspace.sha256": digest}
    if "--check" in sys.argv:
        for name, expected in artifacts.items():
            if not (OUTPUT / name).exists() or (OUTPUT / name).read_bytes() != expected:
                raise SystemExit(f"Download is stale: run python scripts/build-product-downloads.py ({name})")
        print("Product download matches reviewed source and checksum.")
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for name, content in artifacts.items():
            (OUTPUT / name).write_bytes(content)
        print(f"Built finance-workspace.zip ({len(data)} bytes).")
