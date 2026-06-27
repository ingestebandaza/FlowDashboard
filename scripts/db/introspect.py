import sys, json, ssl, pathlib
from urllib.parse import urlparse, unquote
import pg8000.dbapi

ROOT = pathlib.Path(__file__).resolve().parents[2]
url_file = ROOT / ".supabase_db_url"
if not url_file.exists():
    print("ERROR: falta .supabase_db_url en la raiz del proyecto.")
    sys.exit(2)

raw = url_file.read_text(encoding="utf-8").strip()
u = urlparse(raw)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

conn = pg8000.dbapi.connect(
    user=unquote(u.username or ""),
    password=unquote(u.password or ""),
    host=u.hostname,
    port=u.port or 5432,
    database=(u.path or "/postgres").lstrip("/") or "postgres",
    ssl_context=ctx,
)
cur = conn.cursor()


def q(sql, args=None):
    cur.execute(sql, args or ())
    cols = [d[0] for d in cur.description] if cur.description else []
    return cols, cur.fetchall()


print("== CONNECTED ==", q("select current_user, version()")[1])

print("\n== PUBLIC TABLES ==")
_, rows = q("select table_name from information_schema.tables where table_schema='public' order by table_name")
print([r[0] for r in rows])

for t in ["app_licenses", "app_devices", "app_device_registrations", "app_access_logs", "app_admins"]:
    print(f"\n== COLUMNS {t} ==")
    _, rows = q("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name=%s order by ordinal_position", (t,))
    for r in rows:
        print("  ", r)

print("\n== ROW COUNTS ==")
for t in ["app_licenses", "app_devices", "app_device_registrations", "app_access_logs"]:
    try:
        print("  ", t, q(f"select count(*) from public.{t}")[1][0][0])
    except Exception as e:
        print("  ", t, "ERR", str(e)[:120])

print("\n== RLS STATUS (relrowsecurity / relforcerowsecurity) ==")
_, rows = q("select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname")
for r in rows:
    print("  ", r)

print("\n== POLICIES ==")
_, rows = q("select tablename, policyname, roles, cmd, qual from pg_policies where schemaname='public' order by tablename, policyname")
for r in rows:
    print("  ", r)

print("\n== FUNCTIONS (validate/check/is_admin) ==")
_, rows = q("""select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where p.proname in ('validate_flowdashboard_license','check_app_license','is_admin')
              order by p.proname""")
for r in rows:
    print("  ", r)

print("\n== GRANTS to anon/authenticated on legacy tables ==")
_, rows = q("""select table_name, grantee, privilege_type from information_schema.role_table_grants
              where table_schema='public' and grantee in ('anon','authenticated')
              and table_name in ('app_licenses','app_devices','app_device_registrations','app_access_logs')
              order by table_name, grantee, privilege_type""")
for r in rows:
    print("  ", r)

print("\n== FUNCTION GRANTS (EXECUTE) ==")
_, rows = q("""select p.proname, pg_get_function_identity_arguments(p.oid),
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname in ('validate_flowdashboard_license','check_app_license')""")
for r in rows:
    print("  ", r)

cur.close()
conn.close()
print("\n== DONE ==")
