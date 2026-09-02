import Foundation

// Thin client of the same REST API the web and apps use. Bodies and shapes
// mirror apps/web/src/components/CreateGameForm.tsx and
// apps/web/src/app/api/games/[id]/join/route.ts exactly.
enum CapiAPI {
    #if DEBUG
    static let base = URL(string: "http://localhost:3000")!
    #else
    static let base = URL(string: "https://playcapi.com")!
    #endif

    struct CreateResponse: Decodable { let gameId: String; let inviteCode: String; let playerId: String; let seat: String }
    struct JoinResponse: Decodable { let playerId: String; let seat: String; let gameId: String; let waiting: Bool? }
    struct APIError: Decodable { let error: String }

    // The status code drives the player-facing text; the server message is
    // only consulted to tell the two 409 reasons apart and is never shown.
    enum Failure: Error { case server(status: Int, message: String); case network }

    static func create(nickname: String, avatarColor: String, is2v2: Bool, theme: String = "barberia", targetScore: Int = 100) async throws -> CreateResponse {
        try await post(path: "/api/games", body: [
            "nickname": nickname, "avatarColor": avatarColor,
            "theme": theme, "is2v2": is2v2, "targetScore": targetScore,
        ])
    }

    static func join(gameId: String, nickname: String, avatarColor: String) async throws -> JoinResponse {
        try await post(path: "/api/games/\(gameId)/join", body: ["nickname": nickname, "avatarColor": avatarColor])
    }

    private static func post<T: Decodable>(path: String, body: [String: Any]) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = "POST"
        // A card stuck on a spinner is worse than an honest retry prompt.
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { throw Failure.network }
        if http.statusCode >= 400 {
            let msg = (try? JSONDecoder().decode(APIError.self, from: data))?.error ?? ""
            throw Failure.server(status: http.statusCode, message: msg)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
