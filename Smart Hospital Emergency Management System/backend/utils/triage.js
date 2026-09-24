// Clinical Emergency Triage Classification System
// Evaluates symptoms, vitals, and condition indicators to generate:
// - triageCategory: 'CRITICAL' (Red), 'URGENT' (Yellow), 'NORMAL' (Green)
// - triageScore: 1-100
// - recommendedBedType: 'icu', 'emergency' (Oxygen/Trauma), 'general'

export const CRITICAL_SYMPTOMS = [
  'chest pain',
  'cardiac arrest',
  'unconscious',
  'difficulty breathing',
  'severe bleeding',
  'stroke',
  'head trauma',
  'anaphylaxis',
  'seizure',
];

export const URGENT_SYMPTOMS = [
  'high fever',
  'fracture',
  'deep laceration',
  'severe abdominal pain',
  'persistent vomiting',
  'burns',
  'dislocation',
];

/**
 * Computes triage metrics for an emergency case.
 * @param {Object} input - { symptoms: Array/String, vitals: { spo2, heartRate, bpSystolic }, conditionNotes: String }
 */
export const calculateTriageScore = (input = {}) => {
  let score = 20; // baseline for seeking emergency services
  let category = 'NORMAL';
  let recommendedBedType = 'general';
  const detectedFlags = [];

  const symptomsList = Array.isArray(input.symptoms)
    ? input.symptoms.map((s) => s.toLowerCase())
    : (input.symptoms || input.conditionNotes || '').toLowerCase().split(/[,;\n]/);

  // 1. Check Critical Symptoms
  const hasCriticalSymptom = CRITICAL_SYMPTOMS.some((crit) =>
    symptomsList.some((userSym) => userSym.includes(crit))
  );

  if (hasCriticalSymptom) {
    score += 50;
    detectedFlags.push('High-risk critical symptom identified');
  }

  // 2. Check Urgent Symptoms
  const hasUrgentSymptom = URGENT_SYMPTOMS.some((urg) =>
    symptomsList.some((userSym) => userSym.includes(urg))
  );

  if (hasUrgentSymptom) {
    score += 25;
    detectedFlags.push('Urgent medical symptom identified');
  }

  // 3. Vitals Check (if provided)
  if (input.vitals) {
    const { spo2, heartRate, bpSystolic } = input.vitals;

    if (spo2 && spo2 < 92) {
      score += 30;
      detectedFlags.push(`Hypoxia detected (SpO2: ${spo2}%)`);
    }

    if (heartRate && (heartRate > 130 || heartRate < 45)) {
      score += 20;
      detectedFlags.push(`Abnormal Heart Rate (${heartRate} bpm)`);
    }

    if (bpSystolic && (bpSystolic < 85 || bpSystolic > 180)) {
      score += 20;
      detectedFlags.push(`Critical Blood Pressure (${bpSystolic} mmHg)`);
    }
  }

  // Cap score between 1 and 100
  score = Math.min(100, Math.max(1, score));

  // Determine Triage Category & Recommended Bed
  if (score >= 70 || hasCriticalSymptom) {
    category = 'CRITICAL';
    recommendedBedType = input.vitals?.spo2 < 90 || hasCriticalSymptom ? 'icu' : 'emergency';
  } else if (score >= 45 || hasUrgentSymptom) {
    category = 'URGENT';
    recommendedBedType = 'emergency';
  } else {
    category = 'NORMAL';
    recommendedBedType = 'general';
  }

  return {
    triageCategory: category,
    triageScore: score,
    recommendedBedType,
    detectedFlags,
  };
};
