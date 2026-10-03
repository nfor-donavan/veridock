// Tiny translation layer: the English text is the key, French is looked up. Unknown strings stay in English.
const KEY = 'vd_lang';
let lang = (() => { try { return localStorage.getItem(KEY) || ((navigator.language || 'fr').startsWith('en') ? 'en' : 'fr'); } catch { return 'fr'; } })();
export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem(KEY, l); } catch {} document.documentElement.lang = l; }
document.documentElement.lang = lang;

const FR = {
  // common
  'd': 'j',
  'Sign in': 'Se connecter', 'Signing in…': 'Connexion…', 'Sign out': 'Se déconnecter', 'Email': 'E-mail', 'Password': 'Mot de passe', 'Cancel': 'Annuler', 'Close': 'Fermer', 'Save': 'Enregistrer', 'Loading…': 'Chargement…',
  'Something went wrong': 'Une erreur est survenue', 'Change language': 'Changer de langue', 'Toggle light or dark mode': 'Basculer entre mode clair et mode sombre', 'Containers': 'Conteneurs', 'Performance': 'Performance', 'Demurrage tariff': 'Tarif des surestaries',
  // login
  'Transit Desk sign in': 'Connexion au Transit Desk', 'Every stamp, every receipt, on the record.': 'Chaque cachet, chaque reçu, dûment consigné.',
  'Veridock gives importers live, document-backed visibility into customs clearance at Douala and Kribi.': 'Veridock offre aux importateurs une visibilité en direct, preuves à l’appui, sur le dédouanement à Douala et à Kribi.', 'Platform owner': 'Propriétaire de la plateforme',
  // dashboard
  'Safe': 'Sûr', 'Nearing limit': 'Limite proche', 'Critical': 'Critique', 'Fines accruing': 'Surestaries en cours', 'Cleared': 'Sorti', 'All containers': 'Tous les conteneurs',
  '{n} container(s) need paperwork pushed today to avoid or stop demurrage.': '{n} conteneur(s) nécessitent des démarches aujourd’hui pour éviter ou arrêter les surestaries.',
  'Estimated demurrage so far across all containers:': 'Surestaries estimées à ce jour pour tous les conteneurs :', 'Search container, B/L or importer': 'Rechercher un conteneur, un B/L ou un importateur', 'Register container': 'Enregistrer un conteneur',
  'Container': 'Conteneur', 'Importer': 'Importateur', 'Line': 'Compagnie', 'Progress': 'Avancement', 'Free days left': 'Jours gratuits restants', 'Est. storage charges': 'Frais de stockage estimés', 'Status': 'Statut', 'Step {n} of 6': 'Étape {n} sur 6',
  'None yet': 'Aucun pour l’instant', 'No containers match. Register a container to start tracking it.': 'Aucun conteneur trouvé. Enregistrez un conteneur pour commencer le suivi.',
  // register
  'Register a container': 'Enregistrer un conteneur', 'Bill of lading': 'Connaissement (B/L)', 'Container number': 'Numéro de conteneur', 'CAMCIS reference (optional)': 'Référence CAMCIS (facultatif)', 'Importer name': 'Nom de l’importateur', 'Importer phone': 'Téléphone de l’importateur',
  'Container type': 'Type de conteneur', 'Shipping line': 'Compagnie maritime', 'Free demurrage days': 'Jours gratuits de surestaries', 'Arrival date': 'Date d’arrivée', 'Port': 'Port', 'Douala': 'Douala', 'Kribi': 'Kribi', 'SMS language for the importer': 'Langue des SMS pour l’importateur',
  'This bill of lading already exists in your agency.': 'Ce connaissement existe déjà dans votre agence.',
  // drawer
  'Container details': 'Détails du conteneur', 'free day(s) left of {n}': 'jour(s) gratuit(s) restant(s) sur {n}', 'day(s) past the free period': 'jour(s) après le délai gratuit', 'Estimated storage charges (demurrage)': 'Frais de stockage estimés (surestaries)', 'Storage charges (carrier tariff)': 'Frais de stockage (tarif de la compagnie)',
  'None so far': 'Aucun à ce jour', 'chargeable day(s)': 'jour(s) facturable(s)', 'at the extended-stay rate': 'au tarif de séjour prolongé', 'now adding {a} to {b} XAF per day': 'actuellement {a} à {b} XAF de plus par jour',
  'Phone': 'Téléphone', 'Arrived': 'Arrivé', 'at': 'à', 'CAMCIS ref': 'Réf. CAMCIS', 'Not recorded': 'Non enregistrée', 'Change': 'Modifier', 'Add': 'Ajouter', 'CAMCIS declaration reference': 'Référence de la déclaration CAMCIS',
  'Copy tracking link': 'Copier le lien de suivi', 'Copied': 'Copié', 'Clearance report (PDF)': 'Rapport de dédouanement (PDF)', 'Clearance record': 'Dossier de dédouanement', 'View proof': 'Voir le justificatif', 'Needs review': 'À vérifier', 'Reviewed': 'Vérifié',
  'Manifest registered': 'Manifeste enregistré', 'Declaration lodged': 'Déclaration déposée', 'Duties assessed': 'Droits liquidés', 'Duties paid': 'Droits payés', 'Inspection': 'Inspection', 'Gate pass issued': 'Bon à enlever délivré',
  'Move to: {step}': 'Passer à : {step}', 'Drop the stamped document here, or tap to take a photo': 'Déposez ici le document tamponné, ou touchez pour prendre une photo', 'Note for the record (optional)': 'Note pour le dossier (facultatif)', 'Saving…': 'Enregistrement…',
  'Confirm milestone and notify importer': 'Confirmer l’étape et prévenir l’importateur', 'All milestones complete. The demurrage clock stopped at gate pass.': 'Toutes les étapes sont terminées. Le compteur des surestaries s’est arrêté au bon à enlever.',
  'Reverse last milestone (manager)': 'Annuler la dernière étape (responsable)', 'Why is this milestone being reversed? (recorded in the audit trail)': 'Pourquoi annuler cette étape ? (consigné dans l’historique)',
  'Audit trail': 'Historique', 'Reversed': 'Annulée', 'Advanced': 'Validée', 'Messages sent': 'Messages envoyés', 'No SMS sent yet.': 'Aucun SMS envoyé.', 'to': 'vers',
  'Mark as reviewed': 'Marquer comme vérifié', 'Reviewed by {name}': 'Vérifié par {name}', 'Note about your review (optional)': 'Note sur votre vérification (facultatif)',
  'No camera data: possibly a screenshot, forwarded copy or edited image.': 'Aucune donnée d’appareil photo : peut-être une capture d’écran, une copie transférée ou une image retouchée.', 'Saved by image-editing software.': 'Enregistré avec un logiciel de retouche d’image.',
  'Photo taken more than 3 days before upload.': 'Photo prise plus de 3 jours avant le dépôt.', 'Photo taken before the container arrived.': 'Photo prise avant l’arrivée du conteneur.', 'Photo date is in the future (phone clock changed?).': 'La date de la photo est dans le futur (horloge du téléphone modifiée ?).', 'This exact file was already used before.': 'Ce fichier exact a déjà été utilisé.',
  'Proof document is required to move this milestone.': 'Un justificatif est obligatoire pour valider cette étape.', 'The file content is not a valid JPG, PNG, WEBP or PDF.': 'Le contenu du fichier n’est pas un JPG, PNG, WEBP ou PDF valide.', 'The file is too small to be a real document photo or scan.': 'Le fichier est trop petit pour être une vraie photo ou un vrai scan.',
  // alerts
  'Alerts': 'Alertes', 'No alerts yet.': 'Aucune alerte pour l’instant.', 'SMS alerts to my phone': 'Alertes SMS sur mon téléphone', 'Phone number': 'Numéro de téléphone', 'Saved': 'Enregistré',
  // analytics
  'Loading performance…': 'Chargement des performances…', 'Average clearance time': 'Durée moyenne de dédouanement', 'days': 'jours', 'container(s) cleared': 'conteneur(s) sortis', 'Slowest step': 'Étape la plus lente', 'Not enough data yet': 'Pas encore assez de données', 'Containers with fines': 'Conteneurs avec surestaries',
  'Past the free period': 'Au-delà du délai gratuit', 'Estimated demurrage (XAF)': 'Surestaries estimées (XAF)', '{n} day(s) past free time': '{n} jour(s) au-delà du délai gratuit', 'Where time is spent': 'Où le temps est perdu', 'Average days from the previous milestone to each step.': 'Nombre moyen de jours entre l’étape précédente et chaque étape.',
  'No data': 'Pas de données', 'By shipping line': 'Par compagnie maritime', 'Containers handled': 'Conteneurs traités', 'Avg days to clear': 'Jours moyens pour sortir', 'Days over free period': 'Jours au-delà du délai gratuit', 'Est. charges (XAF)': 'Frais estimés (XAF)', 'Staff activity': 'Activité du personnel', 'Operator': 'Opérateur', 'Milestones logged': 'Étapes enregistrées', 'No milestones logged yet.': 'Aucune étape enregistrée.',
  '{n} proof document(s) flagged and waiting for a manager review.': '{n} justificatif(s) signalé(s) en attente de vérification par un responsable.',
  'Arrival & manifest registered': 'Arrivée et manifeste enregistrés', 'Declaration lodged in CAMCIS': 'Déclaration déposée dans CAMCIS', 'Duties assessed (liquidation)': 'Droits liquidés', 'Duties paid at bank': 'Droits payés à la banque', 'Scan / physical inspection': 'Scanner / visite physique', 'Gate pass issued (Bon à enlever)': 'Bon à enlever délivré',
  // tariff
  'Demurrage tariff': 'Tarif des surestaries', 'Estimates cover the port transit phase only: storage of full containers inside the terminal, counted until the gate pass is issued. Detention (holding the container outside the terminal during unpacking) starts after gate-out and is not included.': 'Les estimations couvrent uniquement la phase de transit portuaire : stockage des conteneurs pleins dans le terminal, jusqu’à la délivrance du bon à enlever. La détention (conteneur gardé hors du terminal pendant le dépotage) commence après la sortie et n’est pas incluse.',
  'Agency default rates': 'Tarifs par défaut de l’agence', 'Minimum per day (XAF)': 'Minimum par jour (XAF)', 'Maximum per day (XAF)': 'Maximum par jour (XAF)', 'Extended-stay rate starts after calendar day': 'Le tarif de séjour prolongé commence après le jour calendaire', 'Extended-stay rate multiplier': 'Multiplicateur du tarif de séjour prolongé',
  'Per shipping line (exact amounts)': 'Par compagnie maritime (montants exacts)', 'Enter a fixed rate per day for a line and its amounts become exact instead of a range. Leave a field empty to use the agency default.': 'Saisissez un tarif fixe par jour pour une compagnie et ses montants deviennent exacts au lieu d’une fourchette. Laissez vide pour utiliser le tarif par défaut de l’agence.',
  'Free days': 'Jours gratuits', 'Save tariff': 'Enregistrer le tarif', 'Tariff saved. All amounts now use these rates.': 'Tarif enregistré. Tous les montants utilisent désormais ces tarifs.', 'Loading tariff…': 'Chargement du tarif…',
  // owner
  'Platform owner console': 'Console du propriétaire de la plateforme', 'Back to Transit Desk': 'Retour au Transit Desk', 'Agencies': 'Agences', 'Onboard a new agency': 'Ajouter une nouvelle agence', 'Agency name': 'Nom de l’agence', 'Customs licence number': 'Numéro d’agrément douanier', 'Manager name': 'Nom du responsable', 'Manager email': 'E-mail du responsable', 'Manager password (8+ characters)': 'Mot de passe du responsable (8 caractères minimum)', 'Manager phone (optional)': 'Téléphone du responsable (facultatif)',
  'Create agency': 'Créer l’agence', 'Agency created.': 'Agence créée.', 'Active': 'Active', 'Suspended': 'Suspendue', 'Suspend': 'Suspendre', 'Reactivate': 'Réactiver', 'users': 'utilisateurs', 'containers': 'conteneurs', 'Reset a manager password': 'Réinitialiser un mot de passe de responsable', 'New password': 'Nouveau mot de passe', 'Reset password': 'Réinitialiser', 'Password updated.': 'Mot de passe mis à jour.', 'No agencies yet.': 'Aucune agence pour l’instant.',
  'Email or password is incorrect': 'E-mail ou mot de passe incorrect', 'This agency account is suspended.': 'Ce compte d’agence est suspendu.', 'That licence number or email already exists.': 'Ce numéro d’agrément ou cet e-mail existe déjà.', 'The manager password needs at least 8 characters.': 'Le mot de passe du responsable doit comporter au moins 8 caractères.', 'Please sign in again': 'Veuillez vous reconnecter', 'Failed to fetch': 'Connexion au serveur impossible',
  'Give a reason of at least 10 characters.': 'Indiquez un motif d’au moins 10 caractères.', 'Enter the full CAMCIS reference.': 'Saisissez la référence CAMCIS complète.', 'Only a manager can change a recorded CAMCIS reference.': 'Seul un responsable peut modifier une référence CAMCIS enregistrée.', 'Manager role required': 'Rôle de responsable requis'
};
export function t(s, vars) {
  let o = (lang === 'fr' && FR[s]) || s;
  if (vars) for (const [k, v] of Object.entries(vars)) o = o.split(`{${k}}`).join(v);
  return o;
}
