/**
 * Multi-language translations for the OTIS Wochenrapport app.
 * DE = German (default), FR = French, IT = Italian
 */

export type Language = 'de' | 'fr' | 'it'

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
]

export type TranslationDict = Record<string, Record<Language, string>>

/** All user-facing text, organized by component section. */
export const translations: TranslationDict = {
  // ─── App shell / navigation ───
  'nav.dashboard':        { de: 'Dashboard',        fr: 'Tableau de bord',    it: 'Dashboard' },
  'nav.week':             { de: 'Woche',             fr: 'Semaine',            it: 'Settimana' },
  'nav.export':           { de: 'Export',            fr: 'Exporter',           it: 'Esporta' },
  'nav.settings':         { de: 'Einstellungen',     fr: 'Paramètres',         it: 'Impostazioni' },
  'nav.settings.short':   { de: 'Einstellungen',     fr: 'Paramètres',         it: 'Impostazioni' },
  'nav.subtitle.settings':{ de: 'Profil, Synchronisation & mehr', fr: 'Profil, synchronisation & plus', it: 'Profilo, sincronizzazione & altro' },
  'app.name':             { de: 'Wochenrapport',     fr: 'Rapport hebdomadaire', it: 'Rapporto settimanale' },
  'app.subtitle':         { de: 'Für OTIS Servicetechniker', fr: 'Pour techniciens OTIS', it: 'Per tecnici OTIS' },

  // ─── Auth (Login / Register / Profile) ───
  'auth.login.title':     { de: 'Anmelden',          fr: 'Connexion',          it: 'Accedi' },
  'auth.login.btn':       { de: 'Anmelden',          fr: 'Se connecter',       it: 'Accedi' },
  'auth.login.loading':   { de: 'Anmelden...',       fr: 'Connexion...',       it: 'Accesso in corso...' },
  'auth.register.title':  { de: 'Konto erstellen',   fr: 'Créer un compte',    it: 'Crea account' },
  'auth.register.btn':    { de: 'Registrieren',      fr: "S'inscrire",         it: 'Registrati' },
  'auth.register.loading':{ de: 'Registrieren...',   fr: 'Inscription...',     it: 'Registrazione...' },
  'auth.register.subtitle':{ de: 'Registrierung für OTIS Wochenrapport', fr: 'Inscription pour OTIS', it: 'Registrazione per OTIS' },
  'auth.email':           { de: 'E-Mail',            fr: 'E-mail',             it: 'Email' },
  'auth.email.placeholder':{ de: 'name@otis.com',    fr: 'name@otis.com',      it: 'nome@otis.com' },
  'auth.password':        { de: 'Passwort',          fr: 'Mot de passe',       it: 'Password' },
  'auth.password.confirm':{ de: 'Passwort bestätigen',fr: 'Confirmer mot de passe', it: 'Conferma password' },
  'auth.no.account':      { de: 'Noch kein Konto?',  fr: "Pas encore de compte?", it: 'Non hai un account?' },
  'auth.has.account':     { de: 'Bereits registriert?',fr: 'Déjà inscrit?',    it: 'Già registrato?' },
  'auth.switch.login':    { de: 'Anmelden',          fr: 'Se connecter',       it: 'Accedi' },
  'auth.switch.register': { de: 'Registrieren',      fr: "S'inscrire",         it: 'Registrati' },
  'auth.password.mismatch':{ de: 'Passwörter stimmen nicht überein', fr: 'Les mots de passe ne correspondent pas', it: 'Le password non corrispondono' },
  'auth.password.short':  { de: 'Passwort muss mindestens 6 Zeichen lang sein', fr: 'Le mot de passe doit contenir au moins 6 caractères', it: 'La password deve contenere almeno 6 caratteri' },
  'auth.name.required':   { de: 'Bitte geben Sie Ihren Namen ein', fr: 'Veuillez entrer votre nom', it: 'Inserisci il tuo nome' },
  'auth.personnel.required':{ de: 'Bitte geben Sie Ihre Personalnummer ein', fr: 'Veuillez entrer votre numéro de personnel', it: 'Inserisci il tuo numero di matricola' },

  // ─── Profile Setup ───
  'profile.title':        { de: 'Profil Einstellungen', fr: 'Paramètres du profil', it: 'Impostazioni profilo' },
  'profile.subtitle':     { de: 'Persönliche Informationen verwalten', fr: 'Gérer les informations personnelles', it: 'Gestisci informazioni personali' },
  'profile.name':         { de: 'Vollständiger Name', fr: 'Nom complet',        it: 'Nome completo' },
  'profile.name.placeholder':{ de: 'Max Mustermann',  fr: 'Max Mustermann',     it: 'Mario Rossi' },
  'profile.personnel':    { de: 'Personalnummer',     fr: 'Numéro de personnel', it: 'Numero di matricola' },
  'profile.personnel.placeholder':{ de: 'z.B. 4563',  fr: 'p.ex. 4563',         it: 'es. 4563' },
  'profile.supervisor':   { de: 'Supervisor E-Mail',  fr: 'E-mail du superviseur', it: 'Email del supervisore' },
  'profile.supervisor.placeholder':{ de: 'supervisor@otis.com', fr: 'superviseur@otis.com', it: 'supervisore@otis.com' },
  'profile.saved':        { de: 'Profil erfolgreich gespeichert!', fr: 'Profil enregistré avec succès!', it: 'Profilo salvato con successo!' },
  'profile.save':         { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva' },
  'profile.saving':       { de: 'Speichern...',       fr: 'Enregistrement...',  it: 'Salvataggio...' },

  // ─── Dashboard / Day ───
  'dashboard.today':      { de: 'Heutige Einträge',   fr: 'Entrées du jour',    it: 'Voci di oggi' },
  'dashboard.progress':   { de: 'Erfüllt',            fr: 'Atteint',            it: 'Raggiunto' },
  'dashboard.missing':    { de: 'Fehlt {hours}h',     fr: 'Manque {hours}h',    it: 'Mancano {hours}h' },
  'dashboard.lunch':      { de: 'Mittagspause: {min} Min.', fr: 'Pause déjeuner: {min} min.', it: 'Pausa pranzo: {min} min.' },
  'dashboard.entries':    { de: '{count} Einträge',   fr: '{count} entrées',    it: '{count} voci' },
  'dashboard.pause.recorded':{ de: 'Pause erfasst ✓', fr: 'Pause enregistrée ✓', it: 'Pausa registrata ✓' },
  'dashboard.quickadd.title':{ de: 'Schnelles Hinzufügen', fr: 'Ajout rapide', it: 'Aggiunta rapida' },
  'dashboard.quickadd.subtitle':{ de: 'Mehr Zeit auf bestehenden Eintrag', fr: 'Ajouter du temps à une entrée existante', it: 'Aggiungi tempo a voce esistente' },

  // ─── Time Entry Form ───
  'entry.title':          { de: 'Neuen Eintrag erfassen', fr: 'Nouvelle entrée', it: 'Nuova voce' },
  'entry.lunch.btn':      { de: 'Mittagspause +',     fr: 'Pause déjeuner +',  it: 'Pausa pranzo +' },
  'entry.lunch.active':   { de: 'Mittagspause eingetragen', fr: 'Pause déjeuner enregistrée', it: 'Pausa pranzo registrata' },
  'entry.lunch.save':     { de: 'Mittagspause erfassen', fr: 'Enregistrer pause', it: 'Registra pausa' },
  'entry.anlagenummer':   { de: 'Anlagen-Nr. / Lift', fr: 'No. d\'installation', it: 'N. impianto' },
  'entry.search.placeholder':{ de: 'Suchen... (z.B. AEV17, 1DG02)', fr: 'Rechercher... (p.ex. AEV17)', it: 'Cerca... (es. AEV17)' },
  'entry.projekt':        { de: 'Projekt-Nr.',        fr: 'No. de projet',     it: 'N. progetto' },
  'entry.projekt.placeholder':{ de: 'z.B. SDAFQL, SCZREF, KAE827', fr: 'p.ex. SDAFQL', it: 'es. SDAFQL' },
  'entry.address':        { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo' },
  'entry.address.placeholder':{ de: 'z.B. Winterthur Industriestrasse 24', fr: 'p.ex. Winterthur Industriestrasse 24', it: 'es. Winterthur Industriestrasse 24' },
  'entry.address.hint':   { de: 'Ort und Strasse — wird automatisch ausgefüllt bei Lift-Auswahl', fr: 'Lieu et rue — rempli automatiquement', it: 'Luogo e via — compilato automaticamente' },
  'entry.from.database':  { de: 'Aus Datenbank:',     fr: 'De la base de données:', it: 'Dal database:' },
  'entry.beginn':         { de: 'Beginn',             fr: 'Début',              it: 'Inizio' },
  'entry.beginn.hint':    { de: '15-Minuten-Schritte (7:30, 7:45, 8:00, …)', fr: 'Pas de 15 minutes', it: 'Intervalli di 15 minuti' },
  'entry.dauer':          { de: 'Dauer (OTIS)',       fr: 'Durée (OTIS)',       it: 'Durata (OTIS)' },
  'entry.activity':       { de: 'Tätigkeit',          fr: 'Activité',           it: 'Attività' },
  'entry.activity.select':{ de: 'Tätigkeit auswählen', fr: 'Choisir une activité', it: 'Seleziona attività' },
  'entry.activity.picker.title':{ de: 'Tätigkeit auswählen', fr: 'Choisir une activité', it: 'Seleziona attività' },
  'entry.spesen':         { de: 'Spesen (optional)',  fr: 'Frais (optionnel)',  it: 'Spese (opzionale)' },
  'entry.save':           { de: 'Eintrag erfassen',   fr: 'Enregistrer l\'entrée', it: 'Registra voce' },
  'entry.overlap':        { de: 'Zeitüberschneidung!',fr: 'Chevauchement!',     it: 'Sovrapposizione!' },

  // ─── Activity Picker ───
  'activity.productive':      { de: 'Produktiv',      fr: 'Productif',          it: 'Produttivo' },
  'activity.productive.sublabel':{ de: 'NK, S, T, T Clot, O, QI, VM, VP, NM/NTC/NF/VC, QI SCOTT', fr: 'NK, S, T, T Clot, O, QI, VM, VP, NM/NTC/NF/VC, QI SCOTT', it: 'NK, S, T, T Clot, O, QI, VM, VP, NM/NTC/NF/VC, QI SCOTT' },
  'activity.nonproductive':    { de: 'Improduktiv',   fr: 'Improductif',        it: 'Improduttivo' },
  'activity.nonproductive.sublabel':{ de: 'I04, I5S, I5Q, I5T, I5A', fr: 'I04, I5S, I5Q, I5T, I5A', it: 'I04, I5S, I5Q, I5T, I5A' },
  'activity.absence':          { de: 'Abwesenheit',   fr: 'Absence',            it: 'Assenza' },
  'activity.absence.sublabel': { de: 'A01-Ferien, A02-Militär, A03-Krankheit, A04-Unfall, A05-Abwesenheit, A07-Kompensation', fr: 'A01-Vacances, A02-Militaire, A03-Maladie, A04-Accident, A05-Absence, A07-Compensation', it: 'A01-Vacanze, A02-Militare, A03-Malattia, A04-Infortunio, A05-Assenza, A07-Compensazione' },
  'activity.options':         { de: '{n} Optionen',   fr: '{n} options',        it: '{n} opzioni' },
  'activity.codes':           { de: '{n} Codes',      fr: '{n} codes',          it: '{n} codici' },

  // ─── Top 5 Recent Lifts ───
  'favorites.title':      { de: 'Letzte Anlagen',     fr: 'Dernières installations', it: 'Ultimi impianti' },

  // ─── Week Overview ───
  'week.title':           { de: 'KW {number}',        fr: 'SE {number}',         it: 'SE {number}' },
  'week.total':           { de: 'Total',              fr: 'Total',              it: 'Totale' },
  'week.days.complete':   { de: '{valid}/{total} Tage vollständig', fr: '{valid}/{total} jours complets', it: '{valid}/{total} giorni completi' },
  'week.complete':        { de: 'Vollständig',        fr: 'Complet',            it: 'Completo' },
  'week.incomplete':      { de: 'Unvollständig',      fr: 'Incomplet',          it: 'Incompleto' },
  'week.incomplete.hint': { de: 'Einige Tage haben noch keine gültigen Einträge oder unterschreiten die Mindeststundenzahl.', fr: 'Certains jours n\'ont pas d\'entrées valides ou sont en dessous du minimum.', it: 'Alcuni giorni non hanno voci valide o sono al di sotto del minimo.' },
  'week.days':            { de: 'Mo | Di | Mi | Do | Fr', fr: 'Lu | Ma | Me | Je | Ve', it: 'Lu | Ma | Me | Gi | Ve' },

  // ─── Day Card ───
  'day.fulfilled':        { de: 'Erfüllt',            fr: 'Atteint',            it: 'Raggiunto' },
  'day.open':             { de: 'Offen',              fr: 'Ouvert',             it: 'Aperto' },
  'day.pause':            { de: '{min} Min. Pause',   fr: '{min} min. pause',   it: '{min} min. pausa' },
  'day.no.pause':         { de: 'Keine Pause',        fr: 'Pas de pause',       it: 'Nessuna pausa' },
  'day.too.short':        { de: 'zu kurz',            fr: 'trop courte',        it: 'troppo breve' },
  'day.too.long':         { de: 'zu lang',            fr: 'trop longue',        it: 'troppo lunga' },
  'day.spesen':           { de: 'Spesen',             fr: 'Frais',              it: 'Spese' },
  'day.spesen.none':      { de: 'Keine',              fr: 'Aucun',              it: 'Nessuna' },
  'day.spesen.editor.title':{ de: 'Spesen — {day}',   fr: 'Frais — {day}',      it: 'Spese — {day}' },
  'day.spesen.count':     { de: '{n} Spesen',         fr: '{n} frais',          it: '{n} spese' },
  'day.spesen.editor.hint':{ de: 'Spesen werden beim Export in den Spesenrapport übernommen.', fr: 'Les frais seront inclus dans le rapport.', it: 'Le spese saranno incluse nel rapporto.' },

  // ─── Spesen types (ExpenseEditor) ───
  'spesen.10h':           { de: 'Entschädigung ≥10h', fr: 'Dédommagement ≥10h',  it: 'Indennità ≥10h' },
  'spesen.hotel':         { de: 'Hotel',              fr: 'Hôtel',              it: 'Hotel' },
  'spesen.transport':     { de: 'Transport (3)',      fr: 'Transport (3)',      it: 'Trasporto (3)' },
  'spesen.pikett':        { de: 'Pikettdienst',       fr: 'Piquet',             it: 'Servizio di picchetto' },
  'spesen.pikett.ent':    { de: 'Entsch. Pikett',     fr: 'Dédommagement piquet', it: 'Suppl. picchetto' },
  'spesen.material':      { de: 'Material',           fr: 'Matériel',           it: 'Materiale' },
  'spesen.privat':        { de: 'Privatfahrzeug',     fr: 'Véhicule privé',     it: 'Veicolo privato' },
  'spesen.active':        { de: 'Aktiv',              fr: 'Actif',              it: 'Attivo' },
  'spesen.inactive':      { de: 'Aus',                fr: 'Inactif',            it: 'Inattivo' },

  // ─── Timeline / Entry list ───
  'timeline.edit':        { de: 'Bearbeiten',         fr: 'Modifier',           it: 'Modifica' },
  'timeline.delete':      { de: 'Löschen',            fr: 'Supprimer',          it: 'Elimina' },
  'timeline.confirm.delete':{ de: 'Diesen Eintrag wirklich löschen?', fr: 'Voulez-vous vraiment supprimer cette entrée?', it: 'Eliminare veramente questa voce?' },

  // ─── Edit Entry Bottom Sheet ───
  'edit.title':           { de: 'Eintrag bearbeiten', fr: 'Modifier l\'entrée', it: 'Modifica voce' },
  'edit.cancel':          { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla' },
  'edit.save':            { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva' },
  'edit.saving':          { de: 'Speichert...',       fr: 'Enregistrement...',  it: 'Salvataggio...' },

  // ─── Export ───
  'export.title':         { de: 'Export KW {week}',   fr: 'Exporter SE {week}', it: 'Esporta SE {week}' },
  'export.preview.show':  { de: 'Wochen-Vorschau anzeigen', fr: 'Afficher l\'aperçu', it: 'Mostra anteprima' },
  'export.preview.hide':  { de: 'Vorschau ausblenden',fr: 'Masquer l\'aperçu',  it: 'Nascondi anteprima' },
  'export.preview.title': { de: 'Vorschau KW {week}', fr: 'Aperçu SE {week}',   it: 'Anteprima SE {week}' },
  'export.zones':         { de: 'Zonen (Spesenrapport)', fr: 'Zones (rapport de frais)', it: 'Zone (rapporto spese)' },
  'export.total':         { de: 'Gesamt: {hours}h',   fr: 'Total: {hours}h',    it: 'Totale: {hours}h' },
  'export.incomplete.title':{ de: 'Unvollständige Woche', fr: 'Semaine incomplète', it: 'Settimana incompleta' },
  'export.incomplete.hint':{ de: 'Nicht alle Tage sind vollständig. Bitte überprüfen Sie die Einträge vor dem Export.', fr: 'Tous les jours ne sont pas complets. Vérifiez les entrées.', it: 'Non tutti i giorni sono completi. Controlla le voci.' },
  'export.excel.btn':     { de: 'Excel Exportieren',  fr: 'Exporter Excel',     it: 'Esporta Excel' },
  'export.excel.loading': { de: 'Excel wird generiert...', fr: 'Génération Excel...', it: 'Generazione Excel...' },
  'export.email.btn':     { de: 'Wochenrapport per E-Mail senden', fr: 'Envoyer par e-mail', it: 'Invia per email' },
  'export.email.loading': { de: 'Wird gesendet...',   fr: 'Envoi...',           it: 'Invio...' },
  'export.success':       { de: 'Excel erfolgreich exportiert!', fr: 'Excel exporté avec succès!', it: 'Excel esportato con successo!' },
  'export.email.success': { de: 'Wochenrapport erfolgreich per E-Mail gesendet!', fr: 'Rapport envoyé par e-mail!', it: 'Rapporto inviato per email!' },
  'export.failed':        { de: 'Export fehlgeschlagen', fr: 'Échec de l\'export', it: 'Esportazione fallita' },
  'export.email.failed':  { de: 'E-Mail Versand fehlgeschlagen', fr: 'Échec de l\'envoi', it: 'Invio email fallito' },
  'export.backend.error': { de: 'Backend-Server nicht erreichbar', fr: 'Serveur backend inaccessible', it: 'Server backend non raggiungibile' },
  'export.backend.hint':  { de: 'Starte das Backend: cd apps/backend && pip install -r requirements.txt && python src/main.py', fr: 'Démarrez le backend: cd apps/backend && pip install -r requirements.txt && python src/main.py', it: 'Avvia il backend: cd apps/backend && pip install -r requirements.txt && python src/main.py' },
  'export.timeout':       { de: 'Der Server hat nicht rechtzeitig geantwortet (30s Timeout). Bitte versuchen Sie es später erneut.', fr: 'Le serveur n\'a pas répondu à temps (30s). Réessayez plus tard.', it: 'Il server non ha risposto in tempo (30s). Riprova più tardi.' },
  'export.info':          { de: 'Der Export generiert eine Excel-Datei basierend auf der OTIS Vorlage. Die Datei enthält den Stundenrapport und den Spesenrapport mit den automatisch berechneten Zonen. Sie können die Datei direkt herunterladen oder per E-Mail an Ihren Supervisor senden.', fr: 'L\'export génère un fichier Excel basé sur le modèle OTIS. Il contient le rapport des heures et le rapport des frais.', it: 'L\'esportazione genera un file Excel basato sul modello OTIS. Contiene il rapporto ore e il rapporto spese.' },

  // ─── Settings ───
  'settings.sync':        { de: 'Synchronisation',    fr: 'Synchronisation',    it: 'Sincronizzazione' },
  'settings.sync.subtitle':{ de: 'Datenabgleich mit Server', fr: 'Synchronisation avec le serveur', it: 'Sincronizzazione con il server' },
  'settings.online':      { de: 'Online',             fr: 'En ligne',           it: 'Online' },
  'settings.offline':     { de: 'Offline',            fr: 'Hors ligne',         it: 'Offline' },
  'settings.status':      { de: 'Status',             fr: 'Statut',             it: 'Stato' },
  'settings.last.sync':   { de: 'Letzte Synchronisation', fr: 'Dernière synchronisation', it: 'Ultima sincronizzazione' },
  'settings.pending':     { de: 'Ausstehend',         fr: 'En attente',         it: 'In sospeso' },
  'settings.pending.count':{ de: '{n} Einträge',      fr: '{n} entrées',        it: '{n} voci' },
  'settings.pending.none':{ de: 'Keine',              fr: 'Aucun',              it: 'Nessuno' },
  'settings.sync.now':    { de: 'Jetzt synchronisieren', fr: 'Synchroniser maintenant', it: 'Sincronizza ora' },
  'settings.syncing':     { de: 'Synchronisiere...',  fr: 'Synchronisation...', it: 'Sincronizzazione...' },
  'settings.logout':      { de: 'Abmelden',           fr: 'Se déconnecter',     it: 'Esci' },
  'settings.reminder':    { de: 'Montag Erinnerung',  fr: 'Rappel lundi',       it: 'Promemoria lunedì' },
  'settings.reminder.subtitle':{ de: 'Wöchentliche Benachrichtigung', fr: 'Notification hebdomadaire', it: 'Notifica settimanale' },
  'settings.reminder.active':{ de: 'Aktiv',           fr: 'Actif',              it: 'Attivo' },
  'settings.reminder.inactive':{ de: 'Inaktiv',       fr: 'Inactif',            it: 'Inattivo' },
  'settings.reminder.desc':{ de: 'Jeden Montag um 07:00 Uhr', fr: 'Chaque lundi à 07:00', it: 'Ogni lunedì alle 07:00' },
  'settings.reminder.detail':{ de: 'Erinnert dich daran, den Wochenrapport an deinen Supervisor zu senden. Die Benachrichtigung erscheint als Popup auf deinem Telefon.', fr: 'Vous rappelle d\'envoyer le rapport à votre superviseur.', it: 'Ti ricorda di inviare il rapporto al tuo supervisore.' },
  'settings.reminder.activate':{ de: 'Montag Erinnerung aktivieren', fr: 'Activer le rappel du lundi', it: 'Attiva promemoria lunedì' },
  'settings.reminder.deactivate':{ de: 'Erinnerung deaktivieren', fr: 'Désactiver le rappel', it: 'Disattiva promemoria' },
  'settings.reminder.activating':{ de: 'Aktiviere...',fr: 'Activation...',      it: 'Attivazione...' },
  'settings.reminder.deactivating':{ de: 'Deaktiviere...', fr: 'Désactivation...', it: 'Disattivazione...' },
  'settings.reminder.error':{ de: 'Benachrichtigung konnte nicht aktiviert werden', fr: 'Impossible d\'activer la notification', it: 'Impossibile attivare la notifica' },
  'settings.app.info':    { de: 'OTIS Wochenrapport v1.0.0', fr: 'OTIS Rapport hebdomadaire v1.0.0', it: 'OTIS Rapporto settimanale v1.0.0' },
  'settings.app.desc':    { de: 'Offline-First PWA für OTIS Servicetechniker', fr: 'PWA hors-ligne pour techniciens OTIS', it: 'PWA offline per tecnici OTIS' },
  'settings.reminder.state':{ de: 'Montag Erinnerung: {state}', fr: 'Rappel lundi: {state}', it: 'Promemoria lunedì: {state}' },
  'settings.user':        { de: 'User: {email}',      fr: 'Utilisateur: {email}', it: 'Utente: {email}' },

  // ─── Meine Lifte (Lift Manager) ───
  'lifts.title':          { de: 'Meine Lifte',        fr: 'Mes installations',  it: 'I miei impianti' },
  'lifts.count':          { de: '{n} Anlagen',        fr: '{n} installations',  it: '{n} impianti' },
  'lifts.filtered':       { de: '({n} gefiltert)',    fr: '({n} filtrés)',      it: '({n} filtrati)' },
  'lifts.add':            { de: 'Hinzufügen',         fr: 'Ajouter',            it: 'Aggiungi' },
  'lifts.search.placeholder':{ de: 'Suchen... (Nr., Projekt, Adresse)', fr: 'Rechercher... (No., projet, adresse)', it: 'Cerca... (n., progetto, indirizzo)' },
  'lifts.notfound':       { de: 'Keine Anlagen gefunden', fr: 'Aucune installation trouvée', it: 'Nessun impianto trovato' },
  'lifts.notfound.hint':  { de: 'Versuche einen anderen Suchbegriff', fr: 'Essayez un autre terme de recherche', it: 'Prova un altro termine di ricerca' },
  'lifts.empty':          { de: 'Noch keine Anlagen gespeichert', fr: 'Aucune installation enregistrée', it: 'Nessun impianto salvato' },
  'lifts.empty.hint':     { de: 'Anlagen erscheinen hier nach dem ersten Erfassen', fr: 'Les installations apparaissent après la première saisie', it: 'Gli impianti appaiono dopo la prima registrazione' },
  'lifts.add.title':      { de: 'Neue Anlage hinzufügen', fr: 'Ajouter une installation', it: 'Aggiungi impianto' },
  'lifts.add.nr':         { de: 'Anlagen-Nr.',        fr: 'No. d\'installation', it: 'N. impianto' },
  'lifts.add.project':    { de: 'Projekt-Nr.',        fr: 'No. de projet',      it: 'N. progetto' },
  'lifts.add.address':    { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo' },
  'lifts.add.zone':       { de: 'Zone',               fr: 'Zone',               it: 'Zona' },
  'lifts.add.btn':        { de: 'Hinzufügen',         fr: 'Ajouter',            it: 'Aggiungi' },
  'lifts.add.cancel':     { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla' },
  'lifts.add.error.required':{ de: 'Bitte Anlagen-Nr. eingeben', fr: 'Veuillez entrer le No. d\'installation', it: 'Inserisci il N. impianto' },
  'lifts.add.error.exists':{ de: '{nr} existiert bereits', fr: '{nr} existe déjà', it: '{nr} esiste già' },
  'lifts.saved':          { de: '{nr} gespeichert',   fr: '{nr} enregistré',    it: '{nr} salvato' },
  'lifts.deleted':        { de: '{nr} gelöscht',      fr: '{nr} supprimé',      it: '{nr} eliminato' },
  'lifts.added':          { de: '{nr} hinzugefügt',   fr: '{nr} ajouté',        it: '{nr} aggiunto' },
  'lifts.save.error':     { de: 'Fehler beim Speichern', fr: 'Erreur d\'enregistrement', it: 'Errore di salvataggio' },
  'lifts.delete.error':   { de: 'Fehler beim Löschen',fr: 'Erreur de suppression', it: 'Errore di eliminazione' },
  'lifts.add.error':      { de: 'Fehler beim Hinzufügen', fr: 'Erreur d\'ajout', it: 'Errore di aggiunta' },
  'lifts.confirm.delete': { de: '{nr} wirklich löschen?', fr: 'Voulez-vous vraiment supprimer {nr}?', it: 'Eliminare veramente {nr}?' },
  'lifts.delete.btn':     { de: 'Löschen',            fr: 'Supprimer',          it: 'Elimina' },
  'lifts.delete.no':      { de: 'Nein',               fr: 'Non',                it: 'No' },
  'lifts.zone.auto':      { de: '— Auto (0)',         fr: '— Auto (0)',         it: '— Auto (0)' },
  'lifts.zone.1':         { de: 'Zone 1 (<10 km)',    fr: 'Zone 1 (<10 km)',    it: 'Zona 1 (<10 km)' },
  'lifts.zone.2':         { de: 'Zone 2 (<30 km)',    fr: 'Zone 2 (<30 km)',    it: 'Zona 2 (<30 km)' },
  'lifts.zone.3':         { de: 'Zone 3 (<60 km)',    fr: 'Zone 3 (<60 km)',    it: 'Zona 3 (<60 km)' },
  'lifts.zone.4':         { de: 'Zone 4 (>60 km)',    fr: 'Zone 4 (>60 km)',    it: 'Zona 4 (>60 km)' },
  'lifts.edit.project':   { de: 'Projekt-Nr.',        fr: 'No. de projet',      it: 'N. progetto' },
  'lifts.edit.address':   { de: 'Adresse',            fr: 'Adresse',            it: 'Indirizzo' },
  'lifts.edit.save':      { de: 'Speichern',          fr: 'Enregistrer',        it: 'Salva' },
  'lifts.edit.cancel':    { de: 'Abbrechen',          fr: 'Annuler',            it: 'Annulla' },
  'lifts.edit.title':     { de: 'Bearbeiten',         fr: 'Modifier',           it: 'Modifica' },
  'lifts.refresh':        { de: 'Aktualisieren',      fr: 'Actualiser',         it: 'Aggiorna' },

  // ─── Language Switcher ───
  'language.title':       { de: 'Sprache',            fr: 'Langue',             it: 'Lingua' },
  'language.subtitle':    { de: 'App-Sprache ändern', fr: 'Changer la langue de l\'app', it: 'Cambia lingua dell\'app' },

  // ─── QuickAdd ───
  'quickadd.1':           { de: '+0.5h',              fr: '+0.5h',              it: '+0.5h' },
  'quickadd.2':           { de: '+1h',                fr: '+1h',                it: '+1h' },

  // ─── Timeline ───
  'timeline.lunch':      { de: 'Mittag',           fr: 'Pause midi',        it: 'Pausa pranzo' },

  // ─── Common / Miscellaneous ───
  'common.loading':       { de: 'Lade...',            fr: 'Chargement...',      it: 'Caricamento...' },
  'common.saving':        { de: 'Speichert...',       fr: 'Enregistrement...',  it: 'Salvataggio...' },
  'common.error':         { de: 'Fehler',             fr: 'Erreur',             it: 'Errore' },
  'common.backend.unreachable':{ de: 'Backend-Server nicht erreichbar ({url}).', fr: 'Serveur inaccessible ({url}).', it: 'Server non raggiungibile ({url}).' },
  'common.otis':          { de: 'OTIS Elevator Company', fr: 'OTIS Elevator Company', it: 'OTIS Elevator Company' },
}

/** Shortcut for day names */
export const DAY_NAMES: Record<Language, string[]> = {
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
  fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'],
  it: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'],
}

export const DAY_ABBR: Record<Language, string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  fr: ['Lu', 'Ma', 'Me', 'Je', 'Ve'],
  it: ['Lu', 'Ma', 'Me', 'Gi', 'Ve'],
}
