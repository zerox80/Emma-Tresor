"""Setup script for the EmmaTresor backend.

This script creates a Python virtual environment, installs all required
backend dependencies, applies database migrations, and executes the test
suite. Run it once to bootstrap the project on a new machine.

Usage (Windows PowerShell):
    py -3.13 setup_backend.py
    py -3.13 setup_backend.py --use-venv

Optional flags:
    --skip-tests    Only prepare the environment (no `manage.py test`).
    --tests-only    Assume dependencies are already installed and run
                    tests immediately (fails if the virtualenv is missing).

If Python 3.13 is unavailable, replace the launcher with the version you
have installed, but ensure it is at least Python 3.12.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / ".venv"
IS_WINDOWS = os.name == "nt"


def get_venv_python() -> Path:
    """Return the interpreter path within the managed virtual environment.

    This function locates the Python executable within the project's virtual
    environment directory, supporting different naming conventions across
    platforms and Python versions.

    Returns:
        Path: Absolute path to the `.venv` Python executable.
    """
    bin_dir = VENV_DIR / ("Scripts" if IS_WINDOWS else "bin")
    candidates = ["python.exe"] if IS_WINDOWS else ["python3", "python", f"python{sys.version_info.major}.{sys.version_info.minor}"]
    for name in candidates:
        candidate = bin_dir / name
        if candidate.exists():
            return candidate
    return bin_dir / ("python.exe" if IS_WINDOWS else "python")


RUNTIME_PYTHON = Path(sys.executable)
USING_VENV = False
REQUIRED_PACKAGES = [
    "django==5.2.*",
    "djangorestframework>=3.15,<4.0",
    "djangorestframework-simplejwt>=5.3,<6.0",
    "django-cors-headers>=4.3,<5.0",
    "argon2-cffi>=23.1",
    "Pillow>=11.0,<12.0",
]


FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_PKG_MANAGER = "npm.cmd" if os.name == "nt" else "npm"


def run(command: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    """Execute a subprocess while streaming its output.

    This function executes a command with proper error handling and
    status reporting. It displays the command being executed
    and terminates with appropriate error messages if the command fails.

    Args:
        command (list[str]): Command and arguments to run.
        cwd (Path | None): Working directory for the subprocess.
        env (dict[str, str] | None): Environment overrides for the process.

    Raises:
        SystemExit: If the command exits with a non-zero status.
    """
    print(f"\n[setup] Executing: {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd or BASE_DIR, check=False, env=env)
    if result.returncode != 0:
        raise SystemExit(
            f"Command {' '.join(command)} failed with exit code {result.returncode}."
        )


def ensure_python_version() -> None:
    """Validate the interpreter version meets the minimum requirement.

    This function checks if the current Python interpreter version
    meets the minimum requirement of Python 3.12 for the
    EmmaTresor project.

    Raises:
        SystemExit: If Python is older than 3.12.
    """
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 12):
        raise SystemExit(
            "Python 3.12 or newer is required. Please rerun the script with an "
            "up-to-date interpreter (e.g., `py -3.13 setup_backend.py`)."
        )
    print(f"[setup] Using Python {major}.{minor} at {sys.executable}")


def create_virtualenv() -> None:
    """Create or refresh the `.venv` directory for backend dependencies."""
    if VENV_DIR.exists():
        interpreter = get_venv_python()
        if interpreter.exists():
            print(f"[setup] Reusing existing virtual environment at {VENV_DIR}")
            return
        print(f"[setup] Existing .venv appears incompatible (missing interpreter). Recreating.")
        # Remove the broken virtualenv directory and recreate
        if IS_WINDOWS:
            run(["cmd", "/c", "rmdir", "/s", "/q", str(VENV_DIR)])
        else:
            run(["rm", "-rf", str(VENV_DIR)])
    print(f"[setup] Creating virtual environment in {VENV_DIR}")
    run([sys.executable, "-m", "venv", str(VENV_DIR)])


def install_dependencies() -> None:
    """Install backend Python packages into the selected interpreter."""
    python = str(RUNTIME_PYTHON)
    run([python, "-m", "pip", "install", *REQUIRED_PACKAGES])


def install_frontend_dependencies() -> None:
    """Run `npm install` in the frontend directory when available."""
    if not FRONTEND_DIR.exists():
        print("[setup] Frontend directory not found, skipping frontend dependency installation.")
        return
    package_json = FRONTEND_DIR / "package.json"
    if not package_json.exists():
        print("[setup] package.json not found in frontend/, skipping frontend dependency installation.")
        return
    run([FRONTEND_PKG_MANAGER, "install"], cwd=FRONTEND_DIR)


def build_frontend() -> None:
    """Compile the frontend assets via the project's package scripts."""
    if not FRONTEND_DIR.exists():
        print("[setup] Frontend directory not found, skipping frontend build.")
        return
    package_json = FRONTEND_DIR / "package.json"
    if not package_json.exists():
        print("[setup] package.json not found in frontend/, skipping frontend build.")
        return
    run([FRONTEND_PKG_MANAGER, "run", "build"], cwd=FRONTEND_DIR)


def run_management_command(*args: str) -> None:
    """Execute a Django management command with the configured interpreter.

    Args:
        *args (str): Positional arguments passed to `manage.py`.
    """
    python = str(RUNTIME_PYTHON)
    env = None
    if USING_VENV:
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = str(VENV_DIR)
        bin_dir = VENV_DIR / ("Scripts" if IS_WINDOWS else "bin")
        separator = ";" if IS_WINDOWS else ":"
        env["PATH"] = f"{bin_dir}{separator}{env['PATH']}"
    run([python, "manage.py", *args], env=env)


def apply_migrations() -> None:
    """Apply all pending Django migrations."""
    run_management_command("migrate")


def run_tests() -> None:
    """Execute the Django unit test suite."""
    run_management_command("test")


def parse_args() -> argparse.Namespace:
    """Parse CLI switches for backend and frontend provisioning.

    Returns:
        argparse.Namespace: Parsed command-line options.
    """
    parser = argparse.ArgumentParser(description="Bootstrap or test the EmmaTresor backend.")
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Prepare the environment but skip running the Django test suite.",
    )
    parser.add_argument(
        "--tests-only",
        action="store_true",
        help="Run only the Django test suite using the existing virtual environment.",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Skip installing and building the frontend assets.",
    )
    parser.add_argument(
        "--frontend-only",
        action="store_true",
        help="Install and build the frontend without touching the backend environment.",
    )
    parser.add_argument(
        "--use-venv",
        action="store_true",
        help="Create or reuse the .venv/ directory and run backend steps inside it.",
    )
    args = parser.parse_args()
    if args.skip_tests and args.tests_only:
        parser.error("--skip-tests and --tests-only cannot be used together.")
    if args.frontend_only and args.tests_only:
        parser.error("--frontend-only and --tests-only cannot be used together.")
    if args.frontend_only and args.skip_tests:
        parser.error("--frontend-only and --skip-tests cannot be used together.")
    return args


def ensure_virtualenv_exists() -> None:
    """Ensure the `.venv` directory exists before running tests only.

    Raises:
        SystemExit: If the virtual environment interpreter is missing.
    """
    if not get_venv_python().exists():
        raise SystemExit(
            "Virtual environment not found. Run the script with --use-venv first "
            "to bootstrap dependencies, or run without --use-venv to use the system "
            "Python interpreter."
        )


def main() -> None:
    """Coordinate dependency installation, migrations, and optional tests."""
    args = parse_args()
    if args.frontend_only:
        install_frontend_dependencies()
        build_frontend()
        print("\n[setup] Frontend assets installed and built.")
        return

    ensure_python_version()

    global RUNTIME_PYTHON, USING_VENV

    if args.tests_only:
        USING_VENV = args.use_venv
        if USING_VENV:
            ensure_virtualenv_exists()
            RUNTIME_PYTHON = get_venv_python()
            print(f"[setup] Using virtual environment interpreter at {RUNTIME_PYTHON}")
        else:
            RUNTIME_PYTHON = Path(sys.executable)
            print(f"[setup] Using system Python interpreter at {RUNTIME_PYTHON}")
        run_tests()
        print("\n[setup] Test suite finished.")
        return

    USING_VENV = args.use_venv
    if USING_VENV:
        create_virtualenv()
        RUNTIME_PYTHON = get_venv_python()
        print(f"[setup] Using virtual environment interpreter at {RUNTIME_PYTHON}")
    else:
        RUNTIME_PYTHON = Path(sys.executable)
        print(f"[setup] Using system Python interpreter at {RUNTIME_PYTHON}")

    install_dependencies()
    apply_migrations()

    if not args.skip_frontend:
        install_frontend_dependencies()
        build_frontend()
    else:
        print("[setup] Frontend installation skipped as requested.")

    if args.skip_tests:
        print("\n[setup] Environment prepared. Tests were skipped as requested.")
        return

    run_tests()
    print("\n[setup] All steps completed successfully. Project is ready to use!")


if __name__ == "__main__":
    main()
