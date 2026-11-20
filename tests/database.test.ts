import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres migration enforces RLS, publication, idempotency, optimistic locking and service-only budgets", async () => {
  const db = new PGlite();
  const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values('${a}'),('${b}');`);
    await db.exec(await readFile(new URL("../supabase/migrations/202611210001_customer_platform.sql", import.meta.url), "utf8"));
    const snapshots = await db.query<{ id: string }>("insert into catalog_snapshots(city_slug,payload,source_name) values ('hyderabad','{}','approved-test'),('hyderabad','{}','draft-test') returning id");
    await db.query("select publish_catalog($1)", [snapshots.rows[0].id]);
    await db.exec("set role anon");
    assert.equal((await db.query("select id,payload from catalog_snapshots")).rows.length, 1);
    await assert.rejects(db.query("select approved_by from catalog_snapshots"));
    await assert.rejects(db.query("select * from customer_states"));
    await assert.rejects(db.query("select publish_catalog($1)", [snapshots.rows[1].id]));
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    const first = await db.query<{ saved: { version: number } }>("select save_customer_state(0,$1::jsonb) as saved", [JSON.stringify({ savedIds: ["home-a"] })]);
    assert.equal(first.rows[0].saved.version, 1);
    assert.equal((await db.query<{ saved: unknown }>("select save_customer_state(0,'{}') as saved")).rows[0].saved, null);
    const attempts = await Promise.all(Array.from({ length: 10 }, () => db.query<{ saved: unknown }>("select save_customer_state(1,'{}') as saved")));
    assert.equal(attempts.filter(r => r.rows[0].saved !== null).length, 1);
    await assert.rejects(db.query("insert into customer_states(user_id) values($1)", [b]));
    await db.query("insert into viewing_requests(user_id,request_key,payload_hash,payload) values($1,$2,'hash','{}')", [a, a]);
    await assert.rejects(db.query("insert into viewing_requests(user_id,request_key,payload_hash,payload) values($1,$2,'hash','{}')", [a, a]));
    await assert.rejects(db.query("insert into viewing_requests(user_id,request_key,payload_hash,payload,status) values($1,$2,'hash','{}','confirmed')", [a, b]));
    await assert.rejects(db.query("insert into listing_submissions(user_id,request_key,payload_hash,payload,status) values($1,$2,'hash','{}','approved')", [a, a]));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    assert.equal((await db.query("select * from customer_states")).rows.length, 0);
    assert.equal((await db.query("select * from viewing_requests")).rows.length, 0);
    await assert.rejects(db.query("select consume_request_budget($1,2,60)", ["a".repeat(64)]));
    await db.exec("reset role; set role service_role");
    for (const expected of [true, true, false, false]) {
      assert.equal((await db.query<{ allowed: boolean }>("select consume_request_budget($1,2,60) as allowed", ["a".repeat(64)])).rows[0].allowed, expected);
    }
    await db.query("select publish_catalog($1)", [snapshots.rows[1].id]);
    await db.exec("reset role; set role anon");
    assert.deepEqual((await db.query<{ id: string }>("select id from catalog_snapshots")).rows.map(r => r.id), [snapshots.rows[1].id]);
  } finally { await db.close(); }
});
