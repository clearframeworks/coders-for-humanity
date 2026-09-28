"""Baseline tracked-source scan. Reports file/line/rule only, never matched secrets.

This intentionally small scanner is not a complete credential detector. GitHub
secret scanning/push protection and an independently maintained scanner must be
verified by the harness team before granting broad repository write access.
"""
from pathlib import Path
import re
import subprocess
import sys

PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "GitHub token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b"),
    "AWS access key": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "provider secret key": re.compile(rb"\b(?:sk_live_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{40,}|sb_secret_[A-Za-z0-9_-]{20,})\b"),
    "JWT credential": re.compile(rb"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\b"),
}


def scan(data):
    return [(name, data[:match.start()].count(b"\n") + 1)
            for name, pattern in PATTERNS.items() for match in pattern.finditer(data)]


def main():
    files = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
    findings = []
    for filename in filter(None, files):
        path = Path(filename)
        if not path.is_file():
            continue
        if path.name.startswith(".env") and path.name != ".env.example":
            findings.append((filename, 1, "environment file must not be tracked"))
        for name, line in scan(path.read_bytes()):
            findings.append((filename, line, name))
    for filename, line, name in findings:
        print(f"{filename}:{line}: blocked credential pattern ({name})")
    if findings:
        print("Remove exposed credentials, rotate them, and review history before retrying.")
        return 1
    print("Known credential patterns: no matches in tracked source. Manual security review remains required.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
