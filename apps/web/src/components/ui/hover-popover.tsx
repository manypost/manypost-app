'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type TriggerElementProps = {
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  [key: string]: unknown;
};

interface HoverPopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  align?: 'center' | 'start' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  openDelay?: number;
  closeDelay?: number;
}

export function HoverPopover({
  children,
  content,
  align = 'end',
  side = 'bottom',
  className,
  openDelay = 50,
  closeDelay = 150,
}: HoverPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, openDelay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, closeDelay);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {React.isValidElement(children) ? (
          React.cloneElement(children as React.ReactElement<TriggerElementProps>, {
            onMouseEnter: (e: React.MouseEvent) => {
              handleMouseEnter();
              (children as React.ReactElement<TriggerElementProps>).props.onMouseEnter?.(e);
            },
            onMouseLeave: (e: React.MouseEvent) => {
              handleMouseLeave();
              (children as React.ReactElement<TriggerElementProps>).props.onMouseLeave?.(e);
            },
            onFocus: (e: React.FocusEvent) => {
              setOpen(true);
              (children as React.ReactElement<TriggerElementProps>).props.onFocus?.(e);
            },
            onBlur: (e: React.FocusEvent) => {
              setOpen(false);
              (children as React.ReactElement<TriggerElementProps>).props.onBlur?.(e);
            },
          })
        ) : (
          <span
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {children}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
