-- Multi-hop ProxyJump chains.
--
-- Replaces the single `hosts.jump_host_id` with an ordered list of hops.
-- `position` is 0-based and orders the chain from the closest hop to the
-- client outward. Hop 0 is dialled directly, hop 1 through hop 0, and so on,
-- with the target host reached from the final hop.
--
-- `hosts.jump_host_id` is retained and kept in sync with hop 0 so existing
-- readers (export, sync) keep working. The chain table is the source of truth.
--
-- NOTE the migration runner splits this file on the statement separator, so
-- that character must never appear inside a comment. Any text after it on the
-- line would be parsed as the start of a SQL statement.

CREATE TABLE IF NOT EXISTS host_jump_hops (
  host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  jump_host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  PRIMARY KEY (host_id, position)
);

CREATE INDEX IF NOT EXISTS ix_host_jump_hops_host ON host_jump_hops(host_id, position);
CREATE INDEX IF NOT EXISTS ix_host_jump_hops_jump ON host_jump_hops(jump_host_id);

-- Backfill existing single-hop configurations. Guarded by NOT EXISTS so the
-- migration stays re-runnable, and by a self-reference check so a host that
-- somehow points at itself does not become an unconnectable cycle.
INSERT INTO host_jump_hops (host_id, position, jump_host_id)
SELECT h.id, 0, h.jump_host_id
FROM hosts h
WHERE h.jump_host_id IS NOT NULL
  AND h.jump_host_id <> ''
  AND h.jump_host_id <> h.id
  AND NOT EXISTS (SELECT 1 FROM host_jump_hops j WHERE j.host_id = h.id);
