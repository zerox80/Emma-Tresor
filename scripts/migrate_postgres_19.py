#!/usr/bin/env python3
"""Upgrade the Emma-Tresor Docker Compose database from PostgreSQL 16 to 19."""

import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / ".pg19-migration"
ACTIVE = STATE / "active.json"
ENV_FILE = ROOT / ".env"
PG16_MOUNT = "/var/lib/postgresql/data"
PG19_MOUNT = "/var/lib/postgresql"
COUNTS = """SELECT (SELECT count(*) FROM auth_user), (SELECT count(*) FROM inventory_item),
                   (SELECT count(*) FROM django_migrations)"""
COMPOSE = ["docker", "compose"]


def log(message):
    print(message, flush=True)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def output(*args, env=None):
    return subprocess.check_output(args, env=env, encoding="utf-8").strip()


def run(*args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def config(env=None):
    return json.loads(output(*COMPOSE, "config", "--format", "json", env=env))


def container(service="postgres"):
    ids = output(*COMPOSE, "ps", "--all", "--quiet", service).splitlines()
    require(len(ids) <= 1, f"Mehrere {service}-Container im Compose-Projekt gefunden.")
    return json.loads(output("docker", "inspect", ids[0]))[0] if ids else {}


def volume_at(info, path):
    return next((m["Name"] for m in info.get("Mounts", [])
                 if m["Destination"] == path and m["Type"] == "volume"), None)


def sql(query):
    return output(*COMPOSE, "exec", "-T", "postgres", "sh", "-ec",
                  'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"',
                  "sh", query)


def major():
    return int(sql("SHOW server_version_num")) // 10000


def up(*services, compose=None):
    run(*(compose or COMPOSE), "up", "-d", "--no-deps", "--wait", "--wait-timeout", "300", *services)


def start_backend():
    up("backend")
    run(*COMPOSE, "exec", "-T", "backend", "python", "manage.py", "migrate", "--check")


def replace_file(path, data):
    # Publish either the whole new file or the whole previous file, including after Ctrl-C.
    path = path.resolve()
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(data)
            tmp.flush()
            os.fsync(tmp.fileno())
        if path.exists():
            if os.name == "posix" and os.geteuid() == 0:
                stat = path.stat()
                os.chown(name, stat.st_uid, stat.st_gid)
            shutil.copymode(path, name)
        os.replace(name, path)
        if os.name == "posix":
            directory = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
    finally:
        Path(name).unlink(missing_ok=True)


def lock_checkout(lock):
    try:
        if os.name == "nt":
            import msvcrt
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (BlockingIOError, PermissionError):
        raise RuntimeError("Eine Migration in diesem Checkout läuft bereits.") from None


def journal(state, phase):
    replace_file(ACTIVE, json.dumps(dict(state, phase=phase)).encode())
    state["phase"] = phase


def ensure_source(state):
    info = container()
    if (volume_at(info, PG16_MOUNT) == state["source"] and "PG_MAJOR=16" in info["Config"]["Env"]
            and info["State"].get("Health", {}).get("Status") == "healthy"):
        if major() == 16:
            return
    old_config = STATE / state["run"] / "compose-pg16.json"
    up("postgres", compose=[*COMPOSE, "--project-directory", str(ROOT), "-f", str(old_config)])
    require(volume_at(container(), PG16_MOUNT) == state["source"] and major() == 16,
            "Altes Volume und PostgreSQL 16 konnten nicht bestätigt werden.")


def rollback(state):
    log("Stelle den Betrieb mit dem ursprünglichen 16er-Volume wieder her …")
    run(*COMPOSE, "stop", "nginx", "backend")
    saved = STATE / state["run"] / "env.pg16"
    replace_file(ENV_FILE, saved.read_bytes())
    ensure_source(state)
    up("backend")
    up("nginx")
    ACTIVE.unlink()
    log("PostgreSQL 16 läuft wieder. Für einen neuen Versuch denselben Befehl ausführen.")


def finish(state):
    up("nginx")
    ACTIVE.unlink()
    log(f"Fertig. PostgreSQL 19 läuft. Altes Volume: {state['source']}. Backup: {STATE / state['run']}")


def upgrade(state, folder, cfg):
    log(f"Wartungsfenster beginnt. PostgreSQL-Backup: {folder}")
    run(*COMPOSE, "stop", "nginx", "backend")
    ensure_source(state)
    extras = sql("""SELECT datname FROM pg_database WHERE NOT datistemplate
                    AND datname NOT IN (current_database(), 'postgres')
                    UNION ALL SELECT rolname FROM pg_roles
                    WHERE rolname !~ '^pg_' AND rolname <> current_user
                    UNION ALL SELECT spcname FROM pg_tablespace
                    WHERE spcname NOT IN ('pg_default', 'pg_global')""")
    require(not extras, "Zusätzliche Datenbanken, Rollen oder Tablespaces erfordern einen eigenen Cluster-Umzug.")
    before = sql(COUNTS)
    partial = folder / "emmatresor.dump.partial"
    with partial.open("xb") as archive:
        run(*COMPOSE, "exec", "-T", "postgres", "sh", "-ec",
            'exec pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdout=archive)
    with partial.open("rb") as archive:
        run(*COMPOSE, "exec", "-T", "postgres", "pg_restore", "--list",
            stdin=archive, stdout=subprocess.DEVNULL)
    dump = partial.rename(folder / "emmatresor.dump")
    log("Sichere öffentliche und private Uploads …")
    for name, mount in (("backend_media", "/vol/web/media"), ("backend_private_media", "/vol/web/private_media")):
        vol = cfg["volumes"][name]["name"]
        backend = container("backend")
        require(not backend or volume_at(backend, mount) == vol, f"Abweichendes Medienvolume für {mount}.")
        output("docker", "volume", "inspect", "--format", "{{.Name}}", vol)
        partial = folder / (name + ".tar.gz.partial")
        with partial.open("xb") as archive:
            run("docker", "run", "--rm", "--network", "none", "--entrypoint", "tar",
                "--mount", f"type=volume,source={vol},target=/media,readonly",
                cfg["services"]["postgres"]["image"], "-czf", "-", "-C", "/media", ".", stdout=archive)
        partial.rename(folder / (name + ".tar.gz"))
    run(*COMPOSE, "stop", "postgres")
    previous_env = (folder / "env.pg16").read_bytes()
    settings = f"\nPOSTGRES_VOLUME_NAME={state['target']}\n".encode()
    project_line = f"COMPOSE_PROJECT_NAME={state['project']}".encode()
    if project_line not in previous_env.splitlines():
        settings += project_line + b"\n"
    replace_file(ENV_FILE, previous_env + settings)
    actual = config()
    require(actual["volumes"]["postgres_data"]["name"] == state["target"],
            "Die Compose-Konfiguration verwendet ein anderes Zielvolume.")
    up("postgres")
    require(volume_at(container(), PG19_MOUNT) == state["target"] and major() == 19,
            "Zielvolume oder PostgreSQL-Version stimmt nicht.")
    require(sql("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'") == "0",
            "Das Ziel enthält bereits Tabellen.")
    log("Spiele den Dump in einer Transaktion ein …")
    with dump.open("rb") as archive:
        run(*COMPOSE, "exec", "-T", "postgres", "sh", "-ec",
            'exec pg_restore --single-transaction --exit-on-error --no-owner '
            '-U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdin=archive)
    require(sql(COUNTS) == before, "Bestandsvergleich nach dem Restore fehlgeschlagen.")
    start_backend()
    # Once traffic may reach 19, never switch back automatically and lose new writes.
    journal(state, "verified")
    finish(state)


def prepare(cfg):
    info = container()
    vol = cfg["volumes"]["postgres_data"]["name"]
    mounts = [m for m in cfg["services"]["postgres"]["volumes"] if m["target"] == PG19_MOUNT]
    require(len(mounts) == 1 and mounts[0].get("source") == "postgres_data",
            "Erwartet wird der PostgreSQL-19-Stand von docker-compose.yml.")
    if info:
        vol = volume_at(info, PG16_MOUNT) or volume_at(info, PG19_MOUNT)
        require(vol, "Die Datenbank verwendet kein unterstütztes Docker-Volume.")
    # Inspect before mounting: Docker would silently create an unknown named volume.
    output("docker", "volume", "inspect", "--format", "{{.Name}}", vol)
    image = cfg["services"]["postgres"]["image"]
    version = output("docker", "run", "--rm", "--network", "none", "--entrypoint", "sh",
                     "--mount", f"type=volume,source={vol},target=/source,readonly", image,
                     "-ec", "if test -s /source/19/docker/PG_VERSION; then cat /source/19/docker/PG_VERSION; "
                     "else cat /source/PG_VERSION; fi")
    if version == "19":
        require(vol == cfg["volumes"]["postgres_data"]["name"], "Aktives Volume und .env weichen voneinander ab.")
        up("postgres")
        require(major() == 19, "Unerwartete Serverversion.")
        sql(COUNTS)
        start_backend()
        up("nginx")
        log("PostgreSQL 19 läuft bereits. Der Datenbestand ist erreichbar.")
        return
    require(version == "16", f"Erwartet wurde PostgreSQL 16, gefunden wurde {version}.")
    require("POSTGRES_VOLUME_NAME" not in os.environ, "Bitte die Shell-Variable POSTGRES_VOLUME_NAME freigeben (.env wird automatisch verwaltet).")
    folder = Path(tempfile.mkdtemp(prefix="pg16-", dir=STATE))
    target = f"{vol}_pg19_{folder.name[5:]}"
    require(target not in output("docker", "volume", "ls", "-q").splitlines(), "Zielvolume existiert bereits.")
    plan = config(env=dict(os.environ, POSTGRES_VOLUME_NAME=target))
    require(plan["volumes"]["postgres_data"]["name"] == target, "Zielvolume kann nicht konfiguriert werden.")
    shutil.copyfile(ENV_FILE, folder / "env.pg16")
    # A Compose snapshot can restart the original cluster even after an interrupted cutover.
    old = config()
    pg = old["services"]["postgres"]
    pg["image"] = "postgres:16-alpine"
    if volume_at(info, PG16_MOUNT) and "PG_MAJOR=16" in info["Config"]["Env"]:
        pg["image"] = info["Config"]["Image"]
    for mount in pg["volumes"]:
        if mount["target"] == PG19_MOUNT:
            mount["target"] = PG16_MOUNT
    old["volumes"]["postgres_data"]["name"] = vol
    old["services"] = {"postgres": pg}
    (folder / "compose-pg16.json").write_text(json.dumps(old).replace("$", "$$"), encoding="utf-8")
    state = dict(project=cfg["name"], source=vol, target=target, run=folder.name)
    journal(state, "migrating")
    try:
        upgrade(state, folder, cfg)
    except (Exception, KeyboardInterrupt) as error:
        if state["phase"] == "migrating":
            log(f"Umstieg unterbrochen. {error}")
            rollback(state)
        raise


def main():
    os.chdir(ROOT)
    os.umask(0o077)
    require(ENV_FILE.is_file(), f"Deployment-Konfiguration fehlt: {ENV_FILE}")
    STATE.mkdir(exist_ok=True, mode=0o700)
    with (STATE / "lock").open("a+b") as lock:
        lock_checkout(lock)
        cfg = config()
        # Recover a project name supplied with 'docker compose -p' at deployment time.
        if not container() and not os.environ.get("COMPOSE_PROJECT_NAME"):
            projects = output("docker", "ps", "-a",
                              "--filter", "label=com.docker.compose.service=postgres",
                              "--filter", f"label=com.docker.compose.project.working_dir={ROOT}",
                              "--format", '{{.Label "com.docker.compose.project"}}').splitlines()
            projects = set(projects)
            require(len(projects) <= 1, "Mehrere Projekte in diesem Verzeichnis. COMPOSE_PROJECT_NAME angeben.")
            if projects:
                os.environ["COMPOSE_PROJECT_NAME"] = projects.pop()
                cfg = config()
        os.environ["COMPOSE_PROJECT_NAME"] = cfg["name"]
        if ACTIVE.exists():
            state = json.loads(ACTIVE.read_text())
            require(cfg["name"] == state["project"], "Das aktive Compose-Projekt hat sich geändert.")
            if state["phase"] == "verified":
                up("postgres")
                require(volume_at(container(), PG19_MOUNT) == state["target"] and major() == 19,
                        "Der geprüfte 19er-Datenbestand ist nicht aktiv.")
                start_backend()
                finish(state)
                return
            rollback(state)
            cfg = config()
        require(cfg["services"]["backend"].get("environment", {}).get("DB_VENDOR") == "postgres",
                "Das Backend verwendet PostgreSQL nicht.")
        prepare(cfg)


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()

    def interrupt(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(f"Migration abgebrochen. {error}", file=sys.stderr)
        sys.exit(1)
