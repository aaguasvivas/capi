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
    // Matches apps/web/src/components/CreateGameForm.tsx's AVATAR_COLORS.
    private static let avatarPalette = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"]
    // One random pick per install so two iMessage players do not show
    // identical avatars; the web offers a picker, the drawer stays one-tap.
    static var avatarColor: String {
        get {
            if let stored = defaults.string(forKey: "capi_avatar_color") { return stored }
            let picked = avatarPalette.randomElement()!
            defaults.set(picked, forKey: "capi_avatar_color")
            return picked
        }
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
