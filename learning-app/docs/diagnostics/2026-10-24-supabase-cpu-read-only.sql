-- Read-only diagnostic. No restart, termination, reset, index or config change.
-- Bounded catalog/statistics reads; normalized queries only, no row contents.
select jsonb_build_object(
  'observed_at', now(),
  'stats_since', (select stats_reset from pg_stat_statements_info),
  'connections', (select jsonb_agg(x) from (
    select backend_type,state,wait_event_type,count(*) as connections,
      max(extract(epoch from now()-query_start)) filter(where state='active') as longest_active_seconds
    from pg_stat_activity where datname=current_database()
    group by backend_type,state,wait_event_type
  ) x),
  'top_queries', (select jsonb_agg(x) from (
    select queryid,calls,round(total_exec_time::numeric,2) as total_ms,
      round(mean_exec_time::numeric,2) as mean_ms,rows,
      left(regexp_replace(query,'[[:space:]]+',' ','g'),400) as normalized_query
    from pg_stat_statements where dbid=(select oid from pg_database where datname=current_database())
      and query not ilike '%pg_stat_statements%'
    order by total_exec_time desc limit 15
  ) x)
) as cpu_diagnostic;
