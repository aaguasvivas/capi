import Foundation

// The only strings duplicated from packages/i18n/src/strings.ts (bubbles must
// render without the webview). Keys mirrored: yourTurnGeneric, roundWon,
// gameWon, invite1v1, invite2v2, join, create, tableFull, gameStarted,
// openInCapi, yourName.
enum CapiStrings {
    static var es: Bool { Locale.preferredLanguages.first?.hasPrefix("es") ?? false }

    static var yourTurnGeneric: String { es ? "Te toca" : "Your turn" }
    static func roundWon(_ name: String) -> String { es ? "\(name) ganó la ronda" : "\(name) took the round" }
    static func gameWon(_ name: String) -> String { es ? "\(name) ganó el juego" : "\(name) won the game" }
    static var invite1v1: String { es ? "¡A jugar dominó! 1v1" : "Dominoes time! 1v1" }
    static var invite2v2: String { es ? "¡Dominó 2v2! Toca para sentarte" : "2v2 dominoes! Tap to sit" }
    static var join: String { es ? "Unirse a la mesa" : "Join the table" }
    static var create: String { es ? "Crear partida" : "Start a game" }
    static var tableFull: String { es ? "La mesa está llena" : "The table is full" }
    static var gameStarted: String { es ? "La partida ya empezó" : "Game already started" }
    static var openInCapi: String { es ? "Abrir en Capi" : "Open in Capi" }
    static var yourName: String { es ? "Tu nombre" : "Your name" }
    static var connectionError: String { es ? "Error de conexión, intenta de nuevo" : "Connection error, try again" }
}
