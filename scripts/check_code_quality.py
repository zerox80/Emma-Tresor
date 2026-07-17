#!/usr/bin/env python3
"""Enforce repository-wide size limits for hand-maintained code files."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path, PurePosixPath


MAX_FILE_LINES = 500

CODE_SUFFIXES = {
    ".css",
    ".html",
    ".py",
    ".ts",
    ".tsx",
}

EXCLUDED_PARTS = {".venv", "node_modules"}


def tracked_code_files(repository: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=repository,
        check=True,
        capture_output=True,
    )
    relative_paths = result.stdout.decode("utf-8").split("\0")
    code_files: list[Path] = []

    for relative_path in relative_paths:
        if not relative_path:
            continue
        posix_path = PurePosixPath(relative_path)
        if posix_path.suffix.lower() not in CODE_SUFFIXES:
            continue
        if EXCLUDED_PARTS.intersection(posix_path.parts):
            continue

        path = repository.joinpath(*posix_path.parts)
        if path.is_file():
            code_files.append(path)

    return code_files


def check_file(path: Path, repository: Path) -> list[str]:
    relative_path = path.relative_to(repository).as_posix()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as error:
        return [f"{relative_path}: not valid UTF-8 ({error})"]

    violations: list[str] = []
    if len(lines) > MAX_FILE_LINES:
        violations.append(
            f"{relative_path}: {len(lines)} lines (maximum {MAX_FILE_LINES})"
        )

    return violations


def main() -> int:
    repository = Path(__file__).resolve().parent.parent
    files = tracked_code_files(repository)
    violations = [
        violation
        for path in files
        for violation in check_file(path, repository)
    ]

    if violations:
        print("Code quality limits failed:", file=sys.stderr)
        for violation in violations:
            print(f"- {violation}", file=sys.stderr)
        return 1

    print(
        f"Checked {len(files)} code files: maximum {MAX_FILE_LINES} lines per file."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
