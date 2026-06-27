import sys
import ssl
import pathlib
import argparse
from urllib.parse import urlparse, unquote

import pg8000.native

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIG_DIR = ROOT / "database" / "migrations"
ROLLBACK_DIR = MIG_DIR / "rollbacks"
URL_FILE = ROOT / ".supabase_db_url"

STEPS = [
    "001_preflight_backup",
    "002_commercial_model",
    "003_seed_migrate_legacy",
    "004_validate_v2",
    "005_rls_grants_cutover",
]


def connect():
    if not URL_FILE.exists():
        print("ERROR: falta .supabase_db_url en la raiz del proyecto.")
        sys.exit(2)
    raw = URL_FILE.read_text(encoding="utf-8").strip()
    u = urlparse(raw)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=unquote(u.username or ""),
        password=unquote(u.password or ""),
        host=u.hostname,
        port=u.port or 5432,
        database=(u.path or "/postgres").lstrip("/") or "postgres",
        ssl_context=ctx,
    )


def run_file(con, path):
    sql = path.read_text(encoding="utf-8")
    con.run(sql)


def verify_counts(con):
    def scalar(sql):
        try:
            return con.run(sql)[0][0]
        except Exception as exc:
            return "ERR:" + str(exc).splitlines()[0]

    print("  app_licenses:", scalar("select count(*) from public.app_licenses"))
    print("  app_devices:", scalar("select count(*) from public.app_devices"))
    print("  plans:", scalar("select count(*) from public.plans"))
    print("  plan_versions:", scalar("select count(*) from public.plan_versions"))
    print("  features:", scalar("select count(*) from public.features"))
    print("  plan_feature_entitlements:",
          scalar("select count(*) from public.plan_feature_entitlements"))
    print("  license_plan_assignments:",
          scalar("select count(*) from public.license_plan_assignments"))
    print("  license_installations:",
          scalar("select count(*) from public.license_installations"))
    print("  RLS-enabled tables:",
          scalar("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                 "where n.nspname='public' and c.relkind='r' and c.relrowsecurity"))


def main():
    ap = argparse.ArgumentParser(description="Aplica/revierte migraciones FASE 10.")
    ap.add_argument("--rollback", action="store_true", help="ejecuta rollbacks en orden inverso")
    ap.add_argument("--only", help="ejecuta solo el paso indicado (ej. 004)")
    ap.add_argument("--verify", action="store_true", help="solo imprime conteos/RLS y sale")
    args = ap.parse_args()

    con = connect()
    try:
        print("== CONNECTED ==", con.run("select current_user, version()")[0])

        if args.verify:
            print("\n== VERIFY ==")
            verify_counts(con)
            return

        steps = list(STEPS)
        if args.rollback:
            steps = list(reversed(steps))
        if args.only:
            steps = [s for s in steps if s.startswith(args.only)]
            if not steps:
                print("ERROR: ningun paso coincide con --only", args.only)
                sys.exit(2)

        for step in steps:
            if args.rollback:
                path = ROLLBACK_DIR / (step.split("_")[0] + "_rollback.sql")
            else:
                path = MIG_DIR / (step + ".sql")
            label = "ROLLBACK" if args.rollback else "APPLY"
            print(f"\n== {label} {path.name} ==")
            if not path.exists():
                print("  SKIP: archivo no encontrado", path)
                continue
            try:
                run_file(con, path)
                print("  OK")
            except Exception as exc:
                print("  FAIL:", str(exc))
                raise

        print("\n== POST-STATE ==")
        verify_counts(con)
    finally:
        con.close()


if __name__ == "__main__":
    main()
