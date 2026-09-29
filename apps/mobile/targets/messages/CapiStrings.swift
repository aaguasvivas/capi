import Foundation

// The only strings duplicated from packages/i18n/src/strings.ts (bubbles must
// render without the webview). Mirrored one to one: yourTurnGeneric,
// yourTurnFor, roundWon, gameWon, gameWonTeam, invite1v1, invite2v2, inviteRematch,
// tableNotFound, openInCapi, yourName,
// connectionError, retry, cancel; under another name: join (joinGame), create
// (createGame). apps/web/src/lib/__tests__/swiftParity.test.ts reads this file
// and fails when a mirrored literal drifts. newGame, backToTable, cannotLoad
// and ok exist only here.
enum CapiStrings {
    static var es: Bool { Locale.preferredLanguages.first?.hasPrefix("es") ?? false }

    static var yourTurnGeneric: String { es ? "Te toca" : "Your turn" }
    static func yourTurnFor(_ name: String) -> String { es ? "Te toca, \(name)" : "Your turn, \(name)" }
    static func roundWon(_ name: String) -> String { es ? "\(name) ganó la ronda" : "\(name) took the round" }
    static func gameWon(_ name: String) -> String { es ? "\(name) ganó el juego" : "\(name) won the game" }
    static func gameWonTeam(_ name: String) -> String { es ? "\(name) ganaron el juego" : "\(name) won the game" }
    static var invite1v1: String { es ? "¡A jugar dominó! 1v1" : "Dominoes time! 1v1" }
    static var invite2v2: String { es ? "¡Dominó 2v2! Toca para sentarte" : "2v2 dominoes! Tap to sit" }
    static var inviteRematch: String { es ? "¡Revancha! Toca para jugar" : "Rematch! Tap to play" }
    static var join: String { es ? "Unirse" : "Join up" }
    static var create: String { es ? "Crear partida" : "Start a game" }
    static var tableNotFound: String { es ? "Esa mesa ya no existe" : "That table no longer exists" }
    static var openInCapi: String { es ? "Abrir en Capi" : "Open in Capi" }
    static var newGame: String { es ? "Nueva partida" : "New game" }
    static var backToTable: String { es ? "Volver a la mesa" : "Back to the table" }
    static var yourName: String { es ? "Tu nombre" : "Your name" }
    static var connectionError: String { es ? "Error de conexión" : "Connection dropped" }
    static var cannotLoad: String { es ? "No se pudo cargar la mesa" : "Could not load the table" }
    static var retry: String { es ? "Reintentar" : "Retry" }
    // Buttons of the page's JavaScript alert and confirm dialogs.
    static var cancel: String { es ? "Cancelar" : "Cancel" }
    static var ok: String { es ? "Aceptar" : "OK" }
}
