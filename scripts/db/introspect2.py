import ssl, urllib.parse as up
import pg8000.dbapi as d

raw = open('.supabase_db_url').read().strip()
u = up.urlparse(raw)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
c = d.connect(user=up.unquote(u.username), password=up.unquote(u.password),
              host=u.hostname, port=u.port or 5432, database=u.path.lstrip('/'),
              ssl_context=ctx)
cur = c.cursor()

def q(sql, *a):
    cur.execute(sql, a)
    return cur.fetchall()

print("== EXTENSIONS ==")
for r in q("select extname from pg_extension order by 1"):
    print("  ", r[0])

print("\n== CONSTRAINTS (public) ==")
for r in q("""select conrelid::regclass::text, conname, pg_get_constraintdef(oid)
              from pg_constraint where connamespace='public'::regnamespace order by 1,2"""):
    print("  ", r[0], "|", r[1], "|", r[2])

print("\n== INDEXES (public) ==")
for r in q("""select tablename, indexname, indexdef from pg_indexes
              where schemaname='public' order by 1,2"""):
    print("  ", r[2])

print("\n== validate_flowdashboard_license BODY ==")
for r in q("""select pg_get_functiondef(p.oid) from pg_proc p
              join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='validate_flowdashboard_license'"""):
    print(r[0])

print("\n== check_app_license BODY ==")
for r in q("""select pg_get_functiondef(p.oid) from pg_proc p
              join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='check_app_license'"""):
    print(r[0])

print("\n== is_app_admin BODY ==")
for r in q("""select pg_get_functiondef(p.oid) from pg_proc p
              join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='is_app_admin'"""):
    print(r[0])

print("\n== app_licenses status distinct ==")
for r in q("select status, count(*) from app_licenses group by 1"):
    print("  ", r)
print("== app_devices status distinct ==")
for r in q("select status, count(*) from app_devices group by 1"):
    print("  ", r)
print("\n== DONE ==")
c.close()
