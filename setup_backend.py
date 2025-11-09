#!/usr/bin/env python3
"""
EmmaTresor Backend Setup Script
================================

This script sets up the EmmaTresor backend development environment by:
- Creating and configuring virtual environments
- Installing Python dependencies
- Setting up the database (applying migrations)
- Installing and building frontend assets
- Running the test suite

The script can be run in various modes for different use cases:
- Full setup: Installs everything and runs tests
- Frontend only: Only handles frontend setup
- Tests only: Runs tests without setup
- Skip tests: Sets up environment without running tests

Usage Examples:
    python setup_backend.py                    # Full setup with tests
    python setup_backend.py --skip-tests       # Setup without tests
    python setup_backend.py --tests-only       # Run tests only
    python setup_backend.py --frontend-only    # Frontend setup only
    python setup_backend.py --use-venv         # Use virtual environment
"""

from __future__ import annotations        # Enable forward references for type hints

import argparse                           # Command line argument parsing
import os                                 # Operating system interface
import subprocess                          # Process execution and management
import sys                                 # System-specific parameters and functions
from pathlib import Path                   # Object-oriented filesystem path handling

# =========================
# GLOBAL CONFIGURATION
# =========================

# Base directory of the project (where this script is located)
BASE_DIR = Path(__file__).resolve().parent

# Virtual environment directory path
VENV_DIR = BASE_DIR / ".venv"

# Detect if running on Windows OS
IS_WINDOWS = os.name == "nt"

# Runtime Python interpreter (may be changed to venv Python)
RUNTIME_PYTHON = Path(sys.executable)

# Whether to use virtual environment for backend commands
USING_VENV = False

# Required Python packages for the backend
# These are the core dependencies needed for Django REST API functionality
REQUIRED_PACKAGES = [
    "django==5.2.*",                           # Django web framework (exact version)
    "djangorestframework>=3.15,<4.0",         # Django REST Framework
    "djangorestframework-simplejwt>=5.3,<6.0", # JWT authentication
    "django-cors-headers>=4.3,<5.0",           # CORS support
    "argon2-cffi>=23.1",                       # Password hashing
    "Pillow>=11.0,<12.0",                      # Image processing
]

# Frontend directory and package manager configuration
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_PKG_MANAGER = "npm.cmd" if os.name == "nt" else "npm"

# =========================
# HELPER FUNCTIONS
# =========================

def get_venv_python() -> Path:
    """
    Get the path to the Python executable inside the virtual environment.
    
    Returns:
        Path: Path to the virtual environment Python executable
        
    Note:
        On Windows, Python is in 'Scripts' directory, on Unix it's in 'bin'
    """
    
    # Determine the binary directory based on OS
    bin_dir = VENV_DIR / ("Scripts" if IS_WINDOWS else "bin")
    
    # List of possible Python executable names (platform-specific)
    candidates = ["python.exe"] if IS_WINDOWS else ["python3", "python", f"python{sys.version_info.major}.{sys.version_info.minor}"]
    
    # Try each candidate and return the first one that exists
    for name in candidates:
        candidate = bin_dir / name
        if candidate.exists():
            return candidate
    
    # Fallback to default executable name for the platform
    return bin_dir / ("python.exe" if IS_WINDOWS else "python")

def run(command: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    """
    Execute a shell command with proper error handling.
    
    Args:
        command: List of command arguments to execute
        cwd: Working directory for command execution (defaults to BASE_DIR)
        env: Environment variables for the command (defaults to current environment)
        
    Raises:
        SystemExit: If command fails
    """
    
    # Display what we're executing for debugging
    print(f"\n[setup] Executing: {' '.join(command)}")
    
    # Execute the command in the specified directory
    result = subprocess.run(command, cwd=cwd or BASE_DIR, check=False, env=env)
    
    # Handle command failure
    if result.returncode != 0:
        raise SystemExit(
            f"Command {' '.join(command)} failed with exit code {result.returncode}."
        )

def ensure_python_version() -> None:
    """
    Verify that Python version meets minimum requirements.
    
    Raises:
        SystemExit: If Python version is too old
        
    Note:
        Requires Python 3.12 or newer for modern Django features
    """
    
    # Get current Python version
    major, minor = sys.version_info[:2]
    
    # Check if version meets minimum requirements
    if (major, minor) < (3, 12):
        raise SystemExit(
            "Python 3.12 or newer is required. Please rerun the script with an "
            "up-to-date interpreter (e.g., `py -3.13 setup_backend.py`)."
        )
    
    print(f"[setup] Using Python {major}.{minor} at {sys.executable}")

def create_virtualenv() -> None:
    """
    Create a Python virtual environment if it doesn't exist or is incompatible.
    
    Note:
        - Recreates existing venv if Python executable is missing
        - Uses the built-in venv module for virtual environment creation
    """
    
    # Check if virtual environment already exists
    if VENV_DIR.exists():
        interpreter = get_venv_python()
        if interpreter.exists():
            print(f"[setup] Reusing existing virtual environment at {VENV_DIR}")
            return
        
        # Virtual environment exists but Python executable is missing
        print(f"[setup] Existing .venv appears incompatible (missing interpreter). Recreating.")
        
        # Remove the incompatible virtual environment
        if IS_WINDOWS:
            run(["cmd", "/c", "rmdir", "/s", "/q", str(VENV_DIR)])
        else:
            run(["rm", "-rf", str(VENV_DIR)])
    
    # Create new virtual environment
    print(f"[setup] Creating virtual environment in {VENV_DIR}")
    run([sys.executable, "-m", "venv", str(VENV_DIR)])

def install_dependencies() -> None:
    """
    Install required Python packages using pip.
    
    Installs all packages listed in REQUIRED_PACKAGES using the specified Python interpreter.
    This ensures all backend dependencies are available for Django to function properly.
    """
    
    python = str(RUNTIME_PYTHON)
    run([python, "-m", "pip", "install", *REQUIRED_PACKAGES])

def install_frontend_dependencies() -> None:
    """
    Install frontend Node.js dependencies using npm.
    
    Checks if frontend directory and package.json exist, then runs npm install.
    Skips installation if frontend directory or package.json is not found.
    """
    
    # Verify frontend directory exists
    if not FRONTEND_DIR.exists():
        print("[setup] Frontend directory not found, skipping frontend dependency installation.")
        return
    
    # Verify package.json exists
    package_json = FRONTEND_DIR / "package.json"
    if not package_json.exists():
        print("[setup] package.json not found in frontend/, skipping frontend dependency installation.")
        return
    
    # Install frontend dependencies
    run([FRONTEND_PKG_MANAGER, "install"], cwd=FRONTEND_DIR)

def build_frontend() -> None:
    """
    Build the frontend React application for production.
    
    Runs the npm build script to create optimized production assets.
    Skips build if frontend directory or package.json is not found.
    """
    
    # Verify frontend directory exists
    if not FRONTEND_DIR.exists():
        print("[setup] Frontend directory not found, skipping frontend build.")
        return
    
    # Verify package.json exists
    package_json = FRONTEND_DIR / "package.json"
    if not package_json.exists():
        print("[setup] package.json not found in frontend/, skipping frontend build.")
        return
    
    # Build frontend for production
    run([FRONTEND_PKG_MANAGER, "run", "build"], cwd=FRONTEND_DIR)

def run_management_command(*args: str) -> None:
    """
    Execute a Django management command.
    
    Args:
        *args: Arguments to pass to Django's manage.py
        
    Note:
        Sets up virtual environment variables if USING_VENV is True
        Uses the appropriate Python interpreter (system or venv)
    """
    
    python = str(RUNTIME_PYTHON)
    env = None
    
    # Set up virtual environment if enabled
    if USING_VENV:
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = str(VENV_DIR)
        bin_dir = VENV_DIR / ("Scripts" if IS_WINDOWS else "bin")
        separator = ";" if IS_WINDOWS else ":"
        env["PATH"] = f"{bin_dir}{separator}{env['PATH']}"
    
    # Execute Django management command
    run([python, "manage.py", *args], env=env)

def apply_migrations() -> None:
    """
    Apply Django database migrations.
    
    Runs Django's migrate command to create and update database tables.
    This ensures the database schema matches the current Django models.
    """
    
    run_management_command("migrate")

def run_tests() -> None:
    """
    Run the Django test suite.
    
    Executes Django's test command to run all tests in the project.
    This verifies that the application is working correctly after setup.
    """
    
    run_management_command("test")

def parse_args() -> argparse.Namespace:
    """
    Parse command line arguments for the setup script.
    
    Returns:
        argparse.Namespace: Parsed arguments object
        
    Raises:
        SystemExit: If invalid argument combinations are provided
    """
    
    # Create argument parser with description
    parser = argparse.ArgumentParser(description="Bootstrap or test the EmmaTresor backend.")
    
    # Add command line arguments
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
    
    # Parse arguments
    args = parser.parse_args()
    
    # Validate argument combinations
    if args.skip_tests and args.tests_only:
        parser.error("--skip-tests and --tests-only cannot be used together.")
    if args.frontend_only and args.tests_only:
        parser.error("--frontend-only and --tests-only cannot be used together.")
    if args.frontend_only and args.skip_tests:
        parser.error("--frontend-only and --skip-tests cannot be used together.")
    
    return args

def ensure_virtualenv_exists() -> None:
    """
    Verify that virtual environment exists and is usable.
    
    Raises:
        SystemExit: If virtual environment is not found
        
    Note:
        Called when using --tests-only with --use-venv to ensure venv is available
    """
    
    if not get_venv_python().exists():
        raise SystemExit(
            "Virtual environment not found. Run the script with --use-venv first "
            "to bootstrap dependencies, or run without --use-venv to use the system "
            "Python interpreter."
        )

def main() -> None:
    """
    Main entry point for the setup script.
    
    Parses arguments, sets up the environment, installs dependencies,
    applies migrations, and runs tests based on the provided arguments.
    """
    
    # Parse command line arguments
    args = parse_args()
    
    # Handle frontend-only mode
    if args.frontend_only:
        install_frontend_dependencies()
        build_frontend()
        print("\n[setup] Frontend assets installed and built.")
        return
    
    # Verify Python version for all backend operations
    ensure_python_version()
    
    # Global variables for Python interpreter and venv usage
    global RUNTIME_PYTHON, USING_VENV
    
    # Handle tests-only mode
    if args.tests_only:
        USING_VENV = args.use_venv
        
        # Set up Python interpreter based on venv usage
        if USING_VENV:
            ensure_virtualenv_exists()
            RUNTIME_PYTHON = get_venv_python()
            print(f"[setup] Using virtual environment interpreter at {RUNTIME_PYTHON}")
        else:
            RUNTIME_PYTHON = Path(sys.executable)
            print(f"[setup] Using system Python interpreter at {RUNTIME_PYTHON}")
        
        # Run tests and exit
        run_tests()
        print("\n[setup] Test suite finished.")
        return
    
    # Full setup mode
    USING_VENV = args.use_venv
    
    # Set up virtual environment if requested
    if USING_VENV:
        create_virtualenv()
        RUNTIME_PYTHON = get_venv_python()
        print(f"[setup] Using virtual environment interpreter at {RUNTIME_PYTHON}")
    else:
        RUNTIME_PYTHON = Path(sys.executable)
        print(f"[setup] Using system Python interpreter at {RUNTIME_PYTHON}")
    
    # Install Python dependencies
    install_dependencies()
    
    # Set up database
    apply_migrations()
    
    # Handle frontend setup (unless skipped)
    if not args.skip_frontend:
        install_frontend_dependencies()
        build_frontend()
    else:
        print("[setup] Frontend installation skipped as requested.")
    
    # Handle test execution
    if args.skip_tests:
        print("\n[setup] Environment prepared. Tests were skipped as requested.")
        return
    
    # Run tests to verify setup
    run_tests()
    print("\n[setup] All steps completed successfully. Project is ready to use!")

# =========================
# SCRIPT EXECUTION
# =========================

if __name__ == "__main__":
    main()
