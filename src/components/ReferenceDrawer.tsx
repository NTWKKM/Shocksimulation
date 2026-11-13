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
      className="pointer-events-auto fixed top-[57px] right-0 bottom-0 z-30 w-full max-w-[440px] lg:static lg:h-full lg:w-[440px] lg:shrink-0 border-l border-slate-200 bg-white shadow-xl lg:shadow-none flex flex-col"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Clinical Physiology Reference</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            คลิกชิ้นส่วนบนโมเดล 3D หรือเลือกหัวข้อด้านล่างเพื่อดูกลไก
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onResetCamera}
            title="Reset 3D Camera"
            aria-label="Reset 3D Camera"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Drawer"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="px-5 pt-3 pb-2 border-b border-slate-100">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
          <button
            type="button"
            onClick={() => setTab('anatomy')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'anatomy' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3D Anatomy
          </button>
          <button
            type="button"
            onClick={() => setTab('edv-svr')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'edv-svr' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EDV &amp; SVR Guide
          </button>
          <button
            type="button"
            onClick={() => setTab('shocks')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'shocks' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            6 Shock Types
          </button>
        </div>
      </div>

      {/* Scrollable Drawer Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-slate-700 leading-relaxed">
        {tab === 'anatomy' && (
          <>
            {/* Anatomical Structure Selector */}
            <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-100">
              {(Object.keys(ANATOMY_REFERENCES) as AnatomyFocusId[]).map((id) => {
                const entry = ANATOMY_REFERENCES[id];
                const isSelected = activeAnatomy.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPart(id)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {entry.parameterTag.split('·')[0].trim()}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="text-xs font-medium text-blue-700">
                {activeAnatomy.parameterTag} · Normal {activeAnatomy.normalRange}
              </div>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{activeAnatomy.titleEn}</h3>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">{activeAnatomy.titleTh}</p>
              <p className="mt-3 text-slate-700">{activeAnatomy.summaryTh}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                กลไกทางสรีรวิทยา
              </h4>
              <ul className="space-y-2 list-disc pl-4 text-[13px] text-slate-700">
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
              <h3 className="text-base font-bold text-slate-900">
                EDV (End-Diastolic Volume) — ตัวแทนของ Preload
              </h3>
              <p className="mt-2 text-[13px]">
                <strong>EDV</strong> คือปริมาณเลือดในหัวใจห้องล่างซ้าย ณ จุดสิ้นสุดของระยะคลายตัว (Diastole)
                ก่อนเริ่มบีบตัว เป็นตัวแปรที่สะท้อน <strong>Preload</strong> และแปรผันตาม{' '}
                <strong>Circulating Blood Volume (CBV ~7–8% ของน้ำหนักตัว หรือ ~5 ลิตร)</strong>{' '}
                โดยตรง ไม่ใช่ Total Body Fluid (TBF ~42 ลิตร)
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reference Data: EDV กับสถานะ Volume
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {EDV_VOLUME_TIERS.map((row) => (
                  <div key={row.tier} className="p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{row.tier}</span>
                      <span className="font-mono-tabular text-xs font-medium text-slate-600">
                        {row.range}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{row.scenarioTh}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                SVR (Systemic Vascular Resistance) — ตัวแทนของ Afterload
              </h3>
              <p className="text-[13px]">
                ความต้านทานของหลอดเลือดแดงส่วนปลายที่หัวใจต้องเอาชนะเพื่อส่งเลือดออกไป คำนวณจาก{' '}
                <code className="font-mono-tabular bg-slate-100 px-1.5 py-0.5 rounded text-xs">
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
            <p className="text-xs text-slate-500">
              เลือกภาวะ Shock เพื่อโหลดค่าพารามิเตอร์เข้าสู่เครื่องจำลอง 3D Windkessel ทันที
            </p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {SHOCK_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 transition-colors ${isSelected ? 'bg-blue-50/50' : 'bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{preset.label}</span>
                      <button
                        type="button"
                        onClick={() => onSelectPreset(preset.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        Load Preset
                      </button>
                    </div>
                    <div className="mt-1 text-xs font-medium text-blue-700">{preset.summaryTh}</div>
                    <p className="mt-1.5 text-xs text-slate-600">{preset.mechanismTh}</p>
                    <div className="mt-2 font-mono-tabular text-[11px] text-slate-500">
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
