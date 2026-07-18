// Registro Prometheus mínimo e sem dependências (SPEC_INFRA §4): counters + gauges +
// histograma, exposição em texto (formato de exposição 0.0.4). O core só conhece o port
// MetricsSink (packages/core/ports/metrics); esta é a implementação usada pela apps/api.
import type { MetricsSink } from '@manypost/core';

type Labels = Record<string, string>;

const escapeLabelValue = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

/** `name{a="1",b="2"}` (ordem estável = ordem de labelNames); sem labels vira só `name`. */
const seriesName = (name: string, labelNames: string[], labels: Labels, extra?: Labels) => {
  const all = [
    ...labelNames.map((n) => [n, labels[n] ?? ''] as const),
    ...Object.entries(extra ?? {}),
  ];
  if (all.length === 0) return name;
  const inner = all.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(',');
  return `${name}{${inner}}`;
};

const keyOf = (labelNames: string[], labels: Labels) =>
  labelNames.map((n) => labels[n] ?? '').join('\x1f');

class Counter {
  private readonly series = new Map<string, { labels: Labels; value: number }>();
  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[] = [],
  ) {}
  inc(labels: Labels = {}, by = 1) {
    const k = keyOf(this.labelNames, labels);
    const cur = this.series.get(k);
    if (cur) cur.value += by;
    else this.series.set(k, { labels, value: by });
  }
  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.series.size === 0) lines.push(`${this.name} 0`); // série presente mesmo zerada
    for (const { labels, value } of this.series.values()) {
      lines.push(`${seriesName(this.name, this.labelNames, labels)} ${value}`);
    }
    return lines;
  }
}

class Gauge {
  private readonly series = new Map<string, { labels: Labels; value: number }>();
  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[] = [],
  ) {}
  set(labels: Labels, value: number) {
    this.series.set(keyOf(this.labelNames, labels), { labels, value });
  }
  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const { labels, value } of this.series.values()) {
      lines.push(`${seriesName(this.name, this.labelNames, labels)} ${value}`);
    }
    return lines;
  }
}

class Histogram {
  private readonly series = new Map<
    string,
    { labels: Labels; buckets: number[]; sum: number; count: number }
  >();
  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: number[],
    readonly labelNames: string[] = [],
  ) {}
  observe(labels: Labels, value: number) {
    const k = keyOf(this.labelNames, labels);
    let s = this.series.get(k);
    if (!s) {
      s = { labels, buckets: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.series.set(k, s);
    }
    s.sum += value;
    s.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]!) s.buckets[i]! += 1;
    }
  }
  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const s of this.series.values()) {
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(
          `${seriesName(`${this.name}_bucket`, this.labelNames, s.labels, { le: String(this.buckets[i]) })} ${s.buckets[i]}`,
        );
      }
      lines.push(
        `${seriesName(`${this.name}_bucket`, this.labelNames, s.labels, { le: '+Inf' })} ${s.count}`,
      );
      lines.push(`${seriesName(`${this.name}_sum`, this.labelNames, s.labels)} ${s.sum}`);
      lines.push(`${seriesName(`${this.name}_count`, this.labelNames, s.labels)} ${s.count}`);
    }
    return lines;
  }
}

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export type PrometheusMetrics = ReturnType<typeof createPrometheusMetrics>;

export function createPrometheusMetrics() {
  const publications = new Counter(
    'publishing_publications_total',
    'Publicações finalizadas por provider e estado final',
    ['provider', 'state'],
  );
  const retries = new Counter(
    'publishing_retry_total',
    'Retries de negócio re-agendados por classe de erro',
    ['class'],
  );
  const recovered = new Counter(
    'publishing_recovered_total',
    'Publicações recuperadas pelo scanner por tipo',
    ['kind'],
  );
  const rateLimitDenied = new Counter(
    'rate_limit_denied_total',
    'Publicações adiadas por rate-limit por provider e motivo',
    ['provider', 'reason'],
  );
  const httpDuration = new Histogram(
    'http_request_duration_seconds',
    'Latência das requisições HTTP por método, rota e status',
    HTTP_BUCKETS,
    ['method', 'route', 'status'],
  );
  const queueDepth = new Gauge(
    'queue_depth',
    'Jobs pendentes na fila (state=created/retry) por fila',
    ['queue'],
  );

  const sink: MetricsSink = {
    onPublicationResult: (provider, state) => publications.inc({ provider, state }),
    onRetry: (errorClass) => retries.inc({ class: errorClass }),
    onRecovered: (kind, count) => count > 0 && recovered.inc({ kind }, count),
    onRateLimitDenied: (provider, reason) => rateLimitDenied.inc({ provider, reason }),
  };

  return {
    sink,
    /** middleware HTTP chama após a resposta (rota = padrão da rota, não o path com ids) */
    observeHttp(method: string, route: string, status: number, durationSec: number) {
      httpDuration.observe({ method, route, status: String(status) }, durationSec);
    },
    /** setado pela rota /metrics logo antes de render (pull da profundidade da fila) */
    setQueueDepth(depths: Record<string, number>) {
      for (const [queue, n] of Object.entries(depths)) queueDepth.set({ queue }, n);
    },
    /** exposição em texto (Content-Type text/plain; version=0.0.4) */
    render(): string {
      return (
        [
          ...publications.render(),
          ...retries.render(),
          ...recovered.render(),
          ...rateLimitDenied.render(),
          ...queueDepth.render(),
          ...httpDuration.render(),
        ].join('\n') + '\n'
      );
    },
  };
}
