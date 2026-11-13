import type { AnatomyFocusId } from '../physics/hemodynamics';

interface TopBarProps {
  selectedPart: AnatomyFocusId | null;
  onSelectAnatomy: (partId: AnatomyFocusId) => void;
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
    <header className="relative z-20 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5">
      <button
        type="button"
        onClick={() => onSelectAnatomy('aorta-map')}
        className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        ShockLab
      </button>

      <nav
        aria-label="Anatomical inspection focus"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
      >
        {ANATOMY_NAV_ITEMS.map((item) => {
          const isActive = selectedPart === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAnatomy(item.id)}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 pb-0.5 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${
                isActive
                  ? 'border-blue-600 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
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
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Clinical Reference
        </button>
      </div>
    </header>
  );
}
