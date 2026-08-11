-- 0018_reset_unverified_known_hosts.sql
-- Reset legacy SSH host fingerprints so all existing and new connections require explicit verification (VULN-01 fix)
DELETE FROM known_hosts;
