import type { ActivityCode } from './types'

/** Reference point for zone calculation: Dietlikon Bahnhofstrasse 1 */
export const REFERENCE_LAT = 47.4196
export const REFERENCE_LON = 8.6205

/** Zone distance thresholds in km */
export const ZONE_THRESHOLDS = {
  ZONE1: 10,
  ZONE2: 30,
  ZONE3: 60,
} as const

/** Default activity codes matching the Excel template column headers */
export const ACTIVITY_CODES: ActivityCode[] = [
  // Productive (NK/S/T - columns J, K, L, M, O, P, Q, R)
  { id: 'NK', code: 'NK', category: 'productive', description_de: 'NK - Normalkosten', description_fr: 'NK - Coûts normaux', description_it: 'NK - Costi normali', excel_column: 'J', sort_order: 1 },
  { id: 'S', code: 'S', category: 'productive', description_de: 'S - Service', description_fr: 'S - Service', description_it: 'S - Servizio', excel_column: 'J', sort_order: 2 },
  { id: 'T', code: 'T', category: 'productive', description_de: 'T - Travaux', description_fr: 'T - Travaux', description_it: 'T - Lavori', excel_column: 'J', sort_order: 3 },
  { id: 'T_CLOT', code: 'T Clot', category: 'productive', description_de: 'T Clot - Abschluss T', description_fr: 'T Clot - Clôture T', description_it: 'T Clot - Chiudere T', excel_column: 'K', sort_order: 4 },
  { id: 'O', code: 'O', category: 'productive', description_de: 'O - Maintenance', description_fr: 'O - Maintenance', description_it: 'O - Manutenzione', excel_column: 'L', sort_order: 5 },
  { id: 'QI', code: 'QI', category: 'productive', description_de: 'QI (≤ 515)', description_fr: 'QI (≤ 515)', description_it: 'QI (≤ 515)', excel_column: 'M', sort_order: 6 },
  { id: 'VM', code: 'VM', category: 'productive', description_de: 'VM - Visite/Besuch', description_fr: 'VM - Visite', description_it: 'VM - Visita', excel_column: 'O', sort_order: 7 },
  { id: 'VP', code: 'VP', category: 'productive', description_de: 'VP - Fangprobe/Essai parachute', description_fr: 'VP - Essai parachute', description_it: 'VP - Prova paracaduta', excel_column: 'P', sort_order: 8 },
  { id: 'NM', code: 'NM', category: 'productive', description_de: 'NM - Maintenance', description_fr: 'NM - Maintenance', description_it: 'NM - Manutenzione', excel_column: 'Q', sort_order: 9 },
  { id: 'NTC', code: 'NTC', category: 'productive', description_de: 'NTC - Maintenance', description_fr: 'NTC - Maintenance', description_it: 'NTC - Manutenzione', excel_column: 'Q', sort_order: 10 },
  { id: 'NF', code: 'NF', category: 'productive', description_de: 'NF - Maintenance', description_fr: 'NF - Maintenance', description_it: 'NF - Manutenzione', excel_column: 'Q', sort_order: 11 },
  { id: 'VC', code: 'VC', category: 'productive', description_de: 'VC - Maintenance', description_fr: 'VC - Maintenance', description_it: 'VC - Manutenzione', excel_column: 'Q', sort_order: 12 },
  { id: 'QI_SCOTT', code: 'QI SCOTT', category: 'productive', description_de: 'QI SCOTT (≥ 516)', description_fr: 'QI SCOTT (≥ 516)', description_it: 'QI SCOTT (≥ 516)', excel_column: 'R', sort_order: 13 },

  // Non-productive (column N - Improductif)
  { id: 'I04', code: 'I04', category: 'non_productive', description_de: 'I04 - Administration', description_fr: 'I04 - Administration', description_it: 'I04 - Amministrazione', excel_column: 'N', sort_order: 20 },
  { id: 'I5S', code: 'I5S', category: 'non_productive', description_de: 'I5S - Sicherheit', description_fr: 'I5S - Sécurité', description_it: 'I5S - Sicurezza', excel_column: 'N', sort_order: 21 },
  { id: 'I5Q', code: 'I5Q', category: 'non_productive', description_de: 'I5Q - Qualität', description_fr: 'I5Q - Qualité', description_it: 'I5Q - Qualità', excel_column: 'N', sort_order: 22 },
  { id: 'I5T', code: 'I5T', category: 'non_productive', description_de: 'I5T - Technik', description_fr: 'I5T - Technique', description_it: 'I5T - Tecnica', excel_column: 'N', sort_order: 23 },
  { id: 'I5A', code: 'I5A', category: 'non_productive', description_de: 'I5A - Administration', description_fr: 'I5A - Administration', description_it: 'I5A - Amministrazione', excel_column: 'N', sort_order: 24 },

  // Absences (also column N - Improductif section, upper part)
  { id: 'A01', code: 'A01', category: 'absence', description_de: 'A01 - Ferien/Vacances', description_fr: 'A01 - Vacances', description_it: 'A01 - Vacanze', excel_column: 'N', sort_order: 30 },
  { id: 'A02', code: 'A02', category: 'absence', description_de: 'A02 - Militärdienst', description_fr: 'A02 - Service militaire', description_it: 'A02 - Servizio militare', excel_column: 'N', sort_order: 31 },
  { id: 'A03', code: 'A03', category: 'absence', description_de: 'A03 - Krankheit', description_fr: 'A03 - Maladie', description_it: 'A03 - Malattia', excel_column: 'N', sort_order: 32 },
  { id: 'A04', code: 'A04', category: 'absence', description_de: 'A04 - Unfall', description_fr: 'A04 - Accident', description_it: 'A04 - Incidente', excel_column: 'N', sort_order: 33 },
  { id: 'A05', code: 'A05', category: 'absence', description_de: 'A05 - Andere bewilligte Abwesenheit', description_fr: 'A05 - Autre absence accordée', description_it: 'A05 - Altra assenza accordata', excel_column: 'N', sort_order: 34 },
  { id: 'A07', code: 'A07', category: 'absence', description_de: 'A07 - Kompensation', description_fr: 'A07 - Compensation', description_it: 'A07 - Compensazione', excel_column: 'N', sort_order: 35 },
]


