'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ProviderIcon } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';
import { AUTH_NETWORKS } from '../../networks';
import { HubBlocks } from '../hub-blocks';
import { SlideFrame } from '../slide-frame';

/**
 * Slide 1 — o diagrama MCP + API, no mesmo padrão do da landing:
 * fontes → colchete → linha → hub → linha → colchete → redes.
 *
 * Duas adaptações deliberadas (não é cópia literal):
 *
 * 1. **Colchetes por borda CSS, não SVG.** A landing desenha o colchete com
 *    `pathLength="100"` + `stroke-dasharray:100` **junto de**
 *    `vector-effect: non-scaling-stroke`. Nessa combinação o dash passa a ser
 *    lido em pixels de tela e deixa de acompanhar o caminho — lá não aparece
 *    porque o traço é curto, mas aqui o mesmo padrão já produziu linha
 *    picotada. Borda + radius dá o mesmo desenho, nítido em qualquer largura.
 * 2. **Momento dark**: a landing é clara, com traço em quase-preto literal;
 *    aqui tudo vem dos tokens do brand sobre `--night`.
 *
 * Movimento: colchetes abrem a partir do centro, as linhas crescem do hub para
 * fora e um pulso percorre cada linha — as fontes entregando ao hub e o hub
 * entregando às redes. Tudo sob `prefers-reduced-motion: no-preference`.
 */

export function DiagramSlide() {
  const t = useTranslations('auth');

  /*
   * Os nomes dos clientes MCP vivem no i18n, e não como literal aqui, por dois
   * motivos: é copy de interface (o lugar dela é `messages/`) e o
   * `check:ai-providers` proíbe provedor de IA nominal fora de `infra/ai`.
   * Aqui são clientes que se conectam AO manypost, não um motor que o manypost
   * chama — a regra da agnosticidade de IA continua valendo onde ela importa.
   */
  const mcp = [t('diagramClientA'), t('diagramClientB'), t('diagramAnyMcpClient')];
  const api = [
    t('diagramYourAgent'),
    t('diagramScripts'),
    t('diagramEditors'),
    t('diagramTsApp'),
  ];

  return (
    <SlideFrame
      kicker={t('diagramKicker')}
      lines={[t('diagramTitle1'), t('diagramTitle2'), t('diagramTitle3')]}
      sub={t('diagramSub')}
    >
      <div
        className="flex h-full items-stretch justify-center"
        role="img"
        aria-label={t('diagramLabel')}
      >
        {/* fontes */}
        <div className="flex w-[9.25rem] shrink-0 flex-col justify-center gap-3.5">
          <SourceGroup label={t('diagramMcpLabel')} items={mcp} from={0} />
          <SourceGroup label={t('diagramApiLabel')} items={api} from={mcp.length} />
        </div>

        <Bracket side="left" />
        <Line />

        {/* hub */}
        <div className="flex shrink-0 items-center">
          <div className="auth-enter flex size-[11rem] flex-col rounded-lg border border-paper/30 bg-paper/[0.07] p-4">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Image
                src="/images/logoSimplificada.svg"
                alt=""
                width={52}
                height={52}
                className="size-[52px]"
              />
            </div>
            <p className="mb-3 text-center text-[12.5px] font-medium leading-[16px] tracking-[-0.2px] text-paper">
              {t('diagramHubTitle')} <span className="font-semibold text-accent-on-dark">+</span>{' '}
              {t('diagramHubTitleApi')}
            </p>
            <HubBlocks />
          </div>
        </div>

        <Line />
        <Bracket side="right" />

        {/* redes */}
        <div className="flex w-[8rem] shrink-0 flex-col justify-center gap-1.5">
          {AUTH_NETWORKS.map((network, i) => (
            <span
              key={network.id}
              className="auth-enter flex h-8 items-center gap-2 rounded-md border border-paper/15 bg-paper/[0.05] px-2.5 text-[11.5px] font-medium text-paper/85"
              style={{ '--i': i } as React.CSSProperties}
            >
              <ProviderIcon provider={network.id} name={network.name} className="size-4" />
              <span className="truncate">{network.name}</span>
            </span>
          ))}
          <span
            className="auth-enter flex h-8 items-center rounded-md border border-accent-on-dark/50 px-2.5 text-[11.5px] font-medium text-accent-on-dark"
            style={{ '--i': AUTH_NETWORKS.length } as React.CSSProperties}
          >
            {t('diagramAllNetworks')}
          </span>
        </div>
      </div>
    </SlideFrame>
  );
}

function SourceGroup({ label, items, from }: { label: string; items: string[]; from: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-medium text-paper/45">{label}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <span
            key={item}
            className="auth-enter flex h-8 items-center rounded-md border border-paper/15 bg-paper/[0.05] px-2.5 text-[11.5px] font-medium text-paper/85"
            style={{ '--i': from + i } as React.CSSProperties}
          >
            <span className="truncate">{item}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Colchete que reúne o grupo. `]` à esquerda e `[` à direita — bordas em três
 * lados com os cantos do lado da espinha arredondados.
 *
 * A folga fica **só do lado dos cards**: do lado da espinha a linha horizontal
 * precisa encostar, senão o traço fica solto no ar em vez de conectar.
 */
function Bracket({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={cn('flex shrink-0 items-center', side === 'left' ? 'pl-2.5' : 'pr-2.5')}>
      <div
        className={cn(
          'h-[12.5rem] w-4 border-y border-paper/40',
          side === 'left' ? 'rounded-r-md border-r' : 'rounded-l-md border-l',
        )}
      />
    </div>
  );
}

/** Linha horizontal ligando o colchete ao hub. Estática, por decisão do owner. */
function Line() {
  return (
    <div className="flex min-w-[1.5rem] max-w-[7.5rem] flex-1 items-center">
      <span className="block h-px w-full bg-paper/40" />
    </div>
  );
}
