import { useEffect, useRef, useState } from 'react';

import { Icon } from '../components/Icon';
import type { SortMode } from '../types/bookmark';

const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { value: 'created-desc', label: '最新收藏' },
  { value: 'created-asc', label: '最早收藏' },
  { value: 'title', label: '标题' },
  { value: 'recently-opened', label: '最近使用' },
];

interface SortMenuProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
}

export function SortMenu({ value, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [open]);

  return (
    <div className={`sort-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="sort-menu__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      {open ? (
        <div className="sort-menu__options" role="menu" aria-label="书签排序">
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                className={isSelected ? 'is-selected' : undefined}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setOpen(false);
                  if (!isSelected) onChange(option.value);
                }}
              >
                <span className="sort-menu__check" aria-hidden="true">
                  {isSelected ? <Icon name="check" size={14} /> : null}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
