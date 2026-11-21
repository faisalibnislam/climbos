"""Verify a Convex snapshot in two disposable local ClimbOS databases.

Uses the cached backend and installed CLI. Takes no destination, credentials,
or snapshot from the caller. Both instances contain synthetic data only.
"""
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import os
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
CLI = ["node", str(ROOT / "node_modules/convex/bin/main.js")]
RUNNER = ["node", str(ROOT / "scripts/local-demo.mjs")]
LOCAL = "http://127.0.0.1:3330"


def run(command, env):
    return subprocess.run(command, cwd=ROOT, env=env, capture_output=True,
                          text=True, check=True, timeout=180).stdout.strip()


@contextmanager
def database(directory):
    # Source and restore target use separate randomly keyed instances on the same port.
    for port in (3330, 3331):
        with socket.socket() as check:
            if check.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Local port {port} is in use. The drill needs an unused instance.")
    env = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR", "LANG") if key in os.environ}
    env["CLIMBOS_LOCAL_REAL_STATE_DIR"] = str(directory)
    process = subprocess.Popen([*RUNNER, "backend", "--real"], cwd=ROOT, env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.monotonic() + 30
        while True:
            if process.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("Disposable local backend did not start.")
            try:
                with socket.create_connection(("127.0.0.1", 3330), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        config = directory / "backend.env"
        lines = config.read_text().splitlines()
        if len(lines) != 2 or lines[0] != f"CONVEX_SELF_HOSTED_URL={LOCAL}" or not lines[1].startswith("CONVEX_SELF_HOSTED_ADMIN_KEY="):
            raise RuntimeError("Unexpected local instance configuration.")
        env.update(line.split("=", 1) for line in lines)
        run([*RUNNER, "sync", "--real"], env)

        def cli(*args):
            return run([*CLI, *args, "--env-file", str(config)], env)

        yield cli
    finally:
        process.terminate()
        process.wait(timeout=20)


def call(cli, name, args, user):
    identity = json.dumps({"subject": f"{user}|restore", "tokenIdentifier": f"test|{user}"})
    raw = cli("run", name, json.dumps(args), "--identity", identity)
    return json.loads(raw) if raw else None


def rows(cli, table):
    return json.loads(cli("data", table, "--format", "json", "--limit", "100") or "[]")


def verify():
    with TemporaryDirectory(prefix="climbos-restore-") as tmp:
        root = Path(tmp)
        snapshot = root / "fixture.zip"
        with database(root / "source") as cli:
            fixture = root / "users.json"
            fixture.write_text(json.dumps([{"name": name, "email": f"{name}@example.invalid"} for name in ("alpha", "beta")]))
            cli("import", "--table", "users", str(fixture))
            users = {row["name"]: row["_id"] for row in rows(cli, "users")}
            workspaces = {name: call(cli, "orgs:createWorkspace", {"businessName": f"Restore {name}"}, uid)
                          for name, uid in users.items()}
            slug = workspaces["alpha"]["slug"]
            deal = call(cli, "crm:create", {"slug": slug, "name": "Synthetic buyer"}, users["alpha"])
            text = "Buyer: This synthetic conversation exists only to verify snapshot recovery."
            call(cli, "crm:addTranscript", {"slug": slug, "id": deal, "expectedRevision": 0,
                 "title": "Recovery example", "sourceLabel": "Synthetic fixture", "text": text,
                 "permissionConfirmed": True, "permissionBasis": "Generated for this local restore drill"}, users["alpha"])
            tables = ("users", "organizations", "memberships", "deals", "dealTranscripts", "approvals", "actionReceipts")
            expected = {table: rows(cli, table) for table in tables}
            cli("export", "--path", str(snapshot), "--include-file-storage")
        with database(root / "target") as cli:
            if any(rows(cli, table) for table in tables):
                raise RuntimeError("Restore target was not empty.")
            cli("import", "--append", "--yes", str(snapshot))
            for table in tables:
                if rows(cli, table) != expected[table]:
                    raise RuntimeError(f"Restored rows differ in {table}.")
            args = {"slug": slug, "id": deal}
            record = call(cli, "crm:transcripts", args, users["alpha"])
            page = call(cli, "crm:transcripts", {**args, "expectedVersion": record["version"], "transcriptIndex": 1}, users["alpha"])
            if page["page"]["text"] != text:
                raise RuntimeError("Restored owner could not read the original source.")
            try:
                call(cli, "crm:transcripts", {**args, "slug": workspaces["beta"]["slug"]}, users["beta"])
            except subprocess.CalledProcessError as error:
                if not any(word in error.stderr.lower() for word in ("not found", "not_found", "access denied")):
                    raise RuntimeError("The other workspace failed for an unexpected reason.") from None
            else:
                raise RuntimeError("Restored source was visible across workspaces.")
    print("PASS: snapshot restored in a fresh instance, seven table comparisons, exact transcript read, cross-workspace denial.")


if __name__ == "__main__":
    try:
        verify()
    except subprocess.CalledProcessError as error:
        # CLI errors sometimes embed arguments. Keep local keys out of output.
        print("Local restore step failed:", error.cmd[2:4], "exit", error.returncode)
        if error.cmd[2] == "import" and "--append" in error.cmd:
            print(error.stderr[-1400:])
        raise SystemExit(1) from None
