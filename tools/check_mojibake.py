#!/usr/bin/env python3
"""Report likely mojibake/encoding artifacts without modifying files.

This tool is intentionally conservative. It scans text-like project files,
skips generated/heavy/sensitive directories, and prints JSON so results can be
reviewed before any manual correction.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PATTERNS = (
    "\u00c3",      # UTF-8 bytes decoded as Latin-1/CP1252, common in Spanish
    "\u00c2",      # stray Latin-1 marker, common before inverted punctuation
    "\ufffd",      # Unicode replacement character
    "\u00ef\u00bf\u00bd",  # replacement char rendered as mojibake
    "\u00e2\u20ac",        # curly quotes/dashes decoded incorrectly
    "\u00e2\u20ac\u2122",
    "\u00e2\u20ac\u0153",
    "\u00e2\u20ac\ufffd",
    "\u00e2\u20ac\u201c",
    "\u00e2\u20ac\u201d",
    "\u00e2\u20ac\u00a6",
    "\u00e2\u2020",
    "\u00e2\u0153",
    "\u00f0\u0178",        # emoji decoded incorrectly
)

TEXT_EXTENSIONS = {
    ".bat",
    ".cs",
    ".css",
    ".html",
    ".java",
    ".js",
    ".json",
    ".kt",
    ".md",
    ".ps1",
    ".py",
    ".sql",
    ".txt",
    ".xaml",
    ".xml",
}

SKIP_DIR_NAMES = {
    ".git",
    ".gradle",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "env",
    "node_modules",
    "restore_points",
    "venv",
}

SKIP_DIR_PREFIXES = (
    "backup_",
)

SENSITIVE_PARTS = {
    ".flowlogin_payloads",
}

VENDORED_DOC_PARTS = {
    ("flow_agent_monolito", "app", "src", "main", "assets-app", "docs"),
}


def should_skip_dir(path: Path) -> bool:
    name = path.name
    if name in SKIP_DIR_NAMES or name in SENSITIVE_PARTS:
        return True
    return any(name.startswith(prefix) for prefix in SKIP_DIR_PREFIXES)


def has_relative_parts(path: Path, parts: tuple[str, ...]) -> bool:
    normalized = tuple(part.lower() for part in path.parts)
    wanted = tuple(part.lower() for part in parts)
    width = len(wanted)
    if width == 0 or width > len(normalized):
        return False
    return any(normalized[i:i + width] == wanted for i in range(0, len(normalized) - width + 1))


def should_scan_file(path: Path) -> bool:
    for parts in VENDORED_DOC_PARTS:
        if has_relative_parts(path, parts):
            return False
    return path.suffix.lower() in TEXT_EXTENSIONS


def classify(path: Path) -> str:
    parts = {part.lower() for part in path.parts}
    suffix = path.suffix.lower()
    if suffix in {".html", ".css"} or "res" in parts:
        return "A-ui-visible"
    if suffix in {".py", ".js", ".java", ".kt", ".cs", ".xml", ".json"}:
        return "B-api-logs-code"
    if suffix in {".md", ".txt"}:
        return "C-docs-comments"
    return "review"


def iter_files(root: Path):
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            children = list(current.iterdir())
        except OSError:
            continue
        for child in children:
            if child.is_dir():
                if not should_skip_dir(child):
                    stack.append(child)
            elif child.is_file() and should_scan_file(child):
                yield child


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            return None
    except OSError:
        return None


def scan(root: Path, limit: int | None = None):
    findings = []
    for path in iter_files(root):
        text = read_text(path)
        if text is None:
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            hits = [pattern for pattern in PATTERNS if pattern in line]
            if not hits:
                continue
            findings.append(
                {
                    "path": str(path.relative_to(root)).replace("\\", "/"),
                    "line": line_number,
                    "patterns": hits,
                    "risk": classify(path),
                    "text": line.strip()[:240],
                }
            )
            if limit and len(findings) >= limit:
                return findings
    return findings


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root to scan")
    parser.add_argument("--limit", type=int, default=0, help="Stop after N findings")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    findings = scan(root, limit=args.limit or None)
    payload = {
        "root": str(root),
        "count": len(findings),
        "patterns": list(PATTERNS),
        "findings": findings,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
