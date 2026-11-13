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
    <header className="relative z-20 flex items-center justify-between gap-8 border-b border-[#CBBBA2] bg-[#FBF7EC] px-6 py-3">
      <button
        type="button"
        onClick={() => onSelectAnatomy('aorta-map')}
        className="font-atlas-serif text-2xl font-bold tracking-tight text-[#231A15] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9E2A2B]"
      >
        Shocksimulation
      </button>

      <nav
        aria-label="Anatomical inspection focus"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5C4D42]"
      >
        {ANATOMY_NAV_ITEMS.map((item) => {
          const isActive = selectedPart === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAnatomy(item.id)}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 pb-0.5 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9E2A2B] ${
                isActive
                  ? 'border-[#9E2A2B] text-[#231A15] font-semibold'
                  : 'border-transparent hover:text-[#231A15] hover:border-[#B8A68B]'
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
          className="px-4 py-2 text-xs font-semibold text-[#FBF7EC] bg-[#2B201A] rounded-sm border border-[#231A15] hover:bg-[#3E2E26] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9E2A2B]"
        >
          Clinical Reference
        </button>
      </div>
    </header>
  );
}
