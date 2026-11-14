import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { ANATOMY_REFERENCES, EDV_VOLUME_TIERS } from '../data/clinicalReference';
import { SHOCK_PRESETS, type AnatomyFocusId, type ShockPresetId } from '../physics/hemodynamics';

interface ReferenceDrawerProps {
  open: boolean;
  selectedPart: AnatomyFocusId | null;
  activePreset: ShockPresetId | null;
  onClose: () => void;
  onSelectPart: (partId: AnatomyFocusId) => void;
  onSelectPreset: (presetId: ShockPresetId) => void;
  onResetCamera: () => void;
}

type DrawerTab = 'anatomy' | 'edv-svr' | 'shocks';

export function ReferenceDrawer({
  open,
  selectedPart,
  activePreset,
  onClose,
  onSelectPart,
  onSelectPreset,
  onResetCamera,
}: ReferenceDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('anatomy');

  if (!open) return null;

  const activeAnatomy = ANATOMY_REFERENCES[selectedPart ?? 'lv-edv'];

  return (
    <aside
      aria-label="Clinical reference drawer"
      className="pointer-events-auto fixed top-[45px] right-0 bottom-0 z-30 w-full max-w-[420px] shadow-[-8px_0_24px_rgba(0,0,0,0.08)] border-l border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] flex flex-col"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--anatomy-rule-soft)] px-5 py-3.5">
        <div>
          <h2 className="font-mono-tabular text-sm font-semibold uppercase tracking-[0.06em] text-[var(--anatomy-strong)]">
            Clinical Physiology Reference
          </h2>
          <p className="text-xs text-[var(--anatomy-muted)] mt-0.5">
            คลิกชิ้นส่วนบนภาพ Isometric หรือเลือกหัวข้อด้านล่าง
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onResetCamera}
            title="Reset Plate View"
            aria-label="Reset Plate View"
            className="p-1.5 text-[var(--anatomy-muted)] hover:text-[var(--anatomy-strong)] hover:bg-[var(--anatomy-surface-sub)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Drawer"
            className="p-1.5 text-[var(--anatomy-muted)] hover:text-[var(--anatomy-strong)] hover:bg-[var(--anatomy-surface-sub)] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-5 pt-3 pb-2.5 border-b border-[var(--anatomy-rule-soft)]">
        <div className="grid grid-cols-3 gap-1 border border-[var(--anatomy-rule-soft)] bg-[var(--anatomy-surface-alt)] p-0.5">
          <button
            type="button"
            onClick={() => setTab('anatomy')}
            className={`px-2 py-1.5 text-xs transition-colors whitespace-nowrap ${
              tab === 'anatomy'
                ? 'bg-[var(--anatomy-strong)] text-[var(--anatomy-card)] font-semibold'
                : 'text-[var(--anatomy-text)] hover:text-[var(--anatomy-strong)]'
            }`}
          >
            Rig Plate
          </button>
          <button
            type="button"
            onClick={() => setTab('edv-svr')}
            className={`px-2 py-1.5 text-xs transition-colors whitespace-nowrap ${
              tab === 'edv-svr'
                ? 'bg-[var(--anatomy-strong)] text-[var(--anatomy-card)] font-semibold'
                : 'text-[var(--anatomy-text)] hover:text-[var(--anatomy-strong)]'
            }`}
          >
            EDV &amp; SVR
          </button>
          <button
            type="button"
            onClick={() => setTab('shocks')}
            className={`px-2 py-1.5 text-xs transition-colors whitespace-nowrap ${
              tab === 'shocks'
                ? 'bg-[var(--anatomy-strong)] text-[var(--anatomy-card)] font-semibold'
                : 'text-[var(--anatomy-text)] hover:text-[var(--anatomy-strong)]'
            }`}
          >
            6 Shock Types
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-[var(--anatomy-text)] leading-relaxed">
        {tab === 'anatomy' && (
          <>
            <div className="flex flex-wrap gap-1.5 pb-3 border-b border-[var(--anatomy-rule-soft)]">
              {(Object.keys(ANATOMY_REFERENCES) as AnatomyFocusId[]).map((id) => {
                const entry = ANATOMY_REFERENCES[id];
                const isSelected = activeAnatomy.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPart(id)}
                    className={`px-2.5 py-1 font-mono-tabular text-[11px] border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-[var(--anatomy-lit)] bg-[var(--anatomy-surface-sub)] text-[var(--anatomy-strong)] font-semibold'
                        : 'border-[var(--anatomy-rule-soft)] bg-[var(--anatomy-surface-alt)] text-[var(--anatomy-muted)] hover:text-[var(--anatomy-strong)]'
                    }`}
                  >
                    {entry.parameterTag.split('·')[0].trim()}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="font-mono-tabular text-[11px] font-medium text-[var(--anatomy-red)]">
                {activeAnatomy.parameterTag} · Normal {activeAnatomy.normalRange}
              </div>
              <h3 className="mt-1 text-xl font-bold text-[var(--anatomy-strong)]">
                {activeAnatomy.titleEn}
              </h3>
              <p className="text-xs font-semibold text-[var(--anatomy-muted)] mt-0.5">
                {activeAnatomy.titleTh}
              </p>
              <p className="mt-3 text-[13px] text-[var(--anatomy-text)]">
                {activeAnatomy.summaryTh}
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--anatomy-rule-soft)] space-y-2.5">
              <h4 className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--anatomy-muted)]">
                กลไกทางสรีรวิทยา
              </h4>
              <ul className="space-y-2 list-disc pl-4 text-[13px] text-[var(--anatomy-text)]">
                {activeAnatomy.detailsTh.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {tab === 'edv-svr' && (
          <>
            <div>
              <h3 className="text-lg font-bold text-[var(--anatomy-strong)]">
                EDV (End-Diastolic Volume) — ตัวแทนของ Preload
              </h3>
              <p className="mt-2 text-[13px]">
                <strong className="text-[var(--anatomy-strong)]">EDV</strong>{' '}
                คือปริมาณเลือดในหัวใจห้องล่างซ้าย ณ จุดสิ้นสุดของระยะคลายตัว (Diastole) ก่อนเริ่มบีบตัว
                เป็นตัวแปรที่สะท้อน <strong className="text-[var(--anatomy-strong)]">Preload</strong>{' '}
                และแปรผันตาม{' '}
                <strong className="text-[var(--anatomy-strong)]">
                  Circulating Blood Volume (CBV ~7–8% ของน้ำหนักตัว หรือ ~5 ลิตร)
                </strong>{' '}
                โดยตรง ไม่ใช่ Total Body Fluid (TBF ~42 ลิตร)
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--anatomy-rule-soft)] space-y-2.5">
              <h4 className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--anatomy-muted)]">
                Reference Data: EDV กับสถานะ Volume
              </h4>
              <div className="divide-y divide-[var(--anatomy-rule-soft)] border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)]">
                {EDV_VOLUME_TIERS.map((row) => (
                  <div key={row.tier} className="p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--anatomy-strong)]">{row.tier}</span>
                      <span className="font-mono-tabular text-xs font-medium text-[var(--anatomy-muted)]">
                        {row.range}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--anatomy-text)]">{row.scenarioTh}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--anatomy-rule-soft)] space-y-2">
              <h3 className="text-lg font-bold text-[var(--anatomy-strong)]">
                SVR (Systemic Vascular Resistance) — ตัวแทนของ Afterload
              </h3>
              <p className="text-[13px]">
                ความต้านทานของหลอดเลือดแดงส่วนปลายที่หัวใจต้องเอาชนะเพื่อส่งเลือดออกไป คำนวณจาก{' '}
                <code className="font-mono-tabular bg-[var(--anatomy-surface-alt)] border border-[var(--anatomy-rule)] px-1.5 py-0.5 text-xs text-[var(--anatomy-strong)]">
                  SVR (WU) = (MAP − CVP) / CO
                </code>{' '}
                (1 Wood unit = 80 dyne·s·cm⁻⁵)
              </p>
              <ul className="list-disc pl-4 text-[13px] space-y-1.5">
                <li>
                  <strong className="text-[var(--anatomy-strong)]">Vasoconstriction (&gt; 15 WU):</strong>{' '}
                  หลอดเลือดหดตัวเพื่อชดเชยความดันต่ำ เช่น Hypovolemic และ Cardiogenic Shock
                </li>
                <li>
                  <strong className="text-[var(--anatomy-strong)]">Vasodilation (&lt; 8 WU):</strong>{' '}
                  หลอดเลือดคลายตัวทั่วร่าง เป็นปัญหาหลักของ Distributive Shock (Septic / Anaphylactic)
                </li>
              </ul>
            </div>
          </>
        )}

        {tab === 'shocks' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--anatomy-muted)]">
              เลือกภาวะ Shock เพื่อโหลดค่าพารามิเตอร์เข้าสู่เครื่องจำลอง Windkessel ทันที
            </p>
            <div className="divide-y divide-[var(--anatomy-rule-soft)] border border-[var(--anatomy-rule)]">
              {SHOCK_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 transition-colors ${
                      isSelected ? 'bg-[var(--anatomy-surface-sub)]' : 'bg-[var(--anatomy-card)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--anatomy-strong)]">
                        {preset.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectPreset(preset.id)}
                        className="px-2.5 py-1 font-mono-tabular text-[11px] font-medium border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] text-[var(--anatomy-strong)] hover:border-[var(--anatomy-lit)] whitespace-nowrap shrink-0"
                      >
                        Load Preset
                      </button>
                    </div>
                    <div className="mt-1 text-xs font-medium text-[var(--anatomy-red)]">
                      {preset.summaryTh}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--anatomy-text)]">{preset.mechanismTh}</p>
                    <div className="mt-2 font-mono-tabular text-[11px] text-[var(--anatomy-muted)]">
                      HR {preset.inputs.hr} · EF {(preset.inputs.lvef * 100).toFixed(0)}% · EDV{' '}
                      {Math.round(preset.inputs.edv * 1000)} mL · SVR {preset.inputs.svr} WU · CVP{' '}
                      {preset.inputs.cvp} mmHg
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
