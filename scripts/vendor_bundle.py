"""Copy the Hoja plugin runtime bundle into this package, or check that it is unchanged.

The runtime (Trebol's TaskManage engine, its task gate, Hoja mode and session traces) is the same code every Hoja
plugin runs. It is built in ``hoja-work/hoja-claude-plugin`` as self-contained ``dist/*.mjs`` files; this package
ships those files byte for byte and records their SHA-256 hashes in ``_bundle/MANIFEST.json``.

    uv run python scripts/vendor_bundle.py --from ../hoja-claude-plugin   # re-vendor
    uv run python scripts/vendor_bundle.py --check                         # verify (CI)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUNDLE = ROOT / "src" / "pydantic_ai_hoja" / "_bundle"
MANIFEST = BUNDLE / "MANIFEST.json"
SOURCE_REPO = "hoja-work/hoja-claude-plugin"
#: The entry points the Python adapter starts. ``agy-hook`` and ``trace-hook`` are host-specific and not needed.
FILES = ("server.mjs", "api-proxy.mjs", "session-start.mjs")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(source: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(source), *args], check=True, capture_output=True, text=True).stdout.strip()


def vendor(source: Path) -> None:
    if git(source, "status", "--porcelain", "--", "dist", "src", "vendor"):
        sys.exit(f"{source} has uncommitted changes under dist/, src/ or vendor/; commit them first.")
    package = json.loads((source / "package.json").read_text())
    files = {}
    for name in FILES:
        data = (source / "dist" / name).read_bytes()
        (BUNDLE / name).write_bytes(data)
        files[name] = hashlib.sha256(data).hexdigest()
    manifest = {
        "source": SOURCE_REPO,
        "sourceCommit": git(source, "rev-parse", "HEAD"),
        "sourceVersion": package["version"],
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"vendored {len(files)} files from {SOURCE_REPO}@{manifest['sourceCommit'][:7]} ({package['version']})")


def check() -> None:
    manifest = json.loads(MANIFEST.read_text())
    bad = [
        name
        for name, digest in manifest["files"].items()
        if not (BUNDLE / name).is_file() or sha256(BUNDLE / name) != digest
    ]
    extra = sorted({p.name for p in BUNDLE.glob("*.mjs")} - set(manifest["files"]))
    if bad or extra:
        sys.exit(f"bundle mismatch: changed={bad} unlisted={extra}")
    source = f"{manifest['source']}@{manifest['sourceCommit'][:7]}"
    print(f"{len(manifest['files'])} bundle files match MANIFEST.json ({source})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--from", dest="source", type=Path, help="a hoja-claude-plugin checkout")
    group.add_argument("--check", action="store_true", help="verify the vendored files against MANIFEST.json")
    args = parser.parse_args()
    check() if args.check else vendor(args.source.resolve())


if __name__ == "__main__":
    main()
