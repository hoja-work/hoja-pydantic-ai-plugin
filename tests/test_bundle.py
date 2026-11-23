import hashlib

from pydantic_ai_hoja.runtime.bundle import bundle_dir, manifest


def test_bundle_matches_manifest() -> None:
    files = manifest()["files"]
    assert set(files) == {"server.mjs", "api-proxy.mjs", "session-start.mjs"}
    for name, digest in files.items():
        assert hashlib.sha256((bundle_dir() / name).read_bytes()).hexdigest() == digest, name
    assert manifest()["source"] == "hoja-work/hoja-claude-plugin"
