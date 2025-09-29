"""Full development runner for EmmaTresor Inventory.

This script orchestrates both Django (backend) and Vite (frontend) workflows.
It ensures the Python virtual environment is prepared, runs migrations/tests
as requested, installs frontend dependencies, and can start the React dev
server alongside Django. Optional `.env` settings allow automated superuser
creation and runtime customisation.

Usage examples (PowerShell):
    py -3.13 run_backend.py                      # setup + tests + run backend
    py -3.13 run_backend.py --start-frontend     # setup + tests + run both servers
    py -3.13 run_backend.py --tests-only         # run tests and exit
    py -3.13 run_backend.py --skip-tests --start-frontend
    py -3.13 run_backend.py --use-venv            # run inside project virtualenv

Flags:
    --skip-tests       Skip running Django unit tests.
    --tests-only       Run Django tests only (no servers).
    --start-frontend   Start the Vite dev server after backend setup.
    --frontend-only    Run only the frontend setup/server (requires npm installed).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import textwrap
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SETUP_SCRIPT = BASE_DIR / "setup_backend.py"
VENV_DIR = BASE_DIR / ".venv"
IS_WINDOWS = os.name == "nt"


def get_venv_python() -> Path:
    bin_dir = VENV_DIR / ("Scripts" if IS_WINDOWS else "bin")
    candidates = ["python.exe"] if IS_WINDOWS else ["python3", "python", f"python{sys.version_info.major}.{sys.version_info.minor}"]
    for name in candidates:
        candidate = bin_dir / name
        if candidate.exists():
            return candidate
    if IS_WINDOWS:
        return bin_dir / "python.exe"
    # Prefer plain "python" as the safest fallback on POSIX systems
    return bin_dir / "python"


RUNTIME_PYTHON = Path(sys.executable)
USE_VENV = False
FRONTEND_DIR = BASE_DIR / "frontend"
NPM_EXECUTABLE = "npm.cmd" if IS_WINDOWS else "npm"
VITE_COMMAND = [
    NPM_EXECUTABLE,
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
]
ENV_FILES = [BASE_DIR / ".env", BASE_DIR / ".env.local"]


def load_env_file() -> dict[str, str]:
    env_vars: dict[str, str] = {}
    for env_path in ENV_FILES:
        if not env_path.exists():
            continue
        print(f"[runner] Loading environment variables from {env_path}")
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip('"').strip("'")
            env_vars[key.strip()] = value
    return env_vars


ENV_FROM_FILE = load_env_file()
if ENV_FROM_FILE:
    os.environ.update(ENV_FROM_FILE)


def run(command: list[str], *, cwd: Path | None = None, allow_failure: bool = False, env: dict[str, str] | None = None) -> None:
    location = cwd or BASE_DIR
    display = " ".join(command)
    print(f"[runner] Executing ({location}): {display}")
    result = subprocess.run(command, cwd=location, check=False, env=env)
    if result.returncode != 0:
        if allow_failure:
            print(
                f"[runner] Command failed (exit {result.returncode}) but continuing due to allow_failure=True"
            )
            return
        raise SystemExit(result.returncode)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap EmmaTresor Inventory backend and frontend for development.",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Prepare environment and start the backend server without running tests.",
    )
    parser.add_argument(
        "--tests-only",
        action="store_true",
        help="Run Django tests after setup and exit without starting any servers.",
    )
    parser.add_argument(
        "--start-frontend",
        action="store_true",
        help="Start the Vite dev server after the backend is running.",
    )
    parser.add_argument(
        "--frontend-only",
        action="store_true",
        help="Skip backend steps and only run the frontend setup/server.",
    )
    parser.add_argument(
        "--use-venv",
        action="store_true",
        help="Use the project virtual environment (.venv) for backend commands.",
    )
    args = parser.parse_args()
    if args.skip_tests and args.tests_only:
        parser.error("--skip-tests and --tests-only cannot be combined.")
    if args.frontend_only and args.tests_only:
        parser.error("--frontend-only cannot be combined with --tests-only.")
    return args


def ensure_frontend_dependencies() -> None:
    node_modules = FRONTEND_DIR / "node_modules"
    if node_modules.exists() and any(node_modules.iterdir()):
        print("[runner] Frontend dependencies already installed.")
        return
    print("[runner] Installing frontend dependencies via npm install...")
    run([NPM_EXECUTABLE, "install"], cwd=FRONTEND_DIR)


def start_frontend_server() -> subprocess.Popen[str]:
    print("[runner] Starting Vite dev server (frontend)...")
    env = os.environ.copy()
    env.setdefault("BROWSER", "none")
    process = subprocess.Popen(VITE_COMMAND, cwd=FRONTEND_DIR, env=env)
    print("[runner] Frontend server is running. Press Ctrl+C to stop.")
    return process


def ensure_setup(skip_tests: bool) -> None:
    setup_args = [sys.executable, str(SETUP_SCRIPT)]
    if skip_tests:
        setup_args.append("--skip-tests")
    if USE_VENV:
        setup_args.append("--use-venv")
    run(setup_args)


def python_env() -> dict[str, str] | None:
    if USE_VENV:
        env = os.environ.copy()
        venv_python = get_venv_python()
        venv_root = venv_python.parent.parent
        env["VIRTUAL_ENV"] = str(venv_root)
        if IS_WINDOWS:
            env["PATH"] = f"{venv_python.parent}{os.pathsep}{env['PATH']}"
        else:
            bin_dir = venv_root / "bin"
            env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
        return env
    return None


def run_tests() -> None:
    run([str(RUNTIME_PYTHON), "manage.py", "test"], env=python_env())


def create_superuser_if_configured() -> None:
    flag = os.environ.get("AUTO_CREATE_SUPERUSER", "false").lower()
    if flag not in {"1", "true", "yes"}:
        return

    username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
    password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
    email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")

    if not username or not password:
        print("[runner] AUTO_CREATE_SUPERUSER enabled but username/password missing. Skipping.")
        return

    script = textwrap.dedent(
        """
        from django.contrib.auth import get_user_model
        import os

        username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")

        if not username or not password:
            raise SystemExit("Missing credentials for auto superuser creation")

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email}
        )
        if created:
            user.is_superuser = True
            user.is_staff = True
            user.set_password(password)
            user.save()
            print(f"Superuser created: {username}")
        else:
            changed = False
            if email and user.email != email:
                user.email = email
                changed = True
            if not user.is_superuser or not user.is_staff:
                user.is_superuser = True
                user.is_staff = True
                changed = True
            if password:
                user.set_password(password)
                changed = True
            if changed:
                user.save()
                print(f"Superuser updated: {username}")
            else:
                print(f"Superuser already up to date: {username}")
        """
    )

    print("[runner] Ensuring configured superuser exists...")
    run([str(RUNTIME_PYTHON), "manage.py", "shell", "-c", script], env=python_env())


def main() -> None:
    args = parse_args()
    global USE_VENV
    USE_VENV = args.use_venv

    if args.frontend_only:
        ensure_frontend_dependencies()
        frontend_process = start_frontend_server()
        try:
            frontend_process.wait()
        except KeyboardInterrupt:
            frontend_process.terminate()
        return

    venv_python: Path | None = None
    if USE_VENV:
        venv_python = get_venv_python()
        if not venv_python.exists():
            print("[runner] Virtual environment not found or incompatible. Running full setup.")
            ensure_setup(skip_tests=False)
            venv_python = get_venv_python()
        else:
            ensure_setup(skip_tests=args.skip_tests)
    else:
        ensure_setup(skip_tests=args.skip_tests)

    global RUNTIME_PYTHON
    if USE_VENV:
        assert venv_python is not None
        if not venv_python.exists():
            raise SystemExit(
                "Virtual environment interpreter is missing even after setup. "
                "Delete the `.venv/` directory and rerun with --use-venv."
            )
        RUNTIME_PYTHON = venv_python
    else:
        RUNTIME_PYTHON = Path(sys.executable)
    print(f"[runner] Using Python interpreter at {RUNTIME_PYTHON}")

    create_superuser_if_configured()

    if args.tests_only:
        run_tests()
        print("[runner] Tests completed. Server not started due to --tests-only.")
        return

    if not args.skip_tests:
        run_tests()

    print("[runner] Starting Django development server...")
    backend_process = subprocess.Popen(
        [str(RUNTIME_PYTHON), "manage.py", "runserver"],
        cwd=BASE_DIR,
        env=python_env(),
    )

    frontend_process: subprocess.Popen[str] | None = None
    try:
        if args.start_frontend:
            ensure_frontend_dependencies()
            frontend_process = start_frontend_server()

        backend_process.wait()
    except KeyboardInterrupt:
        print("\n[runner] Stopping servers...")
        backend_process.terminate()
        if frontend_process:
            frontend_process.terminate()
    finally:
        backend_process.wait()
        if frontend_process:
            frontend_process.wait()


if __name__ == "__main__":
    main()
