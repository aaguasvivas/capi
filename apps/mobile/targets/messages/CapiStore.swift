import Foundation

// Shared identity + per-game sessions in the App Group so the extension and
// the main Capi app agree on who you are. Keys use the capi_ prefix to match
// the app's conventions.
struct CapiSession: Codable, Equatable {
    let playerId: String
    let seat: String
    let gameId: String
    // Restamped by every CapiStore.save; seats unseen for a year are pruned.
    var lastSeen = Date()
}

enum CapiStore {
    static let group = "group.dev.capi.app"
    static var defaults: UserDefaults { UserDefaults(suiteName: group)! }
    private static let sessionPrefix = "capi_session_"

    static var nickname: String {
        get { defaults.string(forKey: "capi_nickname") ?? "" }
        set { defaults.set(newValue, forKey: "capi_nickname") }
    }
    // The server's longest name, in UTF-16 units like its JavaScript cut.
    static let nicknameMax = 20
    // The name as the server stores it (apps/web/src/lib/validation.ts
    // cleanNickname): spaces collapsed, trimmed, cut to 20 UTF-16 units
    // without splitting a character in two.
    static func clean(_ raw: String) -> String {
        let collapsed = raw.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        var out = String.UnicodeScalarView()
        var units = 0
        for scalar in collapsed.unicodeScalars {
            units += scalar.utf16.count
            if units > nicknameMax { break }
            out.append(scalar)
        }
        return String(out)
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
        guard let data = defaults.data(forKey: sessionPrefix + gameId) else { return nil }
        return try? JSONDecoder().decode(CapiSession.self, from: data)
    }
    // Saving an already stored session again is how a table in use stays
    // fresh: lastSeen is always now at save time.
    static func save(_ session: CapiSession) {
        var stamped = session
        stamped.lastSeen = Date()
        defaults.set(try? JSONEncoder().encode(stamped), forKey: sessionPrefix + session.gameId)
    }
    // A turn-based table can wait weeks for a move, and a pruned seat can
    // never be taken back, so only a year of silence drops one; an entry
    // that no longer decodes can never be used either.
    static func pruneSessions(olderThan days: Double = 365) {
        let cutoff = Date().addingTimeInterval(-days * 86_400)
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(sessionPrefix) {
            let session = defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(CapiSession.self, from: $0) }
            if session.map({ $0.lastSeen < cutoff }) ?? true { defaults.removeObject(forKey: key) }
        }
    }
}
