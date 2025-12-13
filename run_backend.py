#!/usr/bin/env python3
"""
EmmaTresor Development Server Runner
====================================

This script provides a unified way to set up and run the EmmaTresor development environment.
It handles both backend (Django) and frontend (React/Vite) servers with various options.

Features:
- Automatic environment setup and dependency installation
- Virtual environment support
- Test execution
- Frontend and backend server management
- Superuser creation
- Graceful shutdown handling

Usage Examples:
    python run_backend.py                    # Full setup and run both servers
    python run_backend.py --skip-tests      # Skip tests and run servers
    python run_backend.py --tests-only      # Run tests only
    python run_backend.py --frontend-only   # Run frontend only
    python run_backend.py --use-venv        # Use virtual environment
"""

from __future__ import annotations        # Enable forward references for type hints

import argparse                           # Command line argument parsing
import os                                 # Operating system interface
import subprocess                          # Process execution and management
import sys                                 # System-specific parameters and functions
import textwrap                            # Text formatting and indentation utilities
from pathlib import Path                   # Object-oriented filesystem path handling

# =========================
# GLOBAL CONFIGURATION
# =========================

# Base directory of the project (where this script is located)
BASE_DIR = Path(__file__).resolve().parent

# Path to the backend setup script
SETUP_SCRIPT = BASE_DIR / "setup_backend.py"

# Virtual environment directory
VENV_DIR = BASE_DIR / ".venv"

# Detect if running on Windows OS
IS_WINDOWS = os.name == "nt"

# Frontend directory path
FRONTEND_DIR = BASE_DIR / "frontend"

# Backend directory path
BACKEND_DIR = BASE_DIR / "backend"

# Platform-specific npm executable name
NPM_EXECUTABLE = "npm.cmd" if IS_WINDOWS else "npm"

# Vite development server command configuration
VITE_COMMAND = [
    NPM_EXECUTABLE,           # npm executable
    "run",                   # npm run command
    "dev",                   # Vite dev server script
    "--",                    # Pass arguments to Vite
    "--host",                # Bind to specific host
    "127.0.0.1",            # Localhost IP address
    "--port",                # Port specification
    "5173",                  # Default Vite port
]

# Environment files to load (in order of precedence)
ENV_FILES = [BASE_DIR / ".env", BASE_DIR / ".env.local"]

# Runtime Python interpreter (may be changed to venv Python)
RUNTIME_PYTHON = Path(sys.executable)

# Whether to use virtual environment for backend commands
USE_VENV = False

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
    if IS_WINDOWS:
        return bin_dir / "python.exe"
    return bin_dir / "python"

def load_env_file() -> dict[str, str]:
    """
    Load environment variables from .env files.
    
    Returns:
        dict: Dictionary of environment variables loaded from files
        
    Note:
        Files are loaded in order: .env then .env.local (local overrides)
        Ignores comments, empty lines, and malformed entries
    """
    
    env_vars: dict[str, str] = {}
    
    # Process each environment file in order
    for env_path in ENV_FILES:
        if not env_path.exists():
            continue  # Skip non-existent files
            
        print(f"[runner] Loading environment variables from {env_path}")
        
        # Read file line by line and parse environment variables
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
                
            # Skip lines without equals sign (invalid format)
            if "=" not in line:
                continue
                
            # Split key and value at first equals sign
            key, value = line.split("=", 1)
            
            # Clean up the value (remove quotes and whitespace)
            value = value.strip().strip('"').strip("'")
            env_vars[key.strip()] = value
    
    return env_vars

def run(command: list[str], *, cwd: Path | None = None, allow_failure: bool = False, env: dict[str, str] | None = None) -> None:
    """
    Execute a shell command with proper error handling.
    
    Args:
        command: List of command arguments to execute
        cwd: Working directory for command execution (defaults to BASE_DIR)
        allow_failure: If True, continue execution even if command fails
        env: Environment variables for the command (defaults to current environment)
        
    Raises:
        SystemExit: If command fails and allow_failure is False
    """
    
    # Determine working directory
    location = cwd or BASE_DIR
    
    # Display what we're executing for debugging
    display = " ".join(command)
    print(f"[runner] Executing ({location}): {display}")
    
    # Execute the command without raising exceptions on failure
    result = subprocess.run(command, cwd=location, check=False, env=env)
    
    # Handle command failure
    if result.returncode != 0:
        if allow_failure:
            print(f"[runner] Command failed (exit {result.returncode}) but continuing due to allow_failure=True")
            return
        raise SystemExit(result.returncode)

def parse_args() -> argparse.Namespace:
    """
    Parse command line arguments for the runner script.
    
    Returns:
        argparse.Namespace: Parsed arguments object
        
    Raises:
        SystemExit: If invalid argument combinations are provided
    """
    
    # Create argument parser with description
    parser = argparse.ArgumentParser(
        description="Bootstrap EmmaTresor Inventory backend and frontend for development.",
    )
    
    # Add command line arguments
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
    
    # Parse arguments
    args = parser.parse_args()
    
    # Validate argument combinations
    if args.skip_tests and args.tests_only:
        parser.error("--skip-tests and --tests-only cannot be combined.")
    if args.frontend_only and args.tests_only:
        parser.error("--frontend-only cannot be combined with --tests-only.")
    
    return args

def ensure_frontend_dependencies() -> None:
    """
    Ensure frontend dependencies are installed.
    
    Checks if node_modules exists and has content, runs npm install if needed.
    This ensures the frontend has all required packages before starting the dev server.
    """
    
    node_modules = FRONTEND_DIR / "node_modules"
    
    # Check if dependencies are already installed
    if node_modules.exists() and any(node_modules.iterdir()):
        print("[runner] Frontend dependencies already installed.")
        return
    
    # Install dependencies if not present
    print("[runner] Installing frontend dependencies via npm install...")
    run([NPM_EXECUTABLE, "install"], cwd=FRONTEND_DIR)

def start_frontend_server() -> subprocess.Popen[str]:
    """
    Start the Vite development server for the frontend.
    
    Returns:
        subprocess.Popen: Process object for the running frontend server
        
    Note:
        Sets BROWSER=none to prevent automatic browser opening
        The server runs on http://127.0.0.1:5173 by default
    """
    
    print("[runner] Starting Vite dev server (frontend)...")
    
    # Prepare environment with BROWSER=none to prevent auto-opening
    env = os.environ.copy()
    env.setdefault("BROWSER", "none")
    
    # Start the Vite dev server process
    process = subprocess.Popen(VITE_COMMAND, cwd=FRONTEND_DIR, env=env)
    print("[runner] Frontend server is running. Press Ctrl+C to stop.")
    
    return process

def ensure_setup(skip_tests: bool) -> None:
    """
    Ensure the backend environment is properly set up.
    
    Args:
        skip_tests: Whether to skip running tests during setup
        
    Runs the setup_backend.py script to install dependencies,
        apply migrations, and prepare the Django environment.
    """
    
    # Build setup script arguments
    setup_args = [sys.executable, str(SETUP_SCRIPT)]
    if skip_tests:
        setup_args.append("--skip-tests")
    if USE_VENV:
        setup_args.append("--use-venv")
    
    # Execute the setup script
    run(setup_args)

def python_env() -> dict[str, str] | None:
    """
    Create environment variables for Python execution in virtual environment.
    
    Returns:
        dict | None: Environment variables with virtual environment activated,
                    or None if not using virtual environment
                    
    Note:
        Sets VIRTUAL_ENV and modifies PATH to use venv Python
    """
    
    if not USE_VENV:
        return None
    
    # Copy current environment
    env = os.environ.copy()
    
    # Get virtual environment Python path
    venv_python = get_venv_python()
    venv_root = venv_python.parent.parent
    
    # Set virtual environment indicator
    env["VIRTUAL_ENV"] = str(venv_root)
    
    # Update PATH to include virtual environment binaries
    if IS_WINDOWS:
        env["PATH"] = f"{venv_python.parent}{os.pathsep}{env['PATH']}"
    else:
        bin_dir = venv_root / "bin"
        env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    
    return env

def run_tests() -> None:
    """
    Run the Django test suite.
    
    Executes the Django test command to run all tests in the project.
    Uses the appropriate Python interpreter (system or virtual environment).
    """
    
    run([str(RUNTIME_PYTHON), "manage.py", "test"], cwd=BACKEND_DIR, env=python_env())

def create_superuser_if_configured() -> None:
    """
    Automatically create a Django superuser if configured in environment.
    
    Checks the AUTO_CREATE_SUPERUSER environment variable and creates a superuser
    with the configured credentials if enabled and credentials are provided.
    """
    
    # Check if superuser creation is enabled
    flag = os.environ.get("AUTO_CREATE_SUPERUSER", "false").lower()
    if flag not in {"1", "true", "yes"}:
        return
    
    # Get superuser credentials from environment
    username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
    password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
    email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
    
    # Validate required credentials
    if not username or not password:
        print("[runner] AUTO_CREATE_SUPERUSER enabled but username/password missing. Skipping.")
        return
    
    # Create Django shell script to ensure superuser exists
    script = textwrap.dedent("""
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        if not User.objects.filter(username='{username}').exists():
            User.objects.create_superuser('{username}', '{email}', '{password}')
            print(f"Created superuser: {username}")
        else:
            print(f"Superuser already exists: {username}")
    """).format(username=username, email=email, password=password)
    
    print("[runner] Ensuring configured superuser exists...")
    run([str(RUNTIME_PYTHON), "manage.py", "shell", "-c", script], cwd=BACKEND_DIR, env=python_env())

def main() -> None:
    """
    Main entry point for the development server runner.
    
    Parses arguments, sets up the environment, starts servers,
    and handles graceful shutdown on Ctrl+C.
    """
    
    # Parse command line arguments
    args = parse_args()
    global USE_VENV
    USE_VENV = args.use_venv
    
    # Handle frontend-only mode
    if args.frontend_only:
        ensure_frontend_dependencies()
        frontend_process = start_frontend_server()
        try:
            frontend_process.wait()  # Wait for process to finish
        except KeyboardInterrupt:
            frontend_process.terminate()  # Graceful shutdown
        return
    
    # Handle backend setup
    venv_python: Path | None = None
    if USE_VENV:
        venv_python = get_venv_python()
        if not venv_python.exists():
            print("[runner] Virtual environment not found or incompatible. Running full setup.")
            ensure_setup(skip_tests=False)  # Full setup including tests
            venv_python = get_venv_python()
        else:
            ensure_setup(skip_tests=args.skip_tests)  # Setup with optional test skip
    else:
        ensure_setup(skip_tests=args.skip_tests)
    
    # Determine which Python interpreter to use
    global RUNTIME_PYTHON
    if USE_VENV:
        assert venv_python is not None  # Type assertion for mypy
        if not venv_python.exists():
            raise SystemExit(
                "Virtual environment interpreter is missing even after setup. "
                "Delete the `.venv/` directory and rerun with --use-venv."
            )
        RUNTIME_PYTHON = venv_python
    else:
        RUNTIME_PYTHON = Path(sys.executable)
    
    print(f"[runner] Using Python interpreter at {RUNTIME_PYTHON}")
    
    # Create superuser if configured
    create_superuser_if_configured()
    
    # Handle tests-only mode
    if args.tests_only:
        run_tests()
        print("[runner] Tests completed. Server not started due to --tests-only.")
        return
    
    # Run tests unless explicitly skipped
    if not args.skip_tests:
        run_tests()
    
    # Start Django development server
    print("[runner] Starting Django development server...")
    backend_process = subprocess.Popen(
        [str(RUNTIME_PYTHON), "manage.py", "runserver"],
        cwd=BACKEND_DIR,
        env=python_env(),
    )
    
    # Start frontend server if requested
    frontend_process: subprocess.Popen[str] | None = None
    try:
        if args.start_frontend:
            ensure_frontend_dependencies()
            frontend_process = start_frontend_server()
        
        # Wait for backend process to finish (usually runs forever)
        backend_process.wait()
    except KeyboardInterrupt:
        # Handle Ctrl+C gracefully
        print("\n[runner] Stopping servers...")
        backend_process.terminate()
        if frontend_process:
            frontend_process.terminate()
    finally:
        # Ensure all processes are properly terminated
        backend_process.wait()
        if frontend_process:
            frontend_process.wait()

# =========================
# SCRIPT EXECUTION
# =========================

if __name__ == "__main__":
    main()
