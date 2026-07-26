/**
 * Multi-language translations for the OTIS Wochenrapport app.
 * DE = German (default), FR = French, IT = Italian, HU = Hungarian
 */

export type Language = 'de' | 'fr' | 'it' | 'hu'

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
  { code: 'hu', label: 'Hungarian', nativeLabel: 'Magyar' },
]

export type TranslationDict = Record<string, Record<Language, string>>

/** All user-facing text, organized by component section. */
export const translations: TranslationDict = {
  // ─── App shell / navigation ───
  'nav.dashboard':        { de: 'Dashboard',        fr: 'Tableau de bord',    it: 'Dashboard',     hu: 'Irányítópult' },
  'nav.week':             { de: 'Woche',             fr: 'Semaine',            it: 'Settimana',      hu: 'Hét' },
  'nav.export':           { de: 'Export',            fr: 'Exporter',           it: 'Esporta',        hu: 'Exportálás' },
  'nav.settings':         { de: 'Einstellungen',     fr: 'Paramètres',         it: 'Impostazioni',   hu: 'Beállítások' },
  'nav.settings.short':   { de: 'Einstellungen',     fr: 'Paramètres',         it: 'Impostazioni',   hu: 'Beállítások' },
  'nav.subtitle.settings':{ de: 'Profil, Synchronisation & mehr', fr: 'Profil, synchronisation & plus', it: 'Profilo, sincronizzazione & altro', hu: 'Profil, szinkronizálás & egyéb' },
  'app.name':             { de: 'Wochenrapport',     fr: 'Rapport hebdomadaire', it: 'Rapporto settimanale', hu: 'Wochenrapport' },
  'app.subtitle':         { de: 'F\u00fcr OTIS Servicetechniker', fr: 'Pour techniciens OTIS', it: 'Per tecnici OTIS', hu: 'OTIS szerviztechnikusoknak' },

  // ─── Auth (Login / Register / Profile) ───
  'auth.login.title':     { de: 'Anmelden',          fr: 'Connexion',          it: 'Accedi',         hu: 'Bejelentkez\u00e9s' },
  'auth.login.btn':       { de: 'Anmelden',          fr: 'Se connecter',       it: 'Accedi',         hu: 'Bejelentkez\u00e9s' },
  'auth.login.loading':   { de: 'Anmelden...',       fr: 'Connexion...',       it: 'Accesso in corso...', hu: 'Bejelentkez\u00e9s...' },
  'auth.register.title':  { de: 'Konto erstellen',   fr: 'Cr\u00e9er un compte',    it: 'Crea account',   hu: 'Fi\u00f3k l\u00e9trehoz\u00e1sa' },
  'auth.register.btn':    { de: 'Registrieren',      fr: "S'inscrire",         it: 'Registrati',     hu: 'Regisztr\u00e1ci\u00f3' },
  'auth.register.loading':{ de: 'Registrieren...',   fr: 'Inscription...',     it: 'Registrazione...', hu: 'Regisztr\u00e1ci\u00f3...' },
  'auth.register.subtitle':{ de: 'Registrierung f\u00fcr OTIS Wochenrapport', fr: 'Inscription pour OTIS', it: 'Registrazione per OTIS', hu: 'Regisztr\u00e1ci\u00f3 OTIS Wochenrapporthoz' },
  'auth.email':           { de: 'E-Mail',            fr: 'E-mail',             it: 'Email',          hu: 'E-mail' },
  'auth.email.placeholder':{ de: 'name@otis.com',    fr: 'name@otis.com',      it: 'nome@otis.com',  hu: 'nev@otis.com' },
  'auth.password':        { de: 'Passwort',          fr: 'Mot de passe',       it: 'Password',       hu: 'Jelsz\u00f3' },
  'auth.password.confirm':{ de: 'Passwort best\u00e4tigen',fr: 'Confirmer mot de passe', it: 'Conferma password', hu: 'Jelsz\u00f3 meger\u0151s\u00edt\u00e9se' },
  'auth.no.account':      { de: 'Noch kein Konto?',  fr: "Pas encore de compte?", it: 'Non hai un account?', hu: 'M\u00e9g nincs fi\u00f3kja?' },
  'auth.has.account':     { de: 'Bereits registriert?',fr: 'D\u00e9j\u00e0 inscrit?',    it: 'Gi\u00e0 registrato?', hu: 'M\u00e1r regisztr\u00e1lt?' },
  'auth.switch.login':    { de: 'Anmelden',          fr: 'Se connecter',       it: 'Accedi',         hu: 'Bejelentkez\u00e9s' },
  'auth.switch.register': { de: 'Registrieren',      fr: "S'inscrire",         it: 'Registrati',     hu: 'Regisztr\u00e1ci\u00f3' },
  'auth.password.mismatch':{ de: 'Passw\u00f6rter stimmen nicht \u00fcberein', fr: 'Les mots de passe ne correspondent pas', it: 'Le password non corrispondono', hu: 'A jelszavak nem egyeznek' },
  'auth.password.short':  { de: 'Passwort muss mindestens 6 Zeichen lang sein', fr: 'Le mot de passe doit contenir au moins 6 caract\u00e8res', it: 'La password deve contenere almeno 6 caratteri', hu: 'A jelsz\u00f3 legal\u00e1bb 6 karakter legyen' },
  'auth.name.required':   { de: 'Bitte geben Sie Ihren Namen ein', fr: 'Veuillez entrer votre nom', it: 'Inserisci il tuo nome', hu: 'K\u00e9rj\u00fck, adja meg a nev\u00e9t' },
  'auth.personnel.required':{ de: 'Bitte geben Sie Ihre Personalnummer ein', fr: 'Veuillez entrer votre num\u00e9ro de personnel', it: 'Inserisci il tuo numero di matricola', hu: 'K\u00e9rj\u00fck, adja meg a szem\u00e9lyi sz\u00e1m\u00e1t' },

  // ─── Profile Setup ───
  'profile.title':        { de: 'Profil Einstellungen', fr: 'Param\u00e8tres du profil', it: 'Impostazioni profilo', hu: 'Profil be\u00e1ll\u00edt\u00e1sok' },
  'profile.subtitle':     { de: 'Pers\u00f6nliche Informationen verwalten', fr: 'G\u00e9rer les informations personnelles', it: 'Gestisci informazioni personali', hu: 'Szem\u00e9lyes adatok kezel\u00e9se' },
  'profile.name':         { de: 'Vollst\u00e4ndiger Name', fr: 'Nom complet',        it: 'Nome completo',  hu: 'Teljes n\u00e9v' },
  'profile.name.placeholder':{ de: 'Max Mustermann',  fr: 'Max Mustermann',     it: 'Mario Rossi',    hu: 'Minta M\u00e1rton' },
  'profile.personnel':    { de: 'Personalnummer',     fr: 'Num\u00e9ro de personnel', it: 'Numero di matricola', hu: 'Szem\u00e9lyi sz\u00e1m' },
  'profile.personnel.placeholder':{ de: 'z.B. 4563',  fr: 'p.ex. 4563',         it: 'es. 4563',       hu: 'pl. 4563' },
  'profile.supervisor':   { de: 'Supervisor E-Mail',  fr: 'E-mail du superviseur', it: 'Email del supervisore', hu: 'Supervisor e-mail' },
  'profile.supervisor.placeholder':{ de: 'supervisor@otis.com', fr: 'superviseur@otis.com', it: 'supervisore@otis.com', hu: 'supervisor@otis.com' },
  'profile.saved':        { de: 'Profil erfolgreich gespeichert!', fr: 'Profil enregistr\u00e9 avec succ\u00e8s!', it: 'Profilo salvato con successo!', hu: 'Profil sikeresen elmentve!' },
  'profile.save':         { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva',          hu: 'Ment\u00e9s' },
  'profile.saving':       { de: 'Speichern...',       fr: 'Enregistrement...',  it: 'Salvataggio...',  hu: 'Ment\u00e9s...' },

  // ─── Dashboard / Day ───
  'dashboard.today':      { de: 'Heutige Eintr\u00e4ge',   fr: 'Entr\u00e9es du jour',    it: 'Voci di oggi',  hu: 'Mai bejegyz\u00e9sek' },
  'dashboard.progress':   { de: 'Erf\u00fcllt',            fr: 'Atteint',            it: 'Raggiunto',      hu: 'Teljes\u00edtve' },
  'dashboard.missing':    { de: 'Fehlt {hours}h',     fr: 'Manque {hours}h',    it: 'Mancano {hours}h', hu: 'Hi\u00e1nyzik {hours}h' },
  'dashboard.lunch':      { de: 'Mittagspause: {min} Min.', fr: 'Pause d\u00e9jeuner: {min} min.', it: 'Pausa pranzo: {min} min.', hu: 'Eb\u00e9dsz\u00fcnet: {min} perc' },
  'dashboard.entries':    { de: '{count} Eintr\u00e4ge',   fr: '{count} entr\u00e9es',    it: '{count} voci',  hu: '{count} bejegyz\u00e9s' },
  'dashboard.pause.recorded':{ de: 'Pause erfasst \u2713', fr: 'Pause enregistr\u00e9e \u2713', it: 'Pausa registrata \u2713', hu: 'Sz\u00fcnet r\u00f6gz\u00edtve \u2713' },
  'dashboard.quickadd.title':{ de: 'Schnelles Hinzuf\u00fcgen', fr: 'Ajout rapide', it: 'Aggiunta rapida', hu: 'Gyors hozz\u00e1ad\u00e1s' },
  'dashboard.quickadd.subtitle':{ de: 'Mehr Zeit auf bestehenden Eintrag', fr: 'Ajouter du temps \u00e0 une entr\u00e9e existante', it: 'Aggiungi tempo a voce esistente', hu: 'T\u00f6bb id\u0151 a megl\u00e9v\u0151 bejegyz\u00e9shez' },

  // ─── Time Entry Form ───
  'entry.title':          { de: 'Neuen Eintrag erfassen', fr: 'Nouvelle entr\u00e9e', it: 'Nuova voce',   hu: '\u00daj bejegyz\u00e9s r\u00f6gz\u00edt\u00e9se' },
  'entry.lunch.btn':      { de: 'Mittagspause +',     fr: 'Pause d\u00e9jeuner +',  it: 'Pausa pranzo +', hu: 'Eb\u00e9dsz\u00fcnet +' },
  'entry.lunch.active':   { de: 'Mittagspause eingetragen', fr: 'Pause d\u00e9jeuner enregistr\u00e9e', it: 'Pausa pranzo registrata', hu: 'Eb\u00e9dsz\u00fcnet r\u00f6gz\u00edtve' },
  'entry.lunch.save':     { de: 'Mittagspause erfassen', fr: 'Enregistrer pause', it: 'Registra pausa', hu: 'Eb\u00e9dsz\u00fcnet r\u00f6gz\u00edt\u00e9se' },
  'entry.anlagenummer':   { de: 'Anlagen-Nr. / Lift', fr: 'No. d\'installation', it: 'N. impianto',   hu: 'Lift sz\u00e1m' },
  'entry.search.placeholder':{ de: 'Suchen... (z.B. AEV17, 1DG02)', fr: 'Rechercher... (p.ex. AEV17)', it: 'Cerca... (es. AEV17)', hu: 'Keres\u00e9s... (pl. AEV17, 1DG02)' },
  'entry.projekt':        { de: 'Projekt-Nr.',        fr: 'No. de projet',     it: 'N. progetto',    hu: 'Projekt sz\u00e1m' },
  'entry.projekt.placeholder':{ de: 'z.B. SDAFQL, SCZREF, KAE827', fr: 'p.ex. SDAFQL', it: 'es. SDAFQL', hu: 'pl. SDAFQL, SCZREF, KAE827' },
  'entry.address':        { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo',      hu: 'C\u00edm' },
  'entry.address.placeholder':{ de: 'z.B. Winterthur Industriestrasse 24', fr: 'p.ex. Winterthur Industriestrasse 24', it: 'es. Winterthur Industriestrasse 24', hu: 'pl. Winterthur Industriestrasse 24' },
  'entry.address.hint':   { de: 'Ort und Strasse \u2014 wird automatisch ausgef\u00fcllt bei Lift-Auswahl', fr: 'Lieu et rue \u2014 rempli automatiquement', it: 'Luogo e via \u2014 compilato automaticamente', hu: 'Helysz\u00edn \u00e9s utca \u2014 automatikusan kit\u00f6ltve lift kiv\u00e1laszt\u00e1sakor' },
  'entry.from.database':  { de: 'Aus Datenbank:',     fr: 'De la base de donn\u00e9es:', it: 'Dal database:', hu: 'Adatb\u00e1zisb\u00f3l:' },
  'entry.beginn':         { de: 'Beginn',             fr: 'D\u00e9but',              it: 'Inizio',         hu: 'Kezd\u00e9s' },
  'entry.beginn.hint':    { de: '15-Minuten-Schritte (7:30, 7:45, 8:00, \u2026)', fr: 'Pas de 15 minutes', it: 'Intervalli di 15 minuti', hu: '15 perces l\u00e9p\u00e9sek (7:30, 7:45, 8:00, \u2026)' },
  'entry.dauer':          { de: 'Dauer (OTIS)',       fr: 'Dur\u00e9e (OTIS)',       it: 'Durata (OTIS)',  hu: 'Id\u0151tartam (OTIS)' },
  'entry.activity':       { de: 'T\u00e4tigkeit',          fr: 'Activit\u00e9',           it: 'Attivit\u00e0',    hu: 'Tev\u00e9kenys\u00e9g' },
  'entry.activity.select':{ de: 'T\u00e4tigkeit ausw\u00e4hlen', fr: 'Choisir une activit\u00e9', it: 'Seleziona attivit\u00e0', hu: 'Tev\u00e9kenys\u00e9g kiv\u00e1laszt\u00e1sa' },
  'entry.activity.picker.title':{ de: 'T\u00e4tigkeit ausw\u00e4hlen', fr: 'Choisir une activit\u00e9', it: 'Seleziona attivit\u00e0', hu: 'Tev\u00e9kenys\u00e9g kiv\u00e1laszt\u00e1sa' },
  'entry.spesen':         { de: 'Spesen (optional)',  fr: 'Frais (optionnel)',  it: 'Spese (opzionale)', hu: 'K\u00f6lts\u00e9gek (opcion\u00e1lis)' },
  'entry.save':           { de: 'Eintrag erfassen',   fr: 'Enregistrer l\'entr\u00e9e', it: 'Registra voce', hu: 'Bejegyz\u00e9s r\u00f6gz\u00edt\u00e9se' },
  'entry.overlap':        { de: 'Zeit\u00fcberschneidung!',fr: 'Chevauchement!',     it: 'Sovrapposizione!', hu: 'Id\u0151\u00fctk\u00f6z\u00e9s!' },

  // ─── Activity Picker ───
  'activity.productive':      { de: 'Produktiv',      fr: 'Productif',          it: 'Produttivo',     hu: 'Produkt\u00edv' },
  'activity.productive.sublabel':{ de: 'NK-Neueinst., S-Umbau, T-Modernis., T Clot-Abschluss, O-Wartung, QI-QI-Nr., VM-Besuch, VP-Pr\u00fcfung, NM-Aufzug, NTC-TC, NF-Notruf, VC-Steuerung', fr: 'NK-Nouvelle inst., S-Reconstruction, T-Modernis., T Clot-Cl\u00f4ture, O-Maintenance, QI-N\u00b0 QI, VM-Visite, VP-Essai, NM-Ascenseur, NTC-TC, NF-Appel d\'urgence, VC-Commande', it: 'NK-Nuova install., S-Ricostruz., T-Modernizz., T Clot-Chiusura, O-Manutenz., QI-N. QI, VM-Visita, VP-Collaudo, NM-Ascensore, NTC-TC, NF-Emergenza, VC-Controllo', hu: 'NK-\u00daj felv., S-\u00c9p\u00edt., T-Korszer\u0171s., T Clot-Lez\u00e1r., O-Karbant., QI-QI sz., VM-L\u00e1tog., VP-Vizsg., NM-Felv., NTC-TC, NF-Veszhelyz., VC-Vez\u00e9rl.' },
  'activity.nonproductive':    { de: 'Improduktiv',   fr: 'Improductif',        it: 'Improduttivo',   hu: 'Improdukt\u00edv' },
  'activity.nonproductive.sublabel':{ de: 'I04-Administration, I5S-Service, I5Q-Qualit\u00e4t, I5T-Training, I5A-Audit', fr: 'I04-Administration, I5S-Service, I5Q-Qualit\u00e9, I5T-Formation, I5A-Audit', it: 'I04-Amministraz., I5S-Servizio, I5Q-Qualit\u00e0, I5T-Formaz., I5A-Audit', hu: 'I04-Admin, I55-Szerviz, I5Q-Min\u0151s\u00e9g, I5T-K\u00e9pz\u00e9s, I5A-Audit' },
  'activity.absence':          { de: 'Abwesenheit',   fr: 'Absence',            it: 'Assenza',        hu: 'T\u00e1voll\u00e9t' },
  'activity.absence.sublabel': { de: 'A01-Ferien, A02-Milit\u00e4r, A03-Krankheit, A04-Unfall, A05-Abwesenheit, A07-Kompensation', fr: 'A01-Vacances, A02-Militaire, A03-Maladie, A04-Accident, A05-Absence, A07-Compensation', it: 'A01-Vacanze, A02-Militare, A03-Malattia, A04-Infortunio, A05-Assenza, A07-Compensazione', hu: 'A01-Szabads\u00e1g, A02-Katonas\u00e1g, A03-Betegs\u00e9g, A04-Baleset, A05-T\u00e1voll\u00e9t, A07-Kompenz\u00e1ci\u00f3' },
  'activity.options':         { de: '{n} Optionen',   fr: '{n} options',        it: '{n} opzioni',    hu: '{n} lehet\u0151s\u00e9g' },
  'activity.codes':           { de: '{n} Codes',      fr: '{n} codes',          it: '{n} codici',     hu: '{n} k\u00f3d' },

  // ─── Top 5 Recent Lifts ───
  'favorites.title':      { de: 'Letzte Anlagen',     fr: 'Derni\u00e8res installations', it: 'Ultimi impianti', hu: 'Legut\u00f3bbi liftek' },

  // ─── Week Overview ───
  'week.title':           { de: 'KW {number}',        fr: 'SE {number}',         it: 'SE {number}',    hu: '{number}. h\u00e9t' },
  'week.total':           { de: 'Total',              fr: 'Total',              it: 'Totale',          hu: '\u00d6sszesen' },
  'week.days.complete':   { de: '{valid}/{total} Tage vollst\u00e4ndig', fr: '{valid}/{total} jours complets', it: '{valid}/{total} giorni completi', hu: '{valid}/{total} nap teljes' },
  'week.complete':        { de: 'Vollst\u00e4ndig',        fr: 'Complet',            it: 'Completo',       hu: 'Teljes' },
  'week.incomplete':      { de: 'Unvollst\u00e4ndig',      fr: 'Incomplet',          it: 'Incompleto',     hu: 'Hi\u00e1nyos' },
  'week.incomplete.hint': { de: 'Einige Tage haben noch keine g\u00fcltigen Eintr\u00e4ge oder unterschreiten die Mindeststundenzahl.', fr: 'Certains jours n\'ont pas d\'entr\u00e9es valides ou sont en dessous du minimum.', it: 'Alcuni giorni non hanno voci valide o sono al di sotto del minimo.', hu: 'Egyes napokon m\u00e9g nincs \u00e9rv\u00e9nyes bejegyz\u00e9s, vagy nem \u00e9rik el a minim\u00e1lis \u00f3rasz\u00e1mot.' },
  'week.days':            { de: 'Mo | Di | Mi | Do | Fr', fr: 'Lu | Ma | Me | Je | Ve', it: 'Lu | Ma | Me | Gi | Ve', hu: 'H\u00e9 | Ke | Sze | Cs\u00fc | P\u00e9' },

  // ─── Day Card ───
  'day.fulfilled':        { de: 'Erf\u00fcllt',            fr: 'Atteint',            it: 'Raggiunto',      hu: 'Teljes\u00edtve' },
  'day.open':             { de: 'Offen',              fr: 'Ouvert',             it: 'Aperto',         hu: 'Nyitott' },
  'day.pause':            { de: '{min} Min. Pause',   fr: '{min} min. pause',   it: '{min} min. pausa', hu: '{min} perc sz\u00fcnet' },
  'day.no.pause':         { de: 'Keine Pause',        fr: 'Pas de pause',       it: 'Nessuna pausa',  hu: 'Nincs sz\u00fcnet' },
  'day.too.short':        { de: 'zu kurz',            fr: 'trop courte',        it: 'troppo breve',   hu: 't\u00fal r\u00f6vid' },
  'day.too.long':         { de: 'zu lang',            fr: 'trop longue',        it: 'troppo lunga',   hu: 't\u00fal hossz\u00fa' },
  'day.spesen':           { de: 'Spesen',             fr: 'Frais',              it: 'Spese',          hu: 'K\u00f6lts\u00e9gek' },
  'day.spesen.none':      { de: 'Keine',              fr: 'Aucun',              it: 'Nessuna',        hu: 'Nincs' },
  'day.spesen.editor.title':{ de: 'Spesen \u2014 {day}',   fr: 'Frais \u2014 {day}',      it: 'Spese \u2014 {day}', hu: 'K\u00f6lts\u00e9gek \u2014 {day}' },
  'day.spesen.count':     { de: '{n} Spesen',         fr: '{n} frais',          it: '{n} spese',      hu: '{n} k\u00f6lts\u00e9g' },
  'day.spesen.editor.hint':{ de: 'Spesen werden beim Export in den Spesenrapport \u00fcbernommen.', fr: 'Les frais seront inclus dans le rapport.', it: 'Le spese saranno incluse nel rapporto.', hu: 'A k\u00f6lts\u00e9gek export\u00e1l\u00e1skor beker\u00fclnek a Spesenrapportba.' },

  // ─── Spesen types (ExpenseEditor) ───
  'spesen.10h':           { de: 'Entsch\u00e4digung \u226510h', fr: 'D\u00e9dommagement \u226510h',  it: 'Indennit\u00e0 \u226510h', hu: 'Kompenz\u00e1ci\u00f3 \u226510h' },
  'spesen.hotel':         { de: 'Hotel',              fr: 'H\u00f4tel',              it: 'Hotel',          hu: 'Sz\u00e1lloda' },
  'spesen.transport':     { de: 'Transport (3)',      fr: 'Transport (3)',      it: 'Trasporto (3)',  hu: 'Sz\u00e1ll\u00edt\u00e1s (3)' },
  'spesen.pikett':        { de: 'Pikettdienst',       fr: 'Piquet',             it: 'Servizio di picchetto', hu: '\u00dcgyelet' },
  'spesen.pikett.ent':    { de: 'Entsch. Pikett',     fr: 'D\u00e9dommagement piquet', it: 'Suppl. picchetto', hu: '\u00dcgyeleti p\u00f3tl\u00e9k' },
  'spesen.material':      { de: 'Material',           fr: 'Mat\u00e9riel',           it: 'Materiale',      hu: 'Anyag' },
  'spesen.privat':        { de: 'Privatfahrzeug',     fr: 'V\u00e9hicule priv\u00e9',     it: 'Veicolo privato', hu: 'Saj\u00e1t g\u00e9pj\u00e1rm\u0171' },
  'spesen.active':        { de: 'Aktiv',              fr: 'Actif',              it: 'Attivo',         hu: 'Akt\u00edv' },
  'spesen.inactive':      { de: 'Aus',                fr: 'Inactif',            it: 'Inattivo',       hu: 'Inakt\u00edv' },

  // ─── Timeline / Entry list ───
  'timeline.edit':        { de: 'Bearbeiten',         fr: 'Modifier',           it: 'Modifica',       hu: 'Szerkeszt\u00e9s' },
  'timeline.delete':      { de: 'L\u00f6schen',            fr: 'Supprimer',          it: 'Elimina',        hu: 'T\u00f6rl\u00e9s' },
  'timeline.confirm.delete':{ de: 'Diesen Eintrag wirklich l\u00f6schen?', fr: 'Voulez-vous vraiment supprimer cette entr\u00e9e?', it: 'Eliminare veramente questa voce?', hu: 'Val\u00f3ban t\u00f6rli ezt a bejegyz\u00e9st?' },

  // ─── Edit Entry Bottom Sheet ───
  'edit.title':           { de: 'Eintrag bearbeiten', fr: 'Modifier l\'entr\u00e9e', it: 'Modifica voce', hu: 'Bejegyz\u00e9s szerkeszt\u00e9se' },
  'edit.cancel':          { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla',        hu: 'M\u00e9gse' },
  'edit.save':            { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva',          hu: 'Ment\u00e9s' },
  'edit.saving':          { de: 'Speichert...',       fr: 'Enregistrement...',  it: 'Salvataggio...',  hu: 'Ment\u00e9s...' },

  // ─── Export ───
  'export.title':         { de: 'Export KW {week}',   fr: 'Exporter SE {week}', it: 'Esporta SE {week}', hu: 'Export\u00e1l\u00e1s {week}. h\u00e9t' },
  'export.preview.show':  { de: 'Wochen-Vorschau anzeigen', fr: 'Afficher l\'aper\u00e7u', it: 'Mostra anteprima', hu: 'Heti el\u0151n\u00e9zet mutat\u00e1sa' },
  'export.preview.hide':  { de: 'Vorschau ausblenden',fr: 'Masquer l\'aper\u00e7u',  it: 'Nascondi anteprima', hu: 'El\u0151n\u00e9zet elrejt\u00e9se' },
  'export.preview.title': { de: 'Vorschau KW {week}', fr: 'Aper\u00e7u SE {week}',   it: 'Anteprima SE {week}', hu: '{week}. h\u00e9t el\u0151n\u00e9zete' },
  'export.zones':         { de: 'Zonen (Spesenrapport)', fr: 'Zones (rapport de frais)', it: 'Zone (rapporto spese)', hu: 'Z\u00f3n\u00e1k (Spesenrapport)' },
  'export.total':         { de: 'Gesamt: {hours}h',   fr: 'Total: {hours}h',    it: 'Totale: {hours}h', hu: '\u00d6sszesen: {hours}h' },
  'export.incomplete.title':{ de: 'Unvollst\u00e4ndige Woche', fr: 'Semaine incompl\u00e8te', it: 'Settimana incompleta', hu: 'Hi\u00e1nyos h\u00e9t' },
  'export.incomplete.hint':{ de: 'Nicht alle Tage sind vollst\u00e4ndig. Bitte \u00fcberpr\u00fcfen Sie die Eintr\u00e4ge vor dem Export.', fr: 'Tous les jours ne sont pas complets. V\u00e9rifiez les entr\u00e9es.', it: 'Non tutti i giorni sono completi. Controlla le voci.', hu: 'Nem minden nap teljes. K\u00e9rj\u00fck, ellen\u0151rizze a bejegyz\u00e9seket export\u00e1l\u00e1s el\u0151tt.' },
  'export.excel.btn':     { de: 'Excel Exportieren',  fr: 'Exporter Excel',     it: 'Esporta Excel',  hu: 'Excel export\u00e1l\u00e1sa' },
  'export.excel.loading': { de: 'Excel wird generiert...', fr: 'G\u00e9n\u00e9ration Excel...', it: 'Generazione Excel...', hu: 'Excel gener\u00e1l\u00e1sa...' },
  'export.email.btn':     { de: 'Wochenrapport per E-Mail senden', fr: 'Envoyer par e-mail', it: 'Invia per email', hu: 'K\u00fcld\u00e9s e-mailben' },
  'export.email.loading': { de: 'Wird gesendet...',   fr: 'Envoi...',           it: 'Invio...',       hu: 'K\u00fcld\u00e9s...' },
  'export.success':       { de: 'Excel erfolgreich exportiert!', fr: 'Excel export\u00e9 avec succ\u00e8s!', it: 'Excel esportato con successo!', hu: 'Excel sikeresen export\u00e1lva!' },
  'export.offline.generated': { de: 'Offline generiert (kein Backend)', fr: 'G\u00e9n\u00e9r\u00e9 hors ligne (pas de backend)', it: 'Generato offline (nessun backend)', hu: 'Offline gener\u00e1lva (nincs backend)' },
  'export.email.success': { de: 'Wochenrapport erfolgreich per E-Mail gesendet!', fr: 'Rapport envoy\u00e9 par e-mail!', it: 'Rapporto inviato per email!', hu: 'Wochenrapport sikeresen elk\u00fcldve e-mailben!' },
  'export.failed':        { de: 'Export fehlgeschlagen', fr: '\u00c9chec de l\'export', it: 'Esportazione fallita', hu: 'Export\u00e1l\u00e1s sikertelen' },
  'export.email.failed':  { de: 'E-Mail Versand fehlgeschlagen', fr: '\u00c9chec de l\'envoi', it: 'Invio email fallito', hu: 'E-mail k\u00fcld\u00e9s sikertelen' },
  'export.backend.error': { de: 'Backend-Server nicht erreichbar', fr: 'Serveur backend inaccessible', it: 'Server backend non raggiungibile', hu: 'Backend szerver nem el\u00e9rhet\u0151' },
  'export.backend.hint':  { de: 'Starte das Backend: cd apps/backend && pip install -r requirements.txt && python src/main.py', fr: 'D\u00e9marrez le backend: cd apps/backend && pip install -r requirements.txt && python src/main.py', it: 'Avvia il backend: cd apps/backend && pip install -r requirements.txt && python src/main.py', hu: 'Ind\u00edtsa el a backendet: cd apps/backend && pip install -r requirements.txt && python src/main.py' },
  'export.timeout':       { de: 'Der Server hat nicht rechtzeitig geantwortet (30s Timeout). Bitte versuchen Sie es sp\u00e4ter erneut.', fr: 'Le serveur n\'a pas r\u00e9pondu \u00e0 temps (30s). R\u00e9essayez plus tard.', it: 'Il server non ha risposto in tempo (30s). Riprova pi\u00f9 tardi.', hu: 'A szerver nem v\u00e1laszolt id\u0151ben (30 mp). K\u00e9rj\u00fck, pr\u00f3b\u00e1lja \u00fajra k\u00e9s\u0151bb.' },
  'export.info':          { de: 'Der Export generiert eine Excel-Datei basierend auf der OTIS Vorlage. Die Datei enth\u00e4lt den Stundenrapport und den Spesenrapport mit den automatisch berechneten Zonen. Sie k\u00f6nnen die Datei direkt herunterladen oder per E-Mail an Ihren Supervisor senden.', fr: 'L\'export g\u00e9n\u00e8re un fichier Excel bas\u00e9 sur le mod\u00e8le OTIS. Il contient le rapport des heures et le rapport des frais.', it: 'L\'esportazione genera un file Excel basato sul modello OTIS. Contiene il rapporto ore e il rapporto spese.', hu: 'Az export\u00e1l\u00e1s egy Excel f\u00e1jlt gener\u00e1l az OTIS sablon alapj\u00e1n. A f\u00e1jl tartalmazza az \u00f3ra- \u00e9s k\u00f6lts\u00e9griportot az automatikusan kisz\u00e1m\u00edtott z\u00f3n\u00e1kkal.' },

  // ─── Settings ───
  'settings.sync':        { de: 'Synchronisation',    fr: 'Synchronisation',    it: 'Sincronizzazione', hu: 'Szinkroniz\u00e1l\u00e1s' },
  'settings.sync.subtitle':{ de: 'Datenabgleich mit Server', fr: 'Synchronisation avec le serveur', it: 'Sincronizzazione con il server', hu: 'Adatszinkroniz\u00e1l\u00e1s a szerverrel' },
  'settings.online':      { de: 'Online',             fr: 'En ligne',           it: 'Online',         hu: 'Online' },
  'settings.offline':     { de: 'Offline',            fr: 'Hors ligne',         it: 'Offline',        hu: 'Offline' },
  'settings.status':      { de: 'Status',             fr: 'Statut',             it: 'Stato',          hu: '\u00c1llapot' },
  'settings.last.sync':   { de: 'Letzte Synchronisation', fr: 'Derni\u00e8re synchronisation', it: 'Ultima sincronizzazione', hu: 'Utols\u00f3 szinkroniz\u00e1l\u00e1s' },
  'settings.pending':     { de: 'Ausstehend',         fr: 'En attente',         it: 'In sospeso',     hu: 'F\u00fcgg\u0151ben' },
  'settings.pending.count':{ de: '{n} Eintr\u00e4ge',      fr: '{n} entr\u00e9es',        it: '{n} voci',       hu: '{n} bejegyz\u00e9s' },
  'settings.pending.none':{ de: 'Keine',              fr: 'Aucun',              it: 'Nessuno',        hu: 'Nincs' },
  'settings.sync.now':    { de: 'Jetzt synchronisieren', fr: 'Synchroniser maintenant', it: 'Sincronizza ora', hu: 'Szinkroniz\u00e1l\u00e1s most' },
  'settings.syncing':     { de: 'Synchronisiere...',  fr: 'Synchronisation...', it: 'Sincronizzazione...', hu: 'Szinkroniz\u00e1l\u00e1s...' },
  'settings.logout':      { de: 'Abmelden',           fr: 'Se d\u00e9connecter',     it: 'Esci',           hu: 'Kijelentkez\u00e9s' },
  'settings.reminder':    { de: 'Montag Erinnerung',  fr: 'Rappel lundi',       it: 'Promemoria luned\u00ec', hu: 'H\u00e9tf\u0151i eml\u00e9keztet\u0151' },
  'settings.reminder.subtitle':{ de: 'W\u00f6chentliche Benachrichtigung', fr: 'Notification hebdomadaire', it: 'Notifica settimanale', hu: 'Heti \u00e9rtes\u00edt\u00e9s' },
  'settings.reminder.active':{ de: 'Aktiv',           fr: 'Actif',              it: 'Attivo',         hu: 'Akt\u00edv' },
  'settings.reminder.inactive':{ de: 'Inaktiv',       fr: 'Inactif',            it: 'Inattivo',       hu: 'Inakt\u00edv' },
  'settings.reminder.desc':{ de: 'Jeden Montag um 07:00 Uhr', fr: 'Chaque lundi \u00e0 07:00', it: 'Ogni luned\u00ec alle 07:00', hu: 'Minden h\u00e9tf\u0151n 07:00-kor' },
  'settings.reminder.detail':{ de: 'Erinnert dich daran, den Wochenrapport an deinen Supervisor zu senden. Die Benachrichtigung erscheint als Popup auf deinem Telefon.', fr: 'Vous rappelle d\'envoyer le rapport \u00e0 votre superviseur.', it: 'Ti ricorda di inviare il rapporto al tuo supervisore.', hu: 'Eml\u00e9kezteti, hogy k\u00fcldje el a heti riportot a supervisor\u00e1nak. Az \u00e9rtes\u00edt\u00e9s felugr\u00f3 ablakk\u00e9nt jelenik meg a telefonon.' },
  'settings.reminder.activate':{ de: 'Montag Erinnerung aktivieren', fr: 'Activer le rappel du lundi', it: 'Attiva promemoria luned\u00ec', hu: 'H\u00e9tf\u0151i eml\u00e9keztet\u0151 aktiv\u00e1l\u00e1sa' },
  'settings.reminder.deactivate':{ de: 'Erinnerung deaktivieren', fr: 'D\u00e9sactiver le rappel', it: 'Disattiva promemoria', hu: 'Eml\u00e9keztet\u0151 kikapcsol\u00e1sa' },
  'settings.reminder.activating':{ de: 'Aktiviere...',fr: 'Activation...',      it: 'Attivazione...',  hu: 'Aktiv\u00e1l\u00e1s...' },
  'settings.reminder.deactivating':{ de: 'Deaktiviere...', fr: 'D\u00e9sactivation...', it: 'Disattivazione...', hu: 'Kikapcsol\u00e1s...' },
  'settings.reminder.error':{ de: 'Benachrichtigung konnte nicht aktiviert werden', fr: 'Impossible d\'activer la notification', it: 'Impossibile attivare la notifica', hu: 'Az \u00e9rtes\u00edt\u00e9s nem aktiv\u00e1lhat\u00f3' },
  'settings.app.info':    { de: 'OTIS Wochenrapport v1.0.0', fr: 'OTIS Rapport hebdomadaire v1.0.0', it: 'OTIS Rapporto settimanale v1.0.0', hu: 'OTIS Wochenrapport v1.0.0' },
  'settings.app.desc':    { de: 'Offline-First PWA f\u00fcr OTIS Servicetechniker', fr: 'PWA hors-ligne pour techniciens OTIS', it: 'PWA offline per tecnici OTIS', hu: 'Offline-First PWA OTIS szerviztechnikusoknak' },
  'settings.reminder.state':{ de: 'Montag Erinnerung: {state}', fr: 'Rappel lundi: {state}', it: 'Promemoria luned\u00ec: {state}', hu: 'H\u00e9tf\u0151i eml\u00e9keztet\u0151: {state}' },
  'settings.user':        { de: 'User: {email}',      fr: 'Utilisateur: {email}', it: 'Utente: {email}', hu: 'Felhaszn\u00e1l\u00f3: {email}' },

  // ─── Meine Lifte (Lift Manager) ───
  'lifts.title':          { de: 'Meine Lifte',        fr: 'Mes installations',  it: 'I miei impianti', hu: 'Liftjeim' },
  'lifts.count':          { de: '{n} Anlagen',        fr: '{n} installations',  it: '{n} impianti',   hu: '{n} lift' },
  'lifts.filtered':       { de: '({n} gefiltert)',    fr: '({n} filtr\u00e9s)',      it: '({n} filtrati)', hu: '({n} sz\u0171rve)' },
  'lifts.add':            { de: 'Hinzuf\u00fcgen',         fr: 'Ajouter',            it: 'Aggiungi',       hu: 'Hozz\u00e1ad\u00e1s' },
  'lifts.search.placeholder':{ de: 'Suchen... (Nr., Projekt, Adresse)', fr: 'Rechercher... (No., projet, adresse)', it: 'Cerca... (n., progetto, indirizzo)', hu: 'Keres\u00e9s... (sz\u00e1m, projekt, c\u00edm)' },
  'lifts.notfound':       { de: 'Keine Anlagen gefunden', fr: 'Aucune installation trouv\u00e9e', it: 'Nessun impianto trovato', hu: 'Nincs tal\u00e1lat' },
  'lifts.notfound.hint':  { de: 'Versuche einen anderen Suchbegriff', fr: 'Essayez un autre terme de recherche', it: 'Prova un altro termine di ricerca', hu: 'Pr\u00f3b\u00e1ljon m\u00e1sik keres\u0151sz\u00f3t' },
  'lifts.empty':          { de: 'Noch keine Anlagen gespeichert', fr: 'Aucune installation enregistr\u00e9e', it: 'Nessun impianto salvato', hu: 'M\u00e9g nincsenek mentett liftek' },
  'lifts.empty.hint':     { de: 'Anlagen erscheinen hier nach dem ersten Erfassen', fr: 'Les installations apparaissent apr\u00e8s la premi\u00e8re saisie', it: 'Gli impianti appaiono dopo la prima registrazione', hu: 'A liftek itt jelennek meg az els\u0151 r\u00f6gz\u00edt\u00e9s ut\u00e1n' },
  'lifts.add.title':      { de: 'Neue Anlage hinzuf\u00fcgen', fr: 'Ajouter une installation', it: 'Aggiungi impianto', hu: '\u00daj lift hozz\u00e1ad\u00e1sa' },
  'lifts.add.nr':         { de: 'Anlagen-Nr.',        fr: 'No. d\'installation', it: 'N. impianto',    hu: 'Lift sz\u00e1m' },
  'lifts.add.project':    { de: 'Projekt-Nr.',        fr: 'No. de projet',      it: 'N. progetto',    hu: 'Projekt sz\u00e1m' },
  'lifts.add.address':    { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo',      hu: 'C\u00edm' },
  'lifts.add.zone':       { de: 'Zone',               fr: 'Zone',               it: 'Zona',           hu: 'Z\u00f3na' },
  'lifts.add.btn':        { de: 'Hinzuf\u00fcgen',         fr: 'Ajouter',            it: 'Aggiungi',       hu: 'Hozz\u00e1ad\u00e1s' },
  'lifts.add.cancel':     { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla',        hu: 'M\u00e9gse' },
  'lifts.add.error.required':{ de: 'Bitte Anlagen-Nr. eingeben', fr: 'Veuillez entrer le No. d\'installation', it: 'Inserisci il N. impianto', hu: 'K\u00e9rj\u00fck, adja meg a lift sz\u00e1mot' },
  'lifts.add.error.exists':{ de: '{nr} existiert bereits', fr: '{nr} existe d\u00e9j\u00e0', it: '{nr} esiste gi\u00e0', hu: '{nr} m\u00e1r l\u00e9tezik' },
  'lifts.saved':          { de: '{nr} gespeichert',   fr: '{nr} enregistr\u00e9',    it: '{nr} salvato',   hu: '{nr} elmentve' },
  'lifts.deleted':        { de: '{nr} gel\u00f6scht',      fr: '{nr} supprim\u00e9',      it: '{nr} eliminato', hu: '{nr} t\u00f6r\u00f6lve' },
  'lifts.added':          { de: '{nr} hinzugef\u00fcgt',   fr: '{nr} ajout\u00e9',        it: '{nr} aggiunto',  hu: '{nr} hozz\u00e1adva' },
  'lifts.save.error':     { de: 'Fehler beim Speichern', fr: 'Erreur d\'enregistrement', it: 'Errore di salvataggio', hu: 'Hiba a ment\u00e9skor' },
  'lifts.delete.error':   { de: 'Fehler beim L\u00f6schen',fr: 'Erreur de suppression', it: 'Errore di eliminazione', hu: 'Hiba a t\u00f6rl\u00e9skor' },
  'lifts.add.error':      { de: 'Fehler beim Hinzuf\u00fcgen', fr: 'Erreur d\'ajout', it: 'Errore di aggiunta', hu: 'Hiba a hozz\u00e1ad\u00e1skor' },
  'lifts.confirm.delete': { de: '{nr} wirklich l\u00f6schen?', fr: 'Voulez-vous vraiment supprimer {nr}?', it: 'Eliminare veramente {nr}?', hu: 'Val\u00f3ban t\u00f6rli {nr}?' },
  'lifts.delete.btn':     { de: 'L\u00f6schen',            fr: 'Supprimer',          it: 'Elimina',        hu: 'T\u00f6rl\u00e9s' },
  'lifts.delete.no':      { de: 'Nein',               fr: 'Non',                it: 'No',             hu: 'Nem' },
  'lifts.zone.auto':      { de: '\u2014 Auto (0)',         fr: '\u2014 Auto (0)',         it: '\u2014 Auto (0)',   hu: '\u2014 Auto (0)' },
  'lifts.zone.1':         { de: 'Zone 1 (<10 km)',    fr: 'Zone 1 (<10 km)',    it: 'Zona 1 (<10 km)', hu: '1. z\u00f3na (<10 km)' },
  'lifts.zone.2':         { de: 'Zone 2 (<30 km)',    fr: 'Zone 2 (<30 km)',    it: 'Zona 2 (<30 km)', hu: '2. z\u00f3na (<30 km)' },
  'lifts.zone.3':         { de: 'Zone 3 (<60 km)',    fr: 'Zone 3 (<60 km)',    it: 'Zona 3 (<60 km)', hu: '3. z\u00f3na (<60 km)' },
  'lifts.zone.4':         { de: 'Zone 4 (>60 km)',    fr: 'Zone 4 (>60 km)',    it: 'Zona 4 (>60 km)', hu: '4. z\u00f3na (>60 km)' },
  'lifts.edit.project':   { de: 'Projekt-Nr.',        fr: 'No. de projet',      it: 'N. progetto',    hu: 'Projekt sz\u00e1m' },
  'lifts.edit.address':   { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo',      hu: 'C\u00edm' },
  'lifts.edit.save':      { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva',          hu: 'Ment\u00e9s' },
  'lifts.edit.cancel':    { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla',        hu: 'M\u00e9gse' },
  'lifts.edit.title':     { de: 'Bearbeiten',         fr: 'Modifier',           it: 'Modifica',       hu: 'Szerkeszt\u00e9s' },
  'lifts.refresh':        { de: 'Aktualisieren',      fr: 'Actualiser',         it: 'Aggiorna',       hu: 'Friss\u00edt\u00e9s' },

  // ─── Language Switcher ───
  'language.title':       { de: 'Sprache',            fr: 'Langue',             it: 'Lingua',         hu: 'Nyelv' },
  'language.subtitle':    { de: 'App-Sprache \u00e4ndern', fr: 'Changer la langue de l\'app', it: 'Cambia lingua dell\'app', hu: 'Alkalmaz\u00e1s nyelv\u00e9nek m\u00f3dos\u00edt\u00e1sa' },

  // ─── QuickAdd ───
  'quickadd.1':           { de: '+0.5h',              fr: '+0.5h',              it: '+0.5h',          hu: '+0.5h' },
  'quickadd.2':           { de: '+1h',                fr: '+1h',                it: '+1h',            hu: '+1h' },

  // ─── Timeline ───
  'timeline.lunch':      { de: 'Mittag',           fr: 'Pause midi',        it: 'Pausa pranzo',     hu: 'Eb\u00e9d' },

  // ─── Common / Miscellaneous ───
  'common.loading':       { de: 'Lade...',            fr: 'Chargement...',      it: 'Caricamento...',  hu: 'Bet\u00f6lt\u00e9s...' },
  'common.saved':         { de: 'Gespeichert \u2713',            fr: 'Enregistr\u00e9 \u2713',      it: 'Salvato \u2713',     hu: 'Elmentve \u2713' },
  'common.saving':        { de: 'Speichert...',       fr: 'Enregistrement...',  it: 'Salvataggio...',  hu: 'Ment\u00e9s...' },
  'common.error':         { de: 'Fehler',             fr: 'Erreur',             it: 'Errore',         hu: 'Hiba' },
  'common.backend.unreachable':{ de: 'Backend-Server nicht erreichbar ({url}).', fr: 'Serveur inaccessible ({url}).', it: 'Server non raggiungibile ({url}).', hu: 'Backend szerver nem el\u00e9rhet\u0151 ({url}).' },
  'common.backend.warmup':{ de: 'Server aufw\u00e4rmen',    fr: 'Pr\u00e9chauffer le serveur', it: 'Riscaldamento server', hu: 'Szerver fel\u00e9breszt\u00e9se' },
  'common.backend.warmup.desc':{ de: 'Der Server startet nach Inaktivit\u00e4t neu (Cold Start). Ein Klick weckt ihn \u2014 danach l\u00e4uft der Export schneller.', fr: 'Le serveur red\u00e9marre apr\u00e8s inactivit\u00e9. Un clic le r\u00e9veille.', it: 'Il server si riattiva dopo inattivit\u00e0. Un clic lo riattiva.', hu: 'A szerver inaktivit\u00e1s ut\u00e1n \u00fajraindul. Egy kattint\u00e1s fel\u00e9breszti \u2014 ut\u00e1na az export gyorsabb.' },
  'common.backend.warming':{ de: 'W\u00e4rmt auf... (kann 15\u201330s dauern)', fr: 'Pr\u00e9chauffage... (15\u201330s)', it: 'Riscaldamento... (15\u201330s)', hu: '\u00c9breszt\u00e9s... (15\u201330 mp)' },
  'common.backend.warm':  { de: 'Server bereit \u2713',    fr: 'Serveur pr\u00eat \u2713',      it: 'Server pronto \u2713', hu: 'Szerver k\u00e9szen \u2713' },
  'common.otis':          { de: 'OTIS Elevator Company', fr: 'OTIS Elevator Company', it: 'OTIS Elevator Company', hu: 'OTIS Elevator Company' },
}

/** Shortcut for day names */
export const DAY_NAMES: Record<Language, string[]> = {
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
  fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'],
  it: ['Luned\u00ec', 'Marted\u00ec', 'Mercoled\u00ec', 'Gioved\u00ec', 'Venerd\u00ec'],
  hu: ['H\u00e9tf\u0151', 'Kedd', 'Szerda', 'Cs\u00fct\u00f6rt\u00f6k', 'P\u00e9ntek'],
}

export const DAY_ABBR: Record<Language, string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  fr: ['Lu', 'Ma', 'Me', 'Je', 'Ve'],
  it: ['Lu', 'Ma', 'Me', 'Gi', 'Ve'],
  hu: ['H\u00e9', 'Ke', 'Sze', 'Cs\u00fc', 'P\u00e9'],
}
