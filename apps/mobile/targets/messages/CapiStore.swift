import Foundation

// Shared identity + per-game sessions in the App Group so the extension and
// the main Capi app agree on who you are. Keys use the capi_ prefix to match
// the app's conventions.
struct CapiSession: Codable, Equatable {
    let playerId: String
    let seat: String
    let gameId: String
}

enum CapiStore {
    static let group = "group.dev.capi.app"
    static var defaults: UserDefaults { UserDefaults(suiteName: group)! }

    static var nickname: String {
        get { defaults.string(forKey: "capi_nickname") ?? "" }
        set { defaults.set(newValue, forKey: "capi_nickname") }
    }
    static var avatarColor: String {
        get { defaults.string(forKey: "capi_avatar_color") ?? "#6366f1" }
        set { defaults.set(newValue, forKey: "capi_avatar_color") }
    }
    static func session(for gameId: String) -> CapiSession? {
        guard let data = defaults.data(forKey: "capi_session_\(gameId)") else { return nil }
        return try? JSONDecoder().decode(CapiSession.self, from: data)
    }
    static func save(_ session: CapiSession) {
        defaults.set(try? JSONEncoder().encode(session), forKey: "capi_session_\(session.gameId)")
    }
}
