'use client';

import { Bold, Italic, PenTool, Sparkles } from 'lucide-react';
import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  editor: Editor | null;
}

function ToolbarIconButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'transition-colors duration-200',
            active
              ? 'border-ink bg-surface-2 font-semibold text-ink'
              : 'text-graphite hover:border-ink hover:text-ink',
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        className="flex min-h-[26px] items-center justify-center text-center text-xs font-semibold"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarDropdown({
  label,
  disabled,
  icon: Icon,
  menuWidth = 'w-64',
  children,
}: {
  label: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  menuWidth?: string;
  children: React.ReactNode;
}) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <Tooltip open={dropdownOpen ? false : undefined}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={label}
              disabled={disabled}
              className={cn(
                'transition-colors duration-200 text-graphite hover:border-ink hover:text-ink',
                dropdownOpen && 'border-ink bg-surface-2 text-ink',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={6}
          className="flex min-h-[26px] items-center justify-center text-center text-xs font-semibold"
        >
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className={menuWidth}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <div className="flex items-center gap-1">
        <ToolbarIconButton
          label="Negrito"
          active={editor?.isActive('bold')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" aria-hidden />
        </ToolbarIconButton>

        <ToolbarIconButton
          label="Itálico"
          active={editor?.isActive('italic')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" aria-hidden />
        </ToolbarIconButton>

        <ToolbarDropdown label="Inserir Assinatura" icon={PenTool} disabled={!editor} menuWidth="w-64">
          <DropdownMenuItem
            className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
            onClick={() =>
              editor?.chain().focus().insertContent('\n\n— Equipe manypost\n🌐 www.manypost.com').run()
            }
          >
            <span className="text-xs font-semibold text-ink">Assinatura Padrão</span>
            <span className="max-w-full truncate text-[11px] text-graphite">
              — Equipe manypost | www.manypost.com
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
            onClick={() =>
              editor?.chain().focus().insertContent('\n\n👉 Confira o link na bio para saber mais!').run()
            }
          >
            <span className="text-xs font-semibold text-ink">Chamada para Ação (CTA)</span>
            <span className="max-w-full truncate text-[11px] text-graphite">
              👉 Confira o link na bio...
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
            onClick={() =>
              editor?.chain().focus().insertContent('\n\n📌 Gostou? Salve este post e compartilhe com sua rede!').run()
            }
          >
            <span className="text-xs font-semibold text-ink">Engajamento / Compartilhamento</span>
            <span className="max-w-full truncate text-[11px] text-graphite">
              📌 Gostou? Salve este post...
            </span>
          </DropdownMenuItem>
        </ToolbarDropdown>

        <ToolbarDropdown label="Variáveis dinâmicas" icon={Sparkles} disabled={!editor} menuWidth="w-56">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => editor?.chain().focus().insertContent('{nome_canal}').run()}
          >
            <span className="mr-2 font-mono text-xs font-semibold">{'{nome_canal}'}</span>
            <span className="text-xs text-graphite">Nome do canal</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => editor?.chain().focus().insertContent('{data_atual}').run()}
          >
            <span className="mr-2 font-mono text-xs font-semibold">{'{data_atual}'}</span>
            <span className="text-xs text-graphite">Data de publicação</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => editor?.chain().focus().insertContent('{empresa}').run()}
          >
            <span className="mr-2 font-mono text-xs font-semibold">{'{empresa}'}</span>
            <span className="text-xs text-graphite">Nome da empresa</span>
          </DropdownMenuItem>
        </ToolbarDropdown>
      </div>
    </TooltipProvider>
  );
}
