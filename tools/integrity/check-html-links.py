#!/usr/bin/env python3
"""Check local static href/src references in HTML files without network access."""
from __future__ import annotations
import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SKIP_SCHEMES = {"http", "https", "mailto", "tel", "data", "javascript", "blob"}

class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base: str | None = None
        self.refs: list[tuple[str, str, int]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "base" and values.get("href") and self.base is None:
            self.base = values["href"]
        for attr in ("href", "src"):
            value = values.get(attr)
            if value:
                self.refs.append((attr, value, self.getpos()[0]))


def is_static_local(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith(("#", "//")):
        return False
    if any(token in value for token in ("${", "{{", "<%")):
        return False
    parsed = urlsplit(value)
    return parsed.scheme.lower() not in SKIP_SCHEMES and not parsed.netloc


def resolve(root: Path, html: Path, base: str | None, value: str) -> Path:
    raw = unquote(urlsplit(value).path)
    if raw.startswith("/"):
        return root / raw.lstrip("/")
    start = html.parent
    if base and is_static_local(base):
        base_path = unquote(urlsplit(base).path)
        if base_path.startswith("/"):
            start = root / base_path.lstrip("/")
        else:
            start = html.parent / base_path
        if start.suffix:
            start = start.parent
    return start / raw


def exists_as_web_path(path: Path) -> bool:
    return path.exists() or (path.is_dir() and (path / "index.html").exists()) or (not path.suffix and (path / "index.html").exists())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    failures: list[str] = []
    checked = 0
    for html in sorted(root.rglob("*.html")):
        rel_parts = html.relative_to(root).parts
        if any(part in {"node_modules", ".git"} for part in html.parts):
            continue
        if rel_parts and (rel_parts[0].startswith("formal-") or rel_parts[0] == "legacy-home"):
            continue
        doc = RefParser()
        try:
            doc.feed(html.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, OSError) as exc:
            failures.append(f"READ_ERROR {html.relative_to(root)}: {exc}")
            continue
        for attr, value, line in doc.refs:
            if not is_static_local(value):
                continue
            target = resolve(root, html, doc.base, value)
            checked += 1
            if not exists_as_web_path(target):
                failures.append(f"BROKEN_LINK {html.relative_to(root)}:{line} {attr}={value}")
    if failures:
        print("\n".join(failures))
        print(f"HTML_LINK_CHECK_FAILED checked={checked} broken={len(failures)}")
        return 1
    print(f"HTML_LINK_CHECK_OK checked={checked}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
