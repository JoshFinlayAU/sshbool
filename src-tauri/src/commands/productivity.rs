//! Productivity, settings, search.

use application::{AppInfoDto, NoteDto, SearchResultDto, SnippetDto, TemplateDto};
use infrastructure::AppState;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;

fn db(e: sqlx::Error) -> AppError {
    AppError::Db {
        engine: "sqlite".into(),
        message: e.to_string(),
    }
}

#[tauri::command]
pub async fn snippets_list(state: State<'_, Arc<AppState>>) -> Result<Vec<SnippetDto>, AppError> {
    let rows: Vec<(String, String, String, Option<String>, Option<String>, Option<String>, i64, i64)> =
        sqlx::query_as(
            "SELECT id, name, body, language, tags_json, shortcut, usage_count, is_favorite FROM snippets ORDER BY name",
        )
        .fetch_all(state.vault.pool())
        .await
        .map_err(db)?;
    Ok(rows
        .into_iter()
        .map(
            |(id, name, body, language, tags_json, shortcut, usage_count, is_favorite)| {
                SnippetDto {
                    id,
                    name,
                    body,
                    language,
                    tags_json,
                    shortcut,
                    usage_count,
                    is_favorite: is_favorite != 0,
                }
            },
        )
        .collect())
}

#[tauri::command]
pub async fn snippets_upsert(
    state: State<'_, Arc<AppState>>,
    snippet: serde_json::Value,
) -> Result<String, AppError> {
    let name = snippet["name"].as_str().unwrap_or("").to_string();
    let body = snippet["body"].as_str().unwrap_or("").to_string();
    let id = snippet["id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::now_v7().to_string());
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO snippets (id, name, body, language, tags_json, shortcut, usage_count, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, body=excluded.body, updated_at=excluded.updated_at"#,
    )
    .bind(&id)
    .bind(&name)
    .bind(&body)
    .bind(now)
    .bind(now)
    .execute(state.vault.pool())
    .await
    .map_err(db)?;
    Ok(id)
}

#[tauri::command]
pub async fn snippets_delete(state: State<'_, Arc<AppState>>, id: String) -> Result<(), AppError> {
    sqlx::query("DELETE FROM snippets WHERE id = ?")
        .bind(&id)
        .execute(state.vault.pool())
        .await
        .map_err(db)?;
    Ok(())
}

#[tauri::command]
pub async fn snippets_run(
    state: State<'_, Arc<AppState>>,
    id: String,
    pane_id: String,
) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT body FROM snippets WHERE id = ?")
        .bind(&id)
        .fetch_optional(state.vault.pool())
        .await
        .map_err(db)?;
    let Some((body,)) = row else {
        return Err(AppError::NotFound {
            entity: "snippet".into(),
            id: Some(id),
        });
    };
    state
        .connections
        .pane_write(&pane_id, body.as_bytes())
        .await?;
    sqlx::query("UPDATE snippets SET usage_count = usage_count + 1 WHERE id = ?")
        .bind(&id)
        .execute(state.vault.pool())
        .await
        .ok();
    Ok(())
}

#[tauri::command]
pub async fn notes_list(
    state: State<'_, Arc<AppState>>,
    host_id: Option<String>,
) -> Result<Vec<NoteDto>, AppError> {
    let rows: Vec<(String, Option<String>, String, String, Option<String>, i64)> = if let Some(
        hid,
    ) = host_id
    {
        sqlx::query_as(
            "SELECT id, host_id, title, body_md, color, pinned FROM notes WHERE host_id = ? OR host_id IS NULL ORDER BY pinned DESC, updated_at DESC",
        )
        .bind(&hid)
        .fetch_all(state.vault.pool())
        .await
        .map_err(db)?
    } else {
        sqlx::query_as(
            "SELECT id, host_id, title, body_md, color, pinned FROM notes ORDER BY pinned DESC, updated_at DESC",
        )
        .fetch_all(state.vault.pool())
        .await
        .map_err(db)?
    };
    Ok(rows
        .into_iter()
        .map(|(id, host_id, title, body_md, color, pinned)| NoteDto {
            id,
            host_id,
            title,
            body_md,
            color,
            pinned: pinned != 0,
        })
        .collect())
}

#[tauri::command]
pub async fn notes_upsert(
    state: State<'_, Arc<AppState>>,
    note: serde_json::Value,
) -> Result<String, AppError> {
    let title = note["title"].as_str().unwrap_or("").to_string();
    let body_md = note["bodyMd"].as_str().unwrap_or("").to_string();
    let host_id = note["hostId"].as_str().map(|s| s.to_string());
    let id = note["id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::now_v7().to_string());
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO notes (id, host_id, title, body_md, color, pinned, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, 0, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, body_md=excluded.body_md, host_id=excluded.host_id, updated_at=excluded.updated_at"#,
    )
    .bind(&id)
    .bind(&host_id)
    .bind(&title)
    .bind(&body_md)
    .bind(now)
    .bind(now)
    .execute(state.vault.pool())
    .await
    .map_err(db)?;
    Ok(id)
}

#[tauri::command]
pub async fn notes_delete(state: State<'_, Arc<AppState>>, id: String) -> Result<(), AppError> {
    sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(state.vault.pool())
        .await
        .map_err(db)?;
    Ok(())
}

#[tauri::command]
pub async fn templates_list(state: State<'_, Arc<AppState>>) -> Result<Vec<TemplateDto>, AppError> {
    let rows: Vec<(String, String, String, String, Option<String>)> =
        sqlx::query_as("SELECT id, name, kind, body, variables_json FROM templates ORDER BY name")
            .fetch_all(state.vault.pool())
            .await
            .map_err(db)?;
    Ok(rows
        .into_iter()
        .map(|(id, name, kind, body, variables_json)| TemplateDto {
            id,
            name,
            kind,
            body,
            variables_json,
        })
        .collect())
}

#[tauri::command]
pub async fn templates_render(
    state: State<'_, Arc<AppState>>,
    id: String,
    vars: std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT body FROM templates WHERE id = ?")
        .bind(&id)
        .fetch_optional(state.vault.pool())
        .await
        .map_err(db)?;
    let Some((mut body,)) = row else {
        return Err(AppError::NotFound {
            entity: "template".into(),
            id: Some(id),
        });
    };
    for (k, v) in vars {
        body = body.replace(&format!("{{{{{k}}}}}"), &v);
    }
    Ok(serde_json::json!({ "body": body }))
}

/// Split a query into terms and build a `LIKE` clause requiring *all* of them.
///
/// A single `LIKE '%the whole query%'` only matches when the words appear
/// together in that exact order, so searching "kam switch" misses a host
/// labelled "KAM - 383 Switch". Matching each term independently is what users
/// expect from a search box.
///
/// Returns the SQL fragment and the bind values, or `None` for a blank query.
/// `%` and `_` are escaped so a literal underscore in a hostname does not act
/// as a wildcard.
fn all_terms_clause(query: &str, columns: &[&str]) -> Option<(String, Vec<String>)> {
    let terms: Vec<&str> = query.split_whitespace().collect();
    if terms.is_empty() {
        return None;
    }

    let mut clauses = Vec::new();
    let mut binds = Vec::new();
    for term in terms {
        let escaped = term
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let per_column: Vec<String> = columns
            .iter()
            .map(|c| format!("{c} LIKE ? ESCAPE '\\'"))
            .collect();
        clauses.push(format!("({})", per_column.join(" OR ")));
        for _ in columns {
            binds.push(format!("%{escaped}%"));
        }
    }
    Some((clauses.join(" AND "), binds))
}

/// Reduce a string to lowercase alphanumerics.
///
/// Host naming is inconsistent about separators — a real fleet contains both
/// "Cloud Plus VPN" and "cloudplus-vpn". Comparing squashed forms makes
/// "cloudplus", "cloud plus" and "cloud-plus" all match both of them.
fn squash(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// Levenshtein distance, abandoned once it provably exceeds `max`.
///
/// The early exit matters: this runs per candidate per keystroke, and the
/// full matrix on long strings would be wasted work when we only care about
/// near-misses.
fn edit_distance_within(a: &str, b: &str, max: usize) -> Option<usize> {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    if a.len().abs_diff(b.len()) > max {
        return None;
    }

    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut curr = vec![0usize; b.len() + 1];

    for (i, ca) in a.iter().enumerate() {
        curr[0] = i + 1;
        let mut row_best = curr[0];
        for (j, cb) in b.iter().enumerate() {
            let cost = usize::from(ca != cb);
            curr[j + 1] = (prev[j] + cost).min(prev[j + 1] + 1).min(curr[j] + 1);
            row_best = row_best.min(curr[j + 1]);
        }
        if row_best > max {
            return None;
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    let distance = prev[b.len()];
    (distance <= max).then_some(distance)
}

/// Typo budget for a query of this length.
///
/// Scaled so short queries stay strict — allowing 2 edits on a 4-character
/// query would match almost anything.
fn typo_budget(query_len: usize) -> usize {
    match query_len {
        0..=3 => 0,
        4..=6 => 1,
        _ => 2,
    }
}

/// Whether a query looks like an address rather than a name.
///
/// Fuzzy matching is actively harmful here: every IP in a /24 squashes to a
/// digit string within two edits of its neighbours, so searching for
/// "10.10.0.52" on a real fleet fuzzy-matched 32 hosts. An address is either
/// right or it is a different machine, so these are matched literally.
fn looks_like_address(query: &str) -> bool {
    let trimmed = query.trim();
    !trimmed.is_empty()
        && trimmed
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.' || c == ':')
        && trimmed.chars().any(|c| c.is_ascii_digit())
}

/// How well a result matches, lowest first.
///
/// Ordering, best to worst: exact, prefix, substring, separator-insensitive
/// (cloudplus ↔ cloud plus), all-terms-present, then fuzzy near-miss.
fn match_rank(title: &str, subtitle: Option<&str>, query: &str) -> u8 {
    const EXACT: u8 = 0;
    const PREFIX: u8 = 1;
    const SUBSTRING: u8 = 2;
    const SQUASHED: u8 = 3;
    const ALL_TERMS: u8 = 4;
    const FUZZY: u8 = 5;

    let q = query.trim().to_lowercase();
    let fields = [
        title.to_lowercase(),
        subtitle.unwrap_or_default().to_lowercase(),
    ];

    if fields.contains(&q) {
        return EXACT;
    }
    if fields.iter().any(|f| f.starts_with(&q)) {
        return PREFIX;
    }
    if fields.iter().any(|f| f.contains(&q)) {
        return SUBSTRING;
    }

    // Separator-insensitive: "cloudplus" should find "Cloud Plus VPN".
    // Skipped for addresses, where stripping dots makes unrelated IPs collide.
    let sq = squash(&q);
    if !looks_like_address(&q) && !sq.is_empty() && fields.iter().any(|f| squash(f).contains(&sq)) {
        return SQUASHED;
    }

    // Every term present somewhere, just not as a contiguous phrase.
    let terms: Vec<&str> = q.split_whitespace().collect();
    if terms.len() > 1 && terms.iter().all(|t| fields.iter().any(|f| f.contains(t))) {
        return ALL_TERMS;
    }

    FUZZY
}

/// Whether a candidate is a plausible typo of the query.
///
/// Compares squashed forms so separator differences aren't spent from the
/// typo budget, and slides the query along longer targets so a misspelling of
/// one word still matches a multi-word label.
fn is_fuzzy_match(title: &str, subtitle: Option<&str>, query: &str) -> bool {
    // Addresses must match literally — see `looks_like_address`.
    if looks_like_address(query) {
        return false;
    }
    let sq = squash(query);
    if sq.is_empty() {
        return false;
    }
    let budget = typo_budget(sq.len());
    if budget == 0 {
        return false;
    }

    [title, subtitle.unwrap_or_default()]
        .iter()
        .filter(|f| !f.is_empty())
        .any(|field| {
            let target = squash(field);
            if target.is_empty() {
                return false;
            }
            if edit_distance_within(&sq, &target, budget).is_some() {
                return true;
            }
            // Window the query across a longer target so "clodplus" still
            // matches "cloudplusvpn".
            let chars: Vec<char> = target.chars().collect();
            let window = sq.chars().count();
            if chars.len() <= window {
                return false;
            }
            (0..=chars.len() - window).any(|start| {
                let end = (start + window + budget).min(chars.len());
                let slice: String = chars[start..end].iter().collect();
                edit_distance_within(&sq, &slice, budget).is_some()
            })
        })
}

/// Search hosts, snippets and notes in one pass.
///
/// Results are ranked by how closely they match and capped per kind, so the
/// caller can render a single ordered list.
#[tauri::command]
pub async fn search_global(
    state: State<'_, Arc<AppState>>,
    query: String,
) -> Result<Vec<SearchResultDto>, AppError> {
    /// Per-kind cap. Generous enough to be useful, small enough that the UI
    /// stays responsive on a large host list.
    const PER_KIND_LIMIT: usize = 20;

    /// Cap on rows pulled for the separator-insensitive / fuzzy pass. SQL
    /// `LIKE` cannot express those, so candidates are filtered in Rust.
    const FUZZY_SCAN_LIMIT: i64 = 2_000;

    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let mut out: Vec<(u8, SearchResultDto)> = Vec::new();
    let mut seen_hosts: std::collections::HashSet<String> = std::collections::HashSet::new();

    if let Some((clause, binds)) = all_terms_clause(trimmed, &["label", "hostname", "notes"]) {
        let sql = format!(
            "SELECT id, label, hostname FROM hosts
             WHERE deleted_at IS NULL AND ({clause})
             LIMIT {PER_KIND_LIMIT}"
        );
        let mut q = sqlx::query_as::<_, (String, String, String)>(&sql);
        for bind in &binds {
            q = q.bind(bind);
        }
        for (id, title, subtitle) in q.fetch_all(state.vault.pool()).await.map_err(db)? {
            let rank = match_rank(&title, Some(&subtitle), trimmed);
            seen_hosts.insert(id.clone());
            out.push((
                rank,
                SearchResultDto {
                    kind: "host".into(),
                    id,
                    title,
                    subtitle: Some(subtitle),
                },
            ));
        }
    }

    // Second pass for what LIKE cannot reach: separator differences
    // ("cloudplus" vs "Cloud Plus") and typos. Only worth running when the
    // strict pass left room, so a well-matched query costs nothing extra.
    if out.len() < PER_KIND_LIMIT {
        let candidates: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT id, label, hostname FROM hosts WHERE deleted_at IS NULL LIMIT ?",
        )
        .bind(FUZZY_SCAN_LIMIT)
        .fetch_all(state.vault.pool())
        .await
        .map_err(db)?;

        // Addresses match literally, so the squashed comparison is disabled
        // for them — see `looks_like_address`.
        let squashed_query = if looks_like_address(trimmed) {
            String::new()
        } else {
            squash(trimmed)
        };
        for (id, title, subtitle) in candidates {
            if out.len() >= PER_KIND_LIMIT {
                break;
            }
            if seen_hosts.contains(&id) {
                continue;
            }
            let separator_hit = !squashed_query.is_empty()
                && (squash(&title).contains(&squashed_query)
                    || squash(&subtitle).contains(&squashed_query));
            if !separator_hit && !is_fuzzy_match(&title, Some(&subtitle), trimmed) {
                continue;
            }
            let rank = match_rank(&title, Some(&subtitle), trimmed);
            seen_hosts.insert(id.clone());
            out.push((
                rank,
                SearchResultDto {
                    kind: "host".into(),
                    id,
                    title,
                    subtitle: Some(subtitle),
                },
            ));
        }
    }

    if let Some((clause, binds)) = all_terms_clause(trimmed, &["name", "body"]) {
        let sql = format!("SELECT id, name FROM snippets WHERE {clause} LIMIT {PER_KIND_LIMIT}");
        let mut q = sqlx::query_as::<_, (String, String)>(&sql);
        for bind in &binds {
            q = q.bind(bind);
        }
        for (id, title) in q.fetch_all(state.vault.pool()).await.map_err(db)? {
            let rank = match_rank(&title, None, trimmed);
            out.push((
                rank,
                SearchResultDto {
                    kind: "snippet".into(),
                    id,
                    title,
                    subtitle: None,
                },
            ));
        }
    }

    if let Some((clause, binds)) = all_terms_clause(trimmed, &["title", "body_md"]) {
        let sql = format!("SELECT id, title FROM notes WHERE {clause} LIMIT {PER_KIND_LIMIT}");
        let mut q = sqlx::query_as::<_, (String, String)>(&sql);
        for bind in &binds {
            q = q.bind(bind);
        }
        for (id, title) in q.fetch_all(state.vault.pool()).await.map_err(db)? {
            let rank = match_rank(&title, None, trimmed);
            out.push((
                rank,
                SearchResultDto {
                    kind: "note".into(),
                    id,
                    title,
                    subtitle: None,
                },
            ));
        }
    }

    // Stable within a rank, so equally-good matches keep their query order.
    out.sort_by_key(|(rank, _)| *rank);
    Ok(out.into_iter().map(|(_, dto)| dto).collect())
}

#[tauri::command]
pub async fn settings_get(
    state: State<'_, Arc<AppState>>,
    key: String,
) -> Result<serde_json::Value, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(state.vault.pool())
        .await
        .map_err(db)?;
    match row {
        Some((v,)) => Ok(serde_json::from_str(&v).unwrap_or(serde_json::Value::String(v))),
        None => Ok(serde_json::Value::Null),
    }
}

#[tauri::command]
pub async fn settings_set(
    state: State<'_, Arc<AppState>>,
    key: String,
    value: serde_json::Value,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let v = value.to_string();
    sqlx::query("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
        .bind(&key)
        .bind(&v)
        .bind(now)
        .execute(state.vault.pool())
        .await
        .map_err(db)?;
    Ok(())
}

#[tauri::command]
pub async fn keybindings_list(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT id, command, keys FROM keybindings")
            .fetch_all(state.vault.pool())
            .await
            .map_err(db)?;
    Ok(rows
        .into_iter()
        .map(
            |(id, command, keys)| serde_json::json!({ "id": id, "command": command, "keys": keys }),
        )
        .collect())
}

#[tauri::command]
pub async fn keybindings_set(
    state: State<'_, Arc<AppState>>,
    command: String,
    keys: String,
) -> Result<(), AppError> {
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("DELETE FROM keybindings WHERE command = ?")
        .bind(&command)
        .execute(state.vault.pool())
        .await
        .map_err(db)?;
    sqlx::query(
        "INSERT INTO keybindings (id, command, keys, when_context, created_at) VALUES (?, ?, ?, NULL, ?)",
    )
    .bind(&id)
    .bind(&command)
    .bind(&keys)
    .bind(now)
    .execute(state.vault.pool())
    .await
    .map_err(db)?;
    Ok(())
}

#[tauri::command]
pub async fn app_info() -> Result<AppInfoDto, AppError> {
    Ok(AppInfoDto {
        name: "SSHBool".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        tauri_version: "2".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_a_clause_requiring_every_term() {
        let (clause, binds) = all_terms_clause("kam switch", &["label", "hostname"]).unwrap();
        assert_eq!(
            clause.matches(" AND ").count(),
            1,
            "one AND between two terms"
        );
        assert_eq!(binds, vec!["%kam%", "%kam%", "%switch%", "%switch%"]);
    }

    #[test]
    fn treats_a_blank_query_as_no_clause() {
        assert!(all_terms_clause("", &["label"]).is_none());
        assert!(all_terms_clause("   ", &["label"]).is_none());
    }

    #[test]
    fn collapses_repeated_whitespace_between_terms() {
        let (_, binds) = all_terms_clause("a\t\n  b", &["label"]).unwrap();
        assert_eq!(binds, vec!["%a%", "%b%"]);
    }

    #[test]
    fn escapes_like_wildcards_so_they_match_literally() {
        // A hostname containing `_` must not act as a single-char wildcard.
        let (clause, binds) = all_terms_clause("web_01", &["hostname"]).unwrap();
        assert!(clause.contains("ESCAPE"));
        assert_eq!(binds, vec![r"%web\_01%"]);

        let (_, binds) = all_terms_clause("50%", &["hostname"]).unwrap();
        assert_eq!(binds, vec![r"%50\%%"]);
    }

    #[test]
    fn ranks_an_exact_match_above_a_prefix_above_a_substring() {
        let exact = match_rank("core", None, "core");
        let prefix = match_rank("core-sw-01", None, "core");
        let substring = match_rank("bne01-core-sw03", None, "core");
        assert!(exact < prefix, "exact should outrank prefix");
        assert!(prefix < substring, "prefix should outrank substring");
    }

    #[test]
    fn ranks_on_the_subtitle_too() {
        // Matching the hostname exactly is as good as matching the label.
        assert_eq!(match_rank("Some Label", Some("10.0.0.1"), "10.0.0.1"), 0);
    }

    #[test]
    fn ranks_a_term_only_match_last() {
        // Both words present, but never as the contiguous phrase.
        assert_eq!(match_rank("KAM - 383 Switch", None, "kam switch"), 4);
    }

    #[test]
    fn ranking_ignores_case_and_surrounding_space() {
        assert_eq!(match_rank("CORE", None, "  core  "), 0);
    }
}

#[cfg(test)]
mod fuzzy_tests {
    use super::*;

    #[test]
    fn squash_strips_separators_and_case() {
        assert_eq!(squash("Cloud Plus VPN"), "cloudplusvpn");
        assert_eq!(squash("cloudplus-vpn"), "cloudplusvpn");
        assert_eq!(squash("  KAM - 383 Switch "), "kam383switch");
    }

    #[test]
    fn one_word_query_matches_the_spaced_label() {
        // The case from the real fleet: both spellings exist as separate hosts.
        assert_eq!(match_rank("Cloud Plus VPN", None, "cloudplus"), 3);
        // "cloudplus-vpn" literally starts with the query, so it ranks as a prefix.
        assert_eq!(match_rank("cloudplus-vpn", None, "cloudplus"), 1);
    }

    #[test]
    fn spaced_query_matches_the_joined_label() {
        assert_eq!(match_rank("cloudplus-vpn", None, "cloud plus"), 3);
    }

    #[test]
    fn rank_order_is_exact_then_prefix_then_substring_then_squashed() {
        assert!(
            match_rank("cloudplus", None, "cloudplus")
                < match_rank("cloudplus-vpn", None, "cloudplus")
        );
        assert!(
            match_rank("cloudplus-vpn", None, "cloudplus")
                < match_rank("Cloud Plus VPN", None, "cloudplus")
        );
    }

    #[test]
    fn all_terms_present_ranks_below_a_separator_match() {
        // "kam switch" appears as two separate words, not a phrase.
        assert_eq!(match_rank("KAM - 383 Switch", None, "kam switch"), 4);
    }

    #[test]
    fn edit_distance_counts_single_character_errors() {
        assert_eq!(edit_distance_within("cloudplus", "cloudplus", 2), Some(0));
        assert_eq!(edit_distance_within("clodplus", "cloudplus", 2), Some(1));
        assert_eq!(edit_distance_within("cluodplus", "cloudplus", 2), Some(2));
    }

    #[test]
    fn edit_distance_bails_out_past_the_budget() {
        assert_eq!(edit_distance_within("aaaa", "bbbb", 2), None);
        // Length gap alone exceeds the budget.
        assert_eq!(edit_distance_within("ab", "abcdefgh", 2), None);
    }

    #[test]
    fn typos_are_tolerated_proportionally_to_query_length() {
        assert_eq!(typo_budget(3), 0, "short queries must stay strict");
        assert_eq!(typo_budget(5), 1);
        assert_eq!(typo_budget(12), 2);
    }

    #[test]
    fn catches_a_misspelling_of_a_real_host() {
        assert!(is_fuzzy_match("cloudplus-vpn", None, "clodplus"));
        assert!(is_fuzzy_match("Cloud Plus VPN", None, "cloudpls"));
    }

    #[test]
    fn finds_a_typo_inside_a_longer_label() {
        // Query is a misspelling of one word in a multi-word label.
        assert!(is_fuzzy_match("Cloud Plus Jump Box", None, "jumpbo"));
    }

    #[test]
    fn does_not_fuzzy_match_unrelated_hosts() {
        assert!(!is_fuzzy_match("bne01-core-sw03", None, "cloudplus"));
        assert!(!is_fuzzy_match("Cloud AI", None, "fortigate"));
    }

    #[test]
    fn short_queries_do_not_fuzzy_match_at_all() {
        // With a 3-char query almost everything is within 2 edits.
        assert!(!is_fuzzy_match("abc", None, "xyz"));
        assert!(!is_fuzzy_match("Cloud AI", None, "sw1"));
    }

    #[test]
    fn fuzzy_match_ignores_separator_differences_for_free() {
        // The typo budget is spent on the typo, not on the missing space.
        assert!(is_fuzzy_match("Cloud Plus TFTP", None, "cloud-plus-tftq"));
    }
}

#[cfg(test)]
mod address_tests {
    use super::*;

    #[test]
    fn recognises_addresses() {
        assert!(looks_like_address("10.10.0.52"));
        assert!(looks_like_address("192.168.1.1"));
        assert!(looks_like_address("2001:db8::1".trim_end_matches("db8::1")));
        assert!(!looks_like_address("cloudplus"));
        assert!(!looks_like_address("core-sw-01"));
        assert!(!looks_like_address(""));
        // Dots alone are not an address.
        assert!(!looks_like_address("..."));
    }

    #[test]
    fn an_ip_does_not_fuzzy_match_its_neighbours() {
        // Every /24 neighbour is within two edits once dots are stripped.
        assert!(!is_fuzzy_match(
            "10.10.0.55",
            Some("10.10.0.55"),
            "10.10.0.52"
        ));
        assert!(!is_fuzzy_match(
            "10.100.3.51",
            Some("10.100.3.51"),
            "10.10.0.52"
        ));
    }

    #[test]
    fn an_exact_ip_still_matches() {
        assert_eq!(
            match_rank("10.10.0.52", Some("10.10.0.52"), "10.10.0.52"),
            0
        );
    }

    #[test]
    fn a_partial_ip_still_matches_as_a_substring() {
        // Typing a prefix to narrow down a subnet must keep working.
        assert_eq!(match_rank("10.10.0.52", Some("10.10.0.52"), "10.10.0"), 1);
    }

    #[test]
    fn an_ip_is_not_squash_matched_against_a_different_ip() {
        // "1010052" must not be found inside "10100352".
        assert_eq!(
            match_rank("10.100.3.52", Some("10.100.3.52"), "10.10.0.52"),
            5
        );
    }
}
