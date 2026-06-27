import ssl, urllib.parse as up
import pg8000.dbapi as d
raw = open('.supabase_db_url').read().strip()
u = up.urlparse(raw)
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
c = d.connect(user=up.unquote(u.username), password=up.unquote(u.password),
              host=u.hostname, port=u.port or 5432, database=u.path.lstrip('/'), ssl_context=ctx)
cur=c.cursor()
def q(sql):
    cur.execute(sql); return cur.fetchall()
print("== app_admins ==")
for r in q("select email, created_at from app_admins order by 1"): print("  ", r)
print("== auth.users emails ==")
try:
    for r in q("select email, created_at, last_sign_in_at from auth.users order by 1"): print("  ", r)
except Exception as e: print("  ERR", str(e)[:80])
print("== function EXECUTE grants by role ==")
for r in q("""select p.proname, r.rolname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join aclexplode(p.proacl) a on true join pg_roles r on r.oid=a.grantee
  where n.nspname='public' and p.proname in ('check_app_license','validate_flowdashboard_license','is_app_admin')
    and a.privilege_type='EXECUTE' order by 1,2"""): print("  ", r)
print("== auth signup config (instances) - may not exist ==")
try:
    for r in q("select raw_base_config from auth.instances limit 1"): print("  ", str(r)[:200])
except Exception as e: print("  ERR", str(e)[:80])
c.close()
print("DONE")
