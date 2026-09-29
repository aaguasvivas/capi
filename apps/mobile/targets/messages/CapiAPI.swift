import Foundation

// Thin client of the same REST API the web and apps use. Bodies and shapes
// mirror apps/web/src/components/CreateGameForm.tsx and
// apps/web/src/app/api/games/[id]/join/route.ts, except that create asks for
// a turn-based table.
enum CapiAPI {
    #if DEBUG
    static let base = URL(string: "http://localhost:3000")!
    #else
    static let base = URL(string: "https://playcapi.com")!
    #endif

    struct CreateResponse: Decodable { let gameId: String; let inviteCode: String; let playerId: String; let seat: String }
    // waiting is true while seats are still free; the join that fills the
    // table deals the first hand and leaves it out.
    struct JoinResponse: Decodable { let playerId: String; let seat: String; let gameId: String; let waiting: Bool? }
    struct APIError: Decodable { let error: String }

    // The part of GET /api/games/<id> the drawer reads: whether a seat is
    // free, and who is on turn with what score.
    struct Snapshot: Decodable {
        struct Game: Decodable {
            struct Settings: Decodable { let is2v2: Bool? }
            let status: String
            let settings: Settings?
            let gameState: State?
        }
        struct State: Decodable {
            let phase: String
            let currentTurn: String
            let scores: [Int]
            let is2v2: Bool
        }
        struct Player: Decodable { let seat: String; let nickname: String? }
        let game: Game
        let players: [Player]

        var is2v2: Bool { game.gameState?.is2v2 ?? game.settings?.is2v2 ?? false }
        var canJoin: Bool { game.status == "waiting" && players.count < (is2v2 ? 4 : 2) }

        func nickname(_ seat: String) -> String? { players.first { $0.seat == seat }?.nickname }

        // Team 0 is N (and S in 2v2), as in packages/engine getTeam.
        func team(of seat: String) -> Int { is2v2 ? (seat == "n" || seat == "s" ? 0 : 1) : (seat == "n" ? 0 : 1) }

        // The side's names as the table shows them: "Ana", or "Ana & Luis".
        func teamName(_ team: Int) -> String {
            let seats = is2v2 ? (team == 0 ? ["n", "s"] : ["e", "w"]) : [team == 0 ? "n" : "s"]
            return seats.compactMap(nickname).joined(separator: " & ")
        }
    }

    // The status code drives the player-facing text; the server message is
    // only consulted to tell the two 409 reasons apart and is never shown.
    enum Failure: Error { case server(status: Int, message: String); case network }

    // Games in a Messages thread are played over hours, so they are created
    // turn-based: the server never lets a silent seat be claimed in them.
    static func create(nickname: String, avatarColor: String, is2v2: Bool, theme: String = "barberia", targetScore: Int = 100) async throws -> CreateResponse {
        try await request(path: "/api/games", body: [
            "nickname": nickname, "avatarColor": avatarColor, "mode": "turn_based",
            "theme": theme, "is2v2": is2v2, "targetScore": targetScore,
        ])
    }

    static func join(gameId: String, nickname: String, avatarColor: String) async throws -> JoinResponse {
        try await request(path: "/api/games/\(gameId)/join", body: ["nickname": nickname, "avatarColor": avatarColor])
    }

    static func game(id: String) async throws -> Snapshot {
        try await request(path: "/api/games/\(id)", body: nil)
    }

    // POST with a JSON body, or GET without one.
    private static func request<T: Decodable>(path: String, body: [String: Any]?) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        // A card stuck on a spinner is worse than an honest retry prompt.
        req.timeoutInterval = 15
        if let body {
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        } else {
            req.cachePolicy = .reloadIgnoringLocalCacheData
        }
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { throw Failure.network }
        if http.statusCode >= 400 {
            let msg = (try? JSONDecoder().decode(APIError.self, from: data))?.error ?? ""
            throw Failure.server(status: http.statusCode, message: msg)
        }
        let decoder = JSONDecoder()
        // game_state and friends on the table row; camelCase bodies pass through.
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
}
