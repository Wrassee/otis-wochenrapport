-- ============================================================
-- OTIS Wochenrapport — Local Supabase Seed Data
-- Runs after migrations on `npx supabase db reset`
-- ============================================================

-- Seed Activity Codes
INSERT INTO activity_codes (id, code, category, description_de, description_fr, description_it, excel_column, sort_order) VALUES
  ('NK', 'NK', 'productive', 'NK - Normalkosten', 'NK - Coûts normaux', 'NK - Costi normali', 'J', 1),
  ('S', 'S', 'productive', 'S - Service', 'S - Service', 'S - Servizio', 'J', 2),
  ('T', 'T', 'productive', 'T - Travaux', 'T - Travaux', 'T - Lavori', 'J', 3),
  ('T_CLOT', 'T Clot', 'productive', 'T Clot - Abschluss T', 'T Clot - Clôture T', 'T Clot - Chiudere T', 'K', 4),
  ('O', 'O', 'productive', 'O - Maintenance', 'O - Maintenance', 'O - Manutenzione', 'L', 5),
  ('QI', 'QI', 'productive', 'QI (≤ 515)', 'QI (≤ 515)', 'QI (≤ 515)', 'M', 6),
  ('VM', 'VM', 'productive', 'VM - Visite/Besuch', 'VM - Visite', 'VM - Visita', 'O', 7),
  ('VP', 'VP', 'productive', 'VP - Fangprobe/Essai parachute', 'VP - Essai parachute', 'VP - Prova paracaduta', 'P', 8),
  ('NM', 'NM', 'productive', 'NM - Maintenance', 'NM - Maintenance', 'NM - Manutenzione', 'Q', 9),
  ('NTC', 'NTC', 'productive', 'NTC - Maintenance', 'NTC - Maintenance', 'NTC - Manutenzione', 'Q', 10),
  ('NF', 'NF', 'productive', 'NF - Maintenance', 'NF - Maintenance', 'NF - Manutenzione', 'Q', 11),
  ('VC', 'VC', 'productive', 'VC - Maintenance', 'VC - Maintenance', 'VC - Manutenzione', 'Q', 12),
  ('QI_SCOTT', 'QI SCOTT', 'productive', 'QI SCOTT (≥ 516)', 'QI SCOTT (≥ 516)', 'QI SCOTT (≥ 516)', 'R', 13),
  ('I04', 'I04', 'non_productive', 'I04 - Administration', 'I04 - Administration', 'I04 - Amministrazione', 'N', 20),
  ('I5S', 'I5S', 'non_productive', 'I5S - Sicherheit', 'I5S - Sécurité', 'I5S - Sicurezza', 'N', 21),
  ('I5Q', 'I5Q', 'non_productive', 'I5Q - Qualität', 'I5Q - Qualité', 'I5Q - Qualità', 'N', 22),
  ('I5T', 'I5T', 'non_productive', 'I5T - Technik', 'I5T - Technique', 'I5T - Tecnica', 'N', 23),
  ('I5A', 'I5A', 'non_productive', 'I5A - Administration', 'I5A - Administration', 'I5A - Amministrazione', 'N', 24),
  ('A01', 'A01', 'absence', 'A01 - Ferien/Vacances', 'A01 - Vacances', 'A01 - Vacanze', 'N', 30),
  ('A02', 'A02', 'absence', 'A02 - Militärdienst', 'A02 - Service militaire', 'A02 - Servizio militare', 'N', 31),
  ('A03', 'A03', 'absence', 'A03 - Krankheit', 'A03 - Maladie', 'A03 - Malattia', 'N', 32),
  ('A04', 'A04', 'absence', 'A04 - Unfall', 'A04 - Accident', 'A04 - Incidente', 'N', 33),
  ('A05', 'A05', 'absence', 'A05 - Andere bewilligte Abwesenheit', 'A05 - Autre absence accordée', 'A05 - Altra assenza accordata', 'N', 34),
  ('A07', 'A07', 'absence', 'A07 - Kompensation', 'A07 - Compensation', 'A07 - Compensazione', 'N', 35)
ON CONFLICT (id) DO NOTHING;

-- Create a demo location for testing
INSERT INTO locations (anlagenummer, project_id, full_address, latitude, longitude, zone) VALUES
  ('AEV17', 'OTIS-1001', 'Bahnhofstrasse 1, 8303 Dietlikon', 47.4222, 8.6175, 1),
  ('FT001', 'OTIS-1002', 'Industriestrasse 25, 8603 Schwerzenbach', 47.3850, 8.6600, 1),
  ('ZU101', 'OTIS-1003', 'Löwenstrasse 12, 8001 Zürich', 47.3741, 8.5432, 1)
ON CONFLICT (anlagenummer) DO NOTHING;
