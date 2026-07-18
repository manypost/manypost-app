import { describe, expect, test } from 'bun:test';
import { createPrometheusMetrics } from './prometheus';

describe('PrometheusMetrics', () => {
  test('counters de publicação: HELP/TYPE + série por label, acumula', () => {
    const m = createPrometheusMetrics();
    m.sink.onPublicationResult('x', 'published');
    m.sink.onPublicationResult('x', 'published');
    m.sink.onPublicationResult('mastodon', 'failed');
    const out = m.render();
    expect(out).toContain('# TYPE publishing_publications_total counter');
    expect(out).toContain('publishing_publications_total{provider="x",state="published"} 2');
    expect(out).toContain('publishing_publications_total{provider="mastodon",state="failed"} 1');
  });

  test('rate_limit_denied e retry por label', () => {
    const m = createPrometheusMetrics();
    m.sink.onRateLimitDenied('x', 'concurrency');
    m.sink.onRateLimitDenied('x', 'window');
    m.sink.onRetry('transient');
    const out = m.render();
    expect(out).toContain('rate_limit_denied_total{provider="x",reason="concurrency"} 1');
    expect(out).toContain('rate_limit_denied_total{provider="x",reason="window"} 1');
    expect(out).toContain('publishing_retry_total{class="transient"} 1');
  });

  test('onRecovered ignora contagem zero e soma por kind', () => {
    const m = createPrometheusMetrics();
    m.sink.onRecovered('due', 0); // não cria série
    m.sink.onRecovered('due', 3);
    m.sink.onRecovered('stuck', 1);
    const out = m.render();
    expect(out).toContain('publishing_recovered_total{kind="due"} 3');
    expect(out).toContain('publishing_recovered_total{kind="stuck"} 1');
  });

  test('gauge de profundidade de fila', () => {
    const m = createPrometheusMetrics();
    m.setQueueDepth({ publish: 5, 'publish-thread-item': 0 });
    const out = m.render();
    expect(out).toContain('# TYPE queue_depth gauge');
    expect(out).toContain('queue_depth{queue="publish"} 5');
    expect(out).toContain('queue_depth{queue="publish-thread-item"} 0');
  });

  test('histograma HTTP: buckets cumulativos + _sum + _count + +Inf', () => {
    const m = createPrometheusMetrics();
    m.observeHttp('GET', '/v1/posts/:groupId', 200, 0.03);
    m.observeHttp('GET', '/v1/posts/:groupId', 200, 0.4);
    const out = m.render();
    const label = 'method="GET",route="/v1/posts/:groupId",status="200"';
    expect(out).toContain('# TYPE http_request_duration_seconds histogram');
    // 0.03 e 0.4 ≤ 0.5 → 2; só 0.03 ≤ 0.05 → 1
    expect(out).toContain(`http_request_duration_seconds_bucket{${label},le="0.05"} 1`);
    expect(out).toContain(`http_request_duration_seconds_bucket{${label},le="0.5"} 2`);
    expect(out).toContain(`http_request_duration_seconds_bucket{${label},le="+Inf"} 2`);
    expect(out).toContain(`http_request_duration_seconds_count{${label}} 2`);
    expect(out).toContain(`http_request_duration_seconds_sum{${label}} 0.43`);
  });

  test('escapa aspas/barra em valores de label', () => {
    const m = createPrometheusMetrics();
    m.observeHttp('GET', '/weird"\\path', 200, 0.01);
    const out = m.render();
    expect(out).toContain('route="/weird\\"\\\\path"');
  });
});
