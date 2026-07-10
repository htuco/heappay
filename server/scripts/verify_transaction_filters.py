#!/usr/bin/env python3
"""
Smoke-test transaction filter API wiring (no database).

    cd server
    uv run python scripts/verify_transaction_filters.py
"""
from __future__ import annotations

import subprocess
import sys


def main() -> int:
    print("Running transaction filter API tests...\n")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_transaction_filters.py",
            "-v",
            "--tb=short",
        ],
        check=False,
    )
    if result.returncode == 0:
        print("\n✓ All filter API checks passed.")
        print("  Admin:  GET /transactions/all?status_id=&from_date=&user_role_name=...")
        print("  Admin:  GET /transactions/stats?...")
        print("  User:   GET /transactions?status_id=&from_date=&sort=...")
    else:
        print("\n✗ Some checks failed — see output above.")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
