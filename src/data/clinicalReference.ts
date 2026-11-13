import type { AnatomyFocusId } from '../physics/hemodynamics';

export interface AnatomyReferenceEntry {
  id: AnatomyFocusId;
  titleEn: string;
  titleTh: string;
  parameterTag: string;
  normalRange: string;
  summaryTh: string;
  detailsTh: string[];
}

export const ANATOMY_REFERENCES: Record<AnatomyFocusId, AnatomyReferenceEntry> = {
  'lv-edv': {
    id: 'lv-edv',
    titleEn: 'Left Ventricular Cavity (Preload)',
    titleTh: 'โพรงหัวใจห้องล่างซ้าย — ตัวแทนของ Preload (EDV)',
    parameterTag: 'EDV · End-Diastolic Volume',
    normalRange: '0.10 – 0.15 L (100 – 150 mL)',
    summaryTh:
      'ปริมาณเลือดในหัวใจห้องล่างซ้าย ณ จุดสิ้นสุดของระยะคลายตัว (Diastole) ก่อนหัวใจบีบตัว ซึ่งสะท้อน Circulating Blood Volume (CBV) และ Venous Return โดยตรง',
    detailsTh: [
      'Circulating Blood Volume (CBV): ปริมาณเลือดในหลอดเลือดทั้งหมด (~7–8% ของน้ำหนักตัว หรือ ~5 ลิตรในผู้ใหญ่หนัก 70 kg)',
      'Total Body Fluid (TBF): ปริมาณน้ำทั้งหมดในร่างกาย (~60% ของน้ำหนักตัว หรือ ~42 ลิตร) ไม่ได้สัมพันธ์ 1:1 กับ EDV',
      'EDV จึงเป็นตัวแปรสะท้อน Preload ที่ขึ้นกับ Venous Return และ CBV โดยตรง รวมถึงเวลาที่ใช้เติมเลือดช่วง Diastole (จะลดลงเมื่อ HR สูงมาก)',
    ],
  },
  'myocardium-lvef': {
    id: 'myocardium-lvef',
    titleEn: 'LV Myocardium (Contractility)',
    titleTh: 'กล้ามเนื้อหัวใจห้องล่างซ้าย — แรงบีบตัว (LVEF)',
    parameterTag: 'LVEF · Ejection Fraction',
    normalRange: '0.55 – 0.70 (55% – 70%)',
    summaryTh:
      'สัดส่วนของเลือดที่หัวใจห้องล่างซ้ายสามารถบีบส่งออกไปได้ในหนึ่งจังหวะ (SV / EDV) สะท้อน Inotropy หรือแรงบีบตัวของกล้ามเนื้อหัวใจ',
    detailsTh: [
      'Good (≥ 0.45): กล้ามเนื้อหัวใจบีบตัวดี สร้าง Stroke Volume เพียงพอต่อความต้องการของร่างกาย',
      'Moderate (0.30 – 0.44): แรงบีบตัวลดลงปานกลาง มักเริ่มเห็นการคั่งของน้ำหรือหัวใจเต้นเร็วชดเชย',
      'Poor (< 0.30): ภาวะหัวใจล้มเหลว (Cardiogenic Shock) เลือดคั่งในโพรงหัวใจ (EDV สูง, CVP สูง) แต่ปริมาณเลือดที่บีบออกได้ต่ำมาก',
    ],
  },
  'aorta-map': {
    id: 'aorta-map',
    titleEn: 'Ascending Aorta & Windkessel Reservoir',
    titleTh: 'หลอดเลือดแดงใหญ่เอออร์ตา — แรงดันชีพจรและ MAP',
    parameterTag: 'MAP / SBP / DBP · Windkessel Compliance',
    normalRange: 'MAP ≥ 65 mmHg',
    summaryTh:
      'ผนังหลอดเลือดเอออร์ตามีความยืดหยุ่น (Arterial Compliance) ช่วยกักเก็บพลังงานช่วงหัวใจบีบตัว (Systole) และค่อยๆ ระบายเลือดเลี้ยงอวัยวะช่วงคลายตัว (Diastole)',
    detailsTh: [
      'สมการ Windkessel: C · dPa/dt = Q_aortic(t) − (Pa − CVP) / SVR ทำให้เกิดรูปคลื่นความดัน SBP (ยอดคลื่น) และ DBP (ฐานคลื่น)',
      'สมการพื้นฐานเชิงคลินิก: MAP = (HR × LVEF × EDV × SVR) + CVP หรือ MAP = (CO × SVR) + CVP',
      'หาก MAP < 60 mmHg อวัยวะสำคัญ (สมอง ไต หัวใจ) จะเกิดภาวะขาดเลือด (Critical Hypoperfusion)',
    ],
  },
  'arterioles-svr': {
    id: 'arterioles-svr',
    titleEn: 'Peripheral Arteriolar Bed (Afterload)',
    titleTh: 'หลอดเลือดแดงส่วนปลาย — แรงต้านทานหลอดเลือด (SVR)',
    parameterTag: 'SVR · Systemic Vascular Resistance',
    normalRange: '8 – 15 Wood Units',
    summaryTh:
      'ความต้านทานของหลอดเลือดแดงส่วนปลายทั่วร่างกาย เป็นตัวแทนของ Afterload หรือแรงต้านที่หัวใจห้องล่างซ้ายต้องเอาชนะเพื่อส่งเลือดออกไป',
    detailsTh: [
      'SVR สูง (Vasoconstriction > 15 WU): หลอดเลือดหดตัวเพื่อประคองความดันโลหิต เช่น ใน Hypovolemic Shock และ Cardiogenic Shock',
      'SVR ต่ำ (Vasodilation < 8 WU): หลอดเลือดคลายและขยายตัวทั่วร่าง เป็นกลไกหลักของ Distributive Shock (Septic / Anaphylactic)',
      'หน่วย Wood Unit (WU): คำนวณจาก SVR = (MAP − CVP) / CO โดย 1 WU = 80 dyne·s·cm⁻⁵',
    ],
  },
  'venous-cvp': {
    id: 'venous-cvp',
    titleEn: 'Venous Return & Central Venous Pressure',
    titleTh: 'ระบบหลอดเลือดดำไหลกลับ — แรงดัน CVP',
    parameterTag: 'CVP · Central Venous Pressure',
    normalRange: '2 – 8 mmHg',
    summaryTh:
      'แรงดันในหลอดเลือดดำใหญ่ใกล้หัวใจ (Right Atrium / Vena Cava) ที่เป็นฐานแรงดันฝั่งไหลกลับและเป็นตัวแปรบวกปลายทางในสมการ MAP',
    detailsTh: [
      'CVP ต่ำ (< 2 mmHg): บ่งชี้ภาวะขาดสารน้ำหรือเสียเลือด (Hypovolemic Shock) เลือดไหลกลับเข้าหัวใจน้อย',
      'CVP สูง (> 12 mmHg): เกิดได้จากหัวใจบีบไม่ออกจนเลือดคั่ง (Cardiogenic) หรือมีแรงดันภายนอกกดทับหัวใจ (Obstructive เช่น Tamponade)',
      'ในสมการพลวัต เลือดจะไหลผ่านหลอดเลือดส่วนปลายได้ตามความต่างศักย์แรงดัน (MAP − CVP) / SVR',
    ],
  },
};

export interface EdvVolumeTier {
  tier: string;
  range: string;
  tone: 'high' | 'normal' | 'low' | 'very-low';
  scenarioTh: string;
}

export const EDV_VOLUME_TIERS: EdvVolumeTier[] = [
  {
    tier: 'High (Hypervolemia / Heart Failure)',
    range: '> 150 mL (> 0.15 L)',
    tone: 'high',
    scenarioTh:
      'ผู้ป่วยได้รับสารน้ำมากเกินไป (IV fluid overload) หรือภาวะหัวใจล้มเหลว (Cardiogenic Shock) ทำให้เลือดคั่งในห้องหัวใจ (Preload สูง)',
  },
  {
    tier: 'Normal (Euvolemia)',
    range: '100 – 150 mL (เฉลี่ย 120 mL)',
    tone: 'normal',
    scenarioTh: 'สภาวะปกติ Circulating Blood Volume ปกติ (~5 ลิตรในผู้ใหญ่ 70 kg)',
  },
  {
    tier: 'Low (Mild Hypovolemia)',
    range: '80 – 100 mL (0.08 – 0.10 L)',
    tone: 'low',
    scenarioTh: 'ขาดน้ำเล็กน้อย หรือเสียเลือดระดับ Class I–II (750 – 1,500 mL)',
  },
  {
    tier: 'Very Low (Severe Hypovolemia)',
    range: '< 80 mL (< 0.08 L)',
    tone: 'very-low',
    scenarioTh:
      'Hypovolemic Shock ชัดเจน เสียเลือดระดับ Class III–IV (> 1,500–2,000 mL) Venous return ลดลงมากจน Preload ต่ำวิกฤต',
  },
];
