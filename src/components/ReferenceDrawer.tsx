import { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
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
      className="pointer-events-auto fixed top-[57px] right-0 bottom-0 z-30 w-full max-w-[440px] lg:static lg:h-full lg:w-[440px] lg:shrink-0 border-l border-[#CBBBA2] bg-[#FBF7EC] shadow-xl lg:shadow-none flex flex-col"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#D8CBB4] px-5 py-4">
        <div>
          <h2 className="font-atlas-serif text-xl font-bold text-[#231A15]">
            Clinical Physiology Reference
          </h2>
          <p className="text-xs text-[#5C4D42] mt-0.5">
            คลิกโครงสร้างบนภาพวาดอนาโตมี หรือเลือกหัวข้อด้านล่างเพื่อดูกลไก
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onResetCamera}
            title="Reset Plate View"
            aria-label="Reset Plate View"
            className="p-2 text-[#5C4D42] hover:text-[#231A15] hover:bg-[#EFE6D2] rounded-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Drawer"
            className="p-2 text-[#5C4D42] hover:text-[#231A15] hover:bg-[#EFE6D2] rounded-sm transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="px-5 pt-3 pb-2 border-b border-[#E3D8C2]">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-sm border border-[#DCD0B8] bg-[#EFE6D2]">
          <button
            type="button"
            onClick={() => setTab('anatomy')}
            className={`px-2 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
              tab === 'anatomy'
                ? 'bg-[#FBF7EC] text-[#231A15] border border-[#B8A68B] shadow-2xs font-semibold'
                : 'text-[#5C4D42] hover:text-[#231A15] border border-transparent'
            }`}
          >
            Anatomy Plate
          </button>
          <button
            type="button"
            onClick={() => setTab('edv-svr')}
            className={`px-2 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
              tab === 'edv-svr'
                ? 'bg-[#FBF7EC] text-[#231A15] border border-[#B8A68B] shadow-2xs font-semibold'
                : 'text-[#5C4D42] hover:text-[#231A15] border border-transparent'
            }`}
          >
            EDV &amp; SVR Guide
          </button>
          <button
            type="button"
            onClick={() => setTab('shocks')}
            className={`px-2 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
              tab === 'shocks'
                ? 'bg-[#FBF7EC] text-[#231A15] border border-[#B8A68B] shadow-2xs font-semibold'
                : 'text-[#5C4D42] hover:text-[#231A15] border border-transparent'
            }`}
          >
            6 Shock Types
          </button>
        </div>
      </div>

      {/* Scrollable Drawer Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-[#3F3128] leading-relaxed">
        {tab === 'anatomy' && (
          <>
            {/* Anatomical Structure Selector */}
            <div className="flex flex-wrap gap-1.5 pb-3 border-b border-[#E3D8C2]">
              {(Object.keys(ANATOMY_REFERENCES) as AnatomyFocusId[]).map((id) => {
                const entry = ANATOMY_REFERENCES[id];
                const isSelected = activeAnatomy.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPart(id)}
                    className={`px-2.5 py-1 text-xs rounded-xs border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-[#9E2A2B] bg-[#9E2A2B]/10 text-[#7A1B1C] font-semibold'
                        : 'border-[#CBBBA2] bg-[#FBF7EC] text-[#5C4D42] hover:bg-[#EFE6D2]'
                    }`}
                  >
                    {entry.parameterTag.split('·')[0].trim()}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="text-xs font-medium text-[#9E2A2B]">
                {activeAnatomy.parameterTag} · Normal {activeAnatomy.normalRange}
              </div>
              <h3 className="font-atlas-serif mt-1 text-2xl font-bold text-[#231A15]">
                {activeAnatomy.titleEn}
              </h3>
              <p className="text-xs font-semibold text-[#5C4D42] mt-0.5">{activeAnatomy.titleTh}</p>
              <p className="mt-3 text-[#3F3128]">{activeAnatomy.summaryTh}</p>
            </div>

            <div className="pt-3 border-t border-[#E3D8C2] space-y-2.5">
              <h4 className="text-xs font-semibold tracking-wide text-[#5C4D42]">
                กลไกทางสรีรวิทยา
              </h4>
              <ul className="space-y-2 list-disc pl-4 text-[13px] text-[#3F3128]">
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
              <h3 className="font-atlas-serif text-xl font-bold text-[#231A15]">
                EDV (End-Diastolic Volume) — ตัวแทนของ Preload
              </h3>
              <p className="mt-2 text-[13px]">
                <strong>EDV</strong> คือปริมาณเลือดในหัวใจห้องล่างซ้าย ณ จุดสิ้นสุดของระยะคลายตัว (Diastole)
                ก่อนเริ่มบีบตัว เป็นตัวแปรที่สะท้อน <strong>Preload</strong> และแปรผันตาม{' '}
                <strong>Circulating Blood Volume (CBV ~7–8% ของน้ำหนักตัว หรือ ~5 ลิตร)</strong>{' '}
                โดยตรง ไม่ใช่ Total Body Fluid (TBF ~42 ลิตร)
              </p>
            </div>

            <div className="pt-3 border-t border-[#E3D8C2] space-y-2.5">
              <h4 className="text-xs font-semibold tracking-wide text-[#5C4D42]">
                Reference Data: EDV กับสถานะ Volume
              </h4>
              <div className="divide-y divide-[#E3D8C2] border border-[#CBBBA2] rounded-sm bg-[#F8F2E3]">
                {EDV_VOLUME_TIERS.map((row) => (
                  <div key={row.tier} className="p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-[#231A15]">{row.tier}</span>
                      <span className="font-mono-tabular text-xs font-medium text-[#5C4D42]">
                        {row.range}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5C4D42]">{row.scenarioTh}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E3D8C2] space-y-2">
              <h3 className="font-atlas-serif text-xl font-bold text-[#231A15]">
                SVR (Systemic Vascular Resistance) — ตัวแทนของ Afterload
              </h3>
              <p className="text-[13px]">
                ความต้านทานของหลอดเลือดแดงส่วนปลายที่หัวใจต้องเอาชนะเพื่อส่งเลือดออกไป คำนวณจาก{' '}
                <code className="font-mono-tabular bg-[#EFE6D2] border border-[#D4C6AE] px-1.5 py-0.5 rounded-xs text-xs">
                  SVR (WU) = (MAP − CVP) / CO
                </code>{' '}
                (1 Wood unit = 80 dyne·s·cm⁻⁵)
              </p>
              <ul className="list-disc pl-4 text-[13px] space-y-1.5">
                <li>
                  <strong>Vasoconstriction (&gt; 15 WU):</strong> หลอดเลือดหดตัวเพื่อชดเชยความดันต่ำ เช่น
                  Hypovolemic และ Cardiogenic Shock
                </li>
                <li>
                  <strong>Vasodilation (&lt; 8 WU):</strong> หลอดเลือดคลายตัวทั่วร่าง เป็นปัญหาหลักของ
                  Distributive Shock (Septic / Anaphylactic)
                </li>
              </ul>
            </div>
          </>
        )}

        {tab === 'shocks' && (
          <div className="space-y-3">
            <p className="text-xs text-[#5C4D42]">
              เลือกภาวะ Shock เพื่อโหลดค่าพารามิเตอร์เข้าสู่เครื่องจำลอง Windkessel ทันที
            </p>
            <div className="divide-y divide-[#E3D8C2] border border-[#CBBBA2] rounded-sm">
              {SHOCK_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 transition-colors ${isSelected ? 'bg-[#9E2A2B]/8' : 'bg-[#FBF7EC]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-atlas-serif text-base font-bold text-[#231A15]">
                        {preset.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectPreset(preset.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-xs border border-[#B8A68B] bg-[#FBF7EC] text-[#231A15] hover:bg-[#EFE6D2] whitespace-nowrap shrink-0"
                      >
                        Load Preset
                      </button>
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#9E2A2B]">{preset.summaryTh}</div>
                    <p className="mt-1.5 text-xs text-[#5C4D42]">{preset.mechanismTh}</p>
                    <div className="mt-2 font-mono-tabular text-[11px] text-[#7C6D60]">
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
