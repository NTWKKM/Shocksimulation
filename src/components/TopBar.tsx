import type { AnatomyFocusId } from '../physics/hemodynamics';

interface TopBarProps {
  selectedPart: AnatomyFocusId | null;
  onSelectAnatomy: (partId: AnatomyFocusId | null) => void;
  onOpenReference: () => void;
}

const ANATOMY_NAV_ITEMS: Array<{ id: AnatomyFocusId; label: string }> = [
  { id: 'lv-edv', label: 'LV Preload' },
  { id: 'myocardium-lvef', label: 'Myocardium' },
  { id: 'aorta-map', label: 'Aortic Arch' },
  { id: 'arterioles-svr', label: 'Arteriolar SVR' },
];

export function TopBar({ selectedPart, onSelectAnatomy, onOpenReference }: TopBarProps) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-6 border-b border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] px-5 py-2.5">
      <button
        type="button"
        onClick={() => onSelectAnatomy(null)}
        className="font-mono-tabular text-base font-semibold tracking-tight text-[var(--anatomy-strong)] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--anatomy-lit)]"
      >
        Shocksimulation
      </button>

      <nav
        aria-label="Anatomical inspection focus"
        className="hidden md:flex items-center gap-6 text-xs font-medium text-[var(--anatomy-muted)]"
      >
        {ANATOMY_NAV_ITEMS.map((item) => {
          const isActive = selectedPart === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAnatomy(isActive ? null : item.id)}
              className={`whitespace-nowrap shrink-0 pb-0.5 border-b transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--anatomy-lit)] ${
                isActive
                  ? 'border-[var(--anatomy-lit)] text-[var(--anatomy-strong)] font-semibold'
                  : 'border-transparent hover:text-[var(--anatomy-strong)] hover:border-[var(--anatomy-mid)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenReference}
          className="px-3.5 py-1.5 font-mono-tabular text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--anatomy-card)] bg-[var(--anatomy-strong)] border border-[var(--anatomy-strong)] hover:opacity-90 transition-opacity duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--anatomy-lit)]"
        >
          Clinical Reference
        </button>
      </div>
    </header>
  );
}
