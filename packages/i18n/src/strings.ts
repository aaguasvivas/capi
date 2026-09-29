// NOTE: apps/mobile/targets/messages/CapiStrings.swift duplicates the iMessage
// bubble captions and drawer strings (yourTurnGeneric/yourTurnFor/roundWon/
// gameWon/gameWonTeam/invite1v1/invite2v2/inviteRematch/join/create/tableNotFound/
// openInCapi/yourName/connectionError/retry/cancel). Bubbles
// render without JS, so they cannot read this file. If you change tone or
// wording here, update CapiStrings.swift to match (swiftParity.test.ts fails
// until you do).

export type Lang = "es" | "en";

export * from "./chat";
export * from "./errors";
export * from "./rules";

export interface Strings {
  // Landing
  tagline: string;
  createGame: string;
  joinGame: string;
  noAccount: string;

  // Forms
  yourName: string;
  yourColor: string;
  table: string;
  mode: string;
  inviteCode: string;
  creating: string;
  createAction: string;
  joining: string;
  joinAction: string;
  namePlaceholder: string;
  joinNamePlaceholder: string;

  // Themes
  themeClassic: string;
  themeBarrio: string;
  themeOutdoors: string;

  // Store / IAP
  store: string;
  owned: string;
  restorePurchases: string;
  restoreDone: (n: number) => string;
  purchaseFailed: string;
  removeAdsTitle: string;
  removeAdsDesc: string;
  todoCapiTitle: string;
  todoCapiDesc: string;
  privacyPolicy: string;
  fichasLabel: string;
  // Premium theme names + descs
  themeQuisqueya: string;
  themeQuisqueyaDesc: string;
  themeLarimar: string;
  themeLarimarDesc: string;
  themeNoche: string;
  themeNocheDesc: string;
  fichasClasico: string;
  fichasClasicoDesc: string;
  fichasQuisqueyaDesc: string;
  fichasBorinquenDesc: string;
  fichasKingstonDesc: string;

  // Waiting room
  waitingForPlayers: (n: number) => string;
  preparing: string;
  shareLink: string;
  copied: string;
  copyLink: string;
  orShareCode: string;
  codeCopied: string;
  autoRefresh: string;
  conTuFrente: string;

  // Seats
  seatNorth: string;
  seatEast: string;
  seatSouth: string;
  seatWest: string;
  team1: string;
  team2: string;
  // The 2v2 waiting room legend: which seats make up each team.
  seatsNS: string;
  seatsEW: string;

  // In-game
  firstTo: string;
  youTag: string;
  yourHand: string;
  yourTurn: string;
  waitingTurn: string;
  partner: string;
  opponent: string;
  partnerTag: string;
  tileCount: (n: number) => string;
  tilesLabel: string;
  boneyard: string;
  emptyTable: string;

  // Actions
  leftEnd: string;
  rightEnd: string;
  draw: (n: number) => string;
  pass: string;

  // Callout overlay
  points: string;
  bonus: string;
  capicuaBonus: string;
  // The tranque comparison: the blocker and the player to his right, with
  // the pips each one holds.
  tranqueCompare: (blocker: string, blockerPips: number, rival: string, rivalPips: number) => string;
  // Under the tranque comparison on equal pips: the player who opened the
  // round wins it.
  tranqueTie: (opener: string) => string;
  // Callout titles: the words players shout at the table, the same in both
  // languages. Veinticinco is the pase corrido banner, salida the pase de
  // salida banner (both a mid-round +25).
  calloutDomino: string;
  calloutTrancao: string;
  calloutCapicua: string;
  calloutVeinticinco: string;
  calloutSalida: string;
  tapToContinue: string;

  // Round over
  wonRound: string;
  lostRound: string;
  pips: string;
  nextRound: string;
  nextRoundLoading: string;

  // Game over
  won: string;
  lost: string;
  wonFlavor: string;
  lostFlavor: string;
  playAgain: string;
  creatingRematch: string;
  joinRematch: string;
  rematchReady: string;

  // System
  loading: string;
  backToHome: string;
  networkError: string;
  gameNotFound: string;
  // The embedded (iMessage) table's load errors: no invite code to check
  // there, and Retry instead of a link to the website.
  tableNotFound: string;
  retry: string;
  failedCreate: string;
  failedJoin: string;
  connectionError: string;

  // Sound
  enableSound: string;
  muteSound: string;

  // QuickChat
  closeTray: string;
  quickChat: string;

  // Toast
  opponentDrew: (n: number) => string;

  // Errors
  errorStartRound: string;

  // Target score
  score100: string;
  score200: string;

  // Bug reports
  reportBug: string;
  reportBugTitle: string;
  reportBugPrompt: string;
  reportBugPlaceholder: string;
  reportBugSend: string;
  reportBugSending: string;
  reportBugSent: string;
  reportBugCancel: string;
  reportBugFailed: string;
  // Shown in the report form: the form is not a chat to the opponent.
  reportBugNotChat: string;

  // Footer
  footerPrivacy: string;
  footerSupport: string;
  howToPlay: string;
  notFoundTitle: string;
  back: string;

  // Round-over award clarity
  pipsInHand: string;
  awardedTo: string;

  // Table presence + connection
  you: string;
  roundEnded: string;
  connectionLive: string;
  connectionReconnecting: string;
  connectionOffline: string;
  waitingFor: (name: string) => string;
  awayHint: string;
  // Claim window: the seat on turn has been silent; the other side may end it.
  stalledFor: (name: string, time: string) => string;
  claimHint: string;
  // Warning to the seat on turn once the other side can claim soon.
  claimWarnMe: string;
  // A seat passed (other players' view).
  passed: (name: string) => string;
  claimWin: string;
  claimWinConfirm: string;
  wonByForfeit: (name: string) => string;
  lostByForfeit: (name: string) => string;
  youForfeited: string;
  endedByForfeit: (name: string) => string;
  turnOf: (name: string) => string;
  refresh: string;
  leaveTable: string;
  leaveConfirm: string;
  resumeGame: string;
  resumeGameHint: (code: string) => string;

  // Sessionless game page
  spectating: string;
  spectatingHint: string;
  joinTable: string;
  teamWins: (name: string) => string;
  cancel: string;
  failedRematch: string;

  // Playing a tile
  playOnEnd: (pip: number) => string;

  // Join by link states
  joinLookupLoading: string;
  joinLookupNotFound: string;
  joinLookupFull: string;
  joinLookupStarted: string;
  joiningTableOf: (name: string) => string;
  codeIs6: string;

  // Server and engine errors, by key (see errors.ts)
  errNotYourTurn: string;
  errMustPlay: string;
  errMustDraw: string;
  errClaimTooEarly: string;
  errClaimOwnSide: string;
  errClaimTurnBased: string;
  errRematchNotFinished: string;
  errNicknameRequired: string;
  errServer: string;
  errTileMismatch: string;
  errMoveFailed: string;
  errStale: string;
  errNotAtTable: string;
  errGameFull: string;
  errGameStarted: string;
  errNotInPlay: string;

  // Store honesty
  storeUnavailable: string;
  restoreFailed: string;
  priceUnknown: string;
  purchasePending: string;
  adPrivacyOptions: string;
  purchaseErrorProduct: string;
  purchaseErrorStore: string;

  // iMessage extension bubbles and drawer, mirrored verbatim in
  // apps/mobile/targets/messages/CapiStrings.swift (see swiftParity.test.ts)
  yourTurnGeneric: string;
  yourTurnFor: (name: string) => string;
  roundWon: (name: string) => string;
  gameWon: (name: string) => string;
  // A 2v2 game result names the winning side ("Ana & Rosa").
  gameWonTeam: (name: string) => string;
  invite1v1: string;
  invite2v2: string;
  inviteRematch: string;
  openInCapi: string;
  // The app, on a table started in Messages: a move made in the app posts
  // no bubble, so the chat never hears about it.
  playInMessages: string;
}

export const es: Strings = {
  tagline: "Dominó Dominicano",
  createGame: "Crear partida",
  joinGame: "Unirse",
  noAccount: "Sin cuenta. Pon tu nombre y juega.",

  yourName: "Tu nombre",
  yourColor: "Tu color",
  table: "Mesa",
  mode: "Modo",
  inviteCode: "Código",
  creating: "Creando…",
  createAction: "Crear partida",
  joining: "Entrando…",
  joinAction: "Unirse",
  namePlaceholder: "ej. ElJefe",
  joinNamePlaceholder: "ej. ElTiburón",

  themeClassic: "La clásica",
  themeBarrio: "Del barrio",
  themeOutdoors: "Al aire libre",

  store: "Tienda",
  owned: "Tuyo",
  restorePurchases: "Restaurar compras",
  restoreDone: (n) => (n > 0 ? "Compras restauradas" : "No hay compras que restaurar"),
  purchaseFailed: "No se pudo completar la compra",
  removeAdsTitle: "Quitar anuncios",
  removeAdsDesc: "Sin anuncios para siempre",
  todoCapiTitle: "Todo Capi",
  todoCapiDesc: "Quita los anuncios y desbloquea los 6 diseños",
  privacyPolicy: "Política de privacidad",
  fichasLabel: "Fichas",
  themeQuisqueya: "Quisqueya",
  themeQuisqueyaDesc: "Azul y oro",
  themeLarimar: "Larimar",
  themeLarimarDesc: "Piedra nacional",
  themeNoche: "Capi Noche",
  themeNocheDesc: "Neón y oro",
  fichasClasico: "Clásico",
  fichasClasicoDesc: "El de siempre",
  fichasQuisqueyaDesc: "Bandera RD",
  fichasBorinquenDesc: "Bandera PR",
  fichasKingstonDesc: "Bandera JM",

  waitingForPlayers: (n) => `Esperando ${n} jugador${n !== 1 ? "es" : ""}…`,
  preparing: "Preparando…",
  shareLink: "Comparte este enlace:",
  copied: "¡Copiado!",
  copyLink: "Copiar enlace",
  orShareCode: "o comparte el código",
  codeCopied: "¡Código copiado!",
  autoRefresh: "La página se actualizará cuando se unan.",
  conTuFrente: "Con tu frente",

  seatNorth: "Norte",
  seatEast: "Este",
  seatSouth: "Sur",
  seatWest: "Oeste",
  team1: "Equipo 1",
  team2: "Equipo 2",
  seatsNS: "N-S",
  seatsEW: "E-O",

  firstTo: "Primero a",
  youTag: "(tú)",
  yourHand: "Tu mano",
  yourTurn: "¡Tu turno!",
  waitingTurn: "Esperando turno…",
  partner: "Compañero",
  opponent: "Oponente",
  partnerTag: "(frente)",
  tileCount: (n) => `${n} ficha${n !== 1 ? "s" : ""}`,
  tilesLabel: "fichas",
  boneyard: "Pozo",
  emptyTable: "Mesa vacía",

  leftEnd: "← Izquierda",
  rightEnd: "Derecha →",
  draw: (n) => `Jalar (${n})`,
  pass: "Pasar",

  points: "puntos",
  bonus: "bonus",
  capicuaBonus: "bonus Capicúa",
  tranqueCompare: (blocker, blockerPips, rival, rivalPips) =>
    `Tranque: ${blocker} ${blockerPips} · ${rival} ${rivalPips}`,
  tranqueTie: (opener) => `Empate: gana ${opener}, que salió`,
  calloutDomino: "¡DOMINÓ!",
  calloutTrancao: "¡TRANCAO!",
  calloutCapicua: "¡CAPICÚA!",
  calloutVeinticinco: "¡VEINTICINCO!",
  calloutSalida: "¡PASE DE SALIDA!",
  tapToContinue: "Toca para continuar",

  wonRound: "¡Ganaste la ronda!",
  lostRound: "Perdiste la ronda",
  pips: "pips",
  nextRound: "Siguiente Ronda →",
  nextRoundLoading: "Preparando…",

  won: "¡GANASTE!",
  lost: "Perdiste",
  wonFlavor: "¡Eso e' lo que hay!",
  lostFlavor: "La próxima va pa' ti",
  playAgain: "Jugar otra vez",
  creatingRematch: "Creando…",
  joinRematch: "Ir a la revancha",
  rematchReady: "La revancha ya está servida",

  loading: "Cargando…",
  backToHome: "Volver al inicio",
  networkError: "Error de conexión",
  gameNotFound: "Partida no encontrada",
  tableNotFound: "Esa mesa ya no existe",
  retry: "Reintentar",
  failedCreate: "Error al crear partida",
  failedJoin: "Error al unirse",
  connectionError: "Error de conexión",

  enableSound: "Activar sonido",
  muteSound: "Silenciar",

  closeTray: "Cerrar",
  quickChat: "Chat rápido",

  opponentDrew: (n) => `Oponente jaló ${n} ficha${n !== 1 ? "s" : ""}`,

  errorStartRound: "Error al iniciar ronda",

  score100: "100 puntos",
  score200: "200 puntos",

  reportBug: "Reportar un problema",
  reportBugTitle: "Reportar un problema",
  reportBugPrompt:
    "Esto le llega al equipo de Capi, no a tu oponente. Cuéntanos qué pasó; mandamos el estado de la partida para poder arreglarlo.",
  reportBugNotChat: "Para hablarle a tu oponente, usa el chat 💬 de la mesa.",
  reportBugPlaceholder: "Ej: Mis fichas desaparecieron después de pasar…",
  reportBugSend: "Enviar a Capi",
  reportBugSending: "Enviando…",
  reportBugSent: "¡Gracias! Reporte recibido.",
  reportBugCancel: "Cancelar",
  reportBugFailed: "No se pudo enviar. Intenta de nuevo.",

  footerPrivacy: "Privacidad",
  footerSupport: "Soporte",
  howToPlay: "Cómo se juega",
  notFoundTitle: "Esta página no existe",
  back: "Volver",

  pipsInHand: "Pintas en mano",
  awardedTo: "para",

  you: "Tú",
  roundEnded: "Ronda terminada",
  connectionLive: "En vivo",
  connectionReconnecting: "Reconectando…",
  connectionOffline: "Sin conexión",
  waitingFor: (name) => `Esperando a ${name}…`,
  awayHint: "Parece que se desconectó",
  stalledFor: (name, time) => `${name} lleva ${time} sin jugar`,
  claimHint: "A los 2 minutos sin jugada puedes reclamar la partida.",
  claimWarnMe: "Juega pronto: a los 2 minutos sin jugada, el otro lado puede reclamar la partida.",
  passed: (name) => `${name} pasó`,
  claimWin: "Reclamar la partida",
  claimWinConfirm:
    "La partida termina aquí y tu lado gana por abandono. ¿Seguro?",
  wonByForfeit: (name) => `${name} no volvió a jugar. Ganaste la partida.`,
  lostByForfeit: (name) => `${name} dejó de jugar y la partida terminó.`,
  youForfeited: "Dejaste de jugar y el otro lado reclamó la partida.",
  endedByForfeit: (name) => `${name} dejó de jugar. La partida terminó.`,
  turnOf: (name) => `Turno de ${name}`,
  refresh: "Actualizar",
  leaveTable: "Salir de la mesa",
  leaveConfirm:
    "¿Salir de la mesa? La partida sigue y puedes volver desde el inicio. Si pasas 2 minutos sin jugar, el otro lado puede reclamar la partida.",
  resumeGame: "Volver a tu partida",
  resumeGameHint: (code) => `Mesa ${code}`,

  spectating: "Solo mirando",
  spectatingHint: "Esta mesa está llena. Puedes mirar la partida.",
  joinTable: "Unirse a la mesa",
  teamWins: (name) => `Ganó ${name}`,
  cancel: "Cancelar",
  failedRematch: "No se pudo armar la revancha",

  playOnEnd: (pip) => `Jugar en el ${pip}`,

  joinLookupLoading: "Buscando la mesa…",
  joinLookupNotFound: "Esa mesa ya no existe",
  joinLookupFull: "Esa mesa está llena",
  joinLookupStarted: "Esa partida ya empezó",
  joiningTableOf: (name) => `Uniéndote a la mesa de ${name}`,
  codeIs6: "El código tiene 6 letras",

  errNotYourTurn: "No es tu turno",
  errMustPlay: "Tienes ficha para jugar",
  errMustDraw: "Primero jala del pozo",
  errClaimTooEarly: "Todavía no. Espera a que pasen 2 minutos sin jugada.",
  errClaimOwnSide: "Le toca a tu lado, así que no hay nada que reclamar.",
  errClaimTurnBased: "Las partidas de iMessage no se reclaman: cada quien juega a su ritmo.",
  errRematchNotFinished: "La partida todavía no termina.",
  errNicknameRequired: "Escribe tu nombre.",
  errServer: "Algo falló en el servidor. Intenta de nuevo.",
  errTileMismatch: "Esa ficha no pega ahí",
  errMoveFailed: "No se pudo jugar",
  errStale: "La mesa cambió, actualizando…",
  errNotAtTable: "No estás en esta mesa",
  errGameFull: "Esa mesa está llena",
  errGameStarted: "Esa partida ya empezó",
  errNotInPlay: "La partida no está en juego",

  storeUnavailable: "La tienda no responde ahora",
  restoreFailed: "No se pudo conectar con la App Store",
  priceUnknown: "Ver precio",
  purchasePending: "Tu compra está esperando aprobación. Se desbloquea cuando la aprueben.",
  adPrivacyOptions: "Opciones de privacidad de anuncios",
  purchaseErrorProduct: "Ese producto no está disponible todavía",
  purchaseErrorStore: "La App Store no respondió",

  yourTurnGeneric: "Te toca",
  yourTurnFor: (name) => `Te toca, ${name}`,
  roundWon: (name) => `${name} ganó la ronda`,
  gameWon: (name) => `${name} ganó el juego`,
  gameWonTeam: (name) => `${name} ganaron el juego`,
  invite1v1: "¡A jugar dominó! 1v1",
  invite2v2: "¡Dominó 2v2! Toca para sentarte",
  inviteRematch: "¡Revancha! Toca para jugar",
  openInCapi: "Abrir en Capi",
  playInMessages: "Esta mesa es de Mensajes. Juega allá: una jugada hecha aquí no le avisa al chat.",
};

export const en: Strings = {
  tagline: "Dominican Dominoes",
  createGame: "Start a game",
  joinGame: "Join up",
  noAccount: "No sign-up. Just drop your name and run it.",

  yourName: "Your name",
  yourColor: "Your color",
  table: "Table",
  mode: "Mode",
  inviteCode: "Code",
  creating: "Setting up…",
  createAction: "Start game",
  joining: "Pulling up…",
  joinAction: "Join game",
  namePlaceholder: "e.g. ElJefe",
  joinNamePlaceholder: "e.g. ElTiburón",

  themeClassic: "The classic",
  themeBarrio: "From the block",
  themeOutdoors: "Outside vibes",

  store: "Store",
  owned: "Owned",
  restorePurchases: "Restore Purchases",
  restoreDone: (n) => (n > 0 ? "Purchases restored" : "No purchases to restore"),
  purchaseFailed: "Purchase could not be completed",
  removeAdsTitle: "Remove Ads",
  removeAdsDesc: "No more banner ads, forever",
  todoCapiTitle: "All of Capi",
  todoCapiDesc: "Removes ads and unlocks all 6 designs",
  privacyPolicy: "Privacy Policy",
  fichasLabel: "Tiles",
  themeQuisqueya: "Quisqueya",
  themeQuisqueyaDesc: "Navy and gold",
  themeLarimar: "Larimar",
  themeLarimarDesc: "The national stone",
  themeNoche: "Capi Noche",
  themeNocheDesc: "Neon and gold",
  fichasClasico: "Classic",
  fichasClasicoDesc: "The original",
  fichasQuisqueyaDesc: "DR flag",
  fichasBorinquenDesc: "PR flag",
  fichasKingstonDesc: "JM flag",

  waitingForPlayers: (n) => `Waiting on ${n} more…`,
  preparing: "Hold on…",
  shareLink: "Send them the link:",
  copied: "Copied!",
  copyLink: "Copy link",
  orShareCode: "or share the code",
  codeCopied: "Code copied!",
  autoRefresh: "Page updates when they pull up.",
  conTuFrente: "With your partner",

  seatNorth: "North",
  seatEast: "East",
  seatSouth: "South",
  seatWest: "West",
  team1: "Team 1",
  team2: "Team 2",
  seatsNS: "N-S",
  seatsEW: "E-W",

  firstTo: "First to",
  youTag: "(you)",
  yourHand: "Your hand",
  yourTurn: "You're up!",
  waitingTurn: "Hold tight…",
  partner: "Partner",
  opponent: "Opponent",
  partnerTag: "(partner)",
  tileCount: (n) => `${n} tile${n !== 1 ? "s" : ""}`,
  tilesLabel: "tiles",
  boneyard: "Boneyard",
  emptyTable: "Table's empty",

  leftEnd: "← Left",
  rightEnd: "Right →",
  draw: (n) => `Draw (${n})`,
  pass: "Pass",

  points: "pts",
  bonus: "bonus",
  capicuaBonus: "Capicúa bonus",
  tranqueCompare: (blocker, blockerPips, rival, rivalPips) =>
    `Tranque: ${blocker} ${blockerPips} · ${rival} ${rivalPips}`,
  tranqueTie: (opener) => `Tie goes to ${opener}, who opened`,
  calloutDomino: "¡DOMINÓ!",
  calloutTrancao: "¡TRANCAO!",
  calloutCapicua: "¡CAPICÚA!",
  calloutVeinticinco: "¡VEINTICINCO!",
  calloutSalida: "¡PASE DE SALIDA!",
  tapToContinue: "Tap to keep it moving",

  wonRound: "You took that round!",
  lostRound: "They got that one",
  pips: "pips",
  nextRound: "Next Round →",
  nextRoundLoading: "Hold on…",

  won: "YOU GOT IT!",
  lost: "Not this time",
  wonFlavor: "Talk your talk!",
  lostFlavor: "Run it back, you got next",
  playAgain: "Run it back",
  creatingRematch: "Setting up…",
  joinRematch: "Join the rematch",
  rematchReady: "The rematch table is ready",

  loading: "Loading…",
  backToHome: "Back to home",
  networkError: "Connection error",
  gameNotFound: "Can't find that game - check the code",
  tableNotFound: "That table no longer exists",
  retry: "Retry",
  failedCreate: "Couldn't start the game",
  failedJoin: "Couldn't join",
  connectionError: "Connection dropped",

  enableSound: "Sound on",
  muteSound: "Mute",

  closeTray: "Close",
  quickChat: "Quick chat",

  opponentDrew: (n) => `They drew ${n} tile${n !== 1 ? "s" : ""}`,

  errorStartRound: "Couldn't start the round",

  score100: "100 pts",
  score200: "200 pts",

  reportBug: "Report a problem",
  reportBugTitle: "Report a problem",
  reportBugSent: "Thanks - got it.",
  reportBugPrompt:
    "This goes to the Capi team, not to your opponent. Tell us what happened; the game state is attached so we can fix it.",
  reportBugNotChat: "To talk to your opponent, use the 💬 chat on the table.",
  reportBugPlaceholder: "e.g. My tiles disappeared after I passed…",
  reportBugSend: "Send to Capi",
  reportBugSending: "Sending…",
  reportBugCancel: "Cancel",
  reportBugFailed: "Couldn't send. Try again.",

  footerPrivacy: "Privacy",
  footerSupport: "Support",
  howToPlay: "How to play",
  notFoundTitle: "This page does not exist",
  back: "Back",

  pipsInHand: "Pips left in hand",
  awardedTo: "to",

  you: "You",
  roundEnded: "Round over",
  connectionLive: "Live",
  connectionReconnecting: "Reconnecting…",
  connectionOffline: "Offline",
  waitingFor: (name) => `Waiting for ${name}…`,
  awayHint: "Looks like they disconnected",
  stalledFor: (name, time) => `${name} hasn't played in ${time}`,
  claimHint: "After 2 minutes without a move you can claim the win.",
  claimWarnMe: "Play soon: after 2 minutes without a move, the other side can claim the game.",
  passed: (name) => `${name} passed`,
  claimWin: "Claim the win",
  claimWinConfirm:
    "The game ends here and your side wins by forfeit. Sure?",
  wonByForfeit: (name) => `${name} never came back. You win the game.`,
  lostByForfeit: (name) => `${name} stopped playing and the game ended.`,
  youForfeited: "You stopped playing and the other side claimed the game.",
  endedByForfeit: (name) => `${name} stopped playing. The game ended.`,
  turnOf: (name) => `${name}'s turn`,
  refresh: "Refresh",
  leaveTable: "Leave the table",
  leaveConfirm:
    "Leave the table? The game keeps going and you can come back from home. After 2 minutes without a move, the other side can claim the win.",
  resumeGame: "Back to your game",
  resumeGameHint: (code) => `Table ${code}`,

  spectating: "Watching only",
  spectatingHint: "This table is full. You can watch the game.",
  joinTable: "Join the table",
  teamWins: (name) => `${name} wins`,
  cancel: "Cancel",
  failedRematch: "Could not set up the rematch",

  playOnEnd: (pip) => `Play on the ${pip}`,

  joinLookupLoading: "Finding the table…",
  joinLookupNotFound: "That table no longer exists",
  joinLookupFull: "That table is full",
  joinLookupStarted: "That game already started",
  joiningTableOf: (name) => `Joining ${name}'s table`,
  codeIs6: "The code is 6 characters",

  errNotYourTurn: "Not your turn",
  errMustPlay: "You have a tile you can play",
  errMustDraw: "Draw from the boneyard first",
  errClaimTooEarly: "Not yet. Wait until 2 minutes pass without a move.",
  errClaimOwnSide: "It is your side's turn, so there is nothing to claim.",
  errClaimTurnBased: "iMessage games can't be claimed: everyone plays at their own pace.",
  errRematchNotFinished: "The game is not over yet.",
  errNicknameRequired: "Enter your name.",
  errServer: "Something went wrong on the server. Try again.",
  errTileMismatch: "That tile does not fit there",
  errMoveFailed: "Could not play that",
  errStale: "The table changed, syncing…",
  errNotAtTable: "You are not at this table",
  errGameFull: "That table is full",
  errGameStarted: "That game already started",
  errNotInPlay: "The game is not in play",

  storeUnavailable: "The store is not responding right now",
  restoreFailed: "Could not reach the App Store",
  priceUnknown: "See price",
  purchasePending: "Your purchase is waiting for approval. It unlocks once it is approved.",
  adPrivacyOptions: "Ad privacy options",
  purchaseErrorProduct: "That item is not available yet",
  purchaseErrorStore: "The App Store did not respond",

  yourTurnGeneric: "Your turn",
  yourTurnFor: (name) => `Your turn, ${name}`,
  roundWon: (name) => `${name} took the round`,
  gameWon: (name) => `${name} won the game`,
  gameWonTeam: (name) => `${name} won the game`,
  invite1v1: "Dominoes time! 1v1",
  invite2v2: "2v2 dominoes! Tap to sit",
  inviteRematch: "Rematch! Tap to play",
  openInCapi: "Open in Capi",
  playInMessages: "This table lives in Messages. Play it there: a move made here does not notify the chat.",
};

export const dictionaries: Record<Lang, Strings> = { es, en };
