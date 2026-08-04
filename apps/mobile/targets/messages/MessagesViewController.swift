import UIKit
import SwiftUI
import Messages

// Bubbles, identity, seating. The game itself is the web client (GameWebView).
final class MessagesViewController: MSMessagesAppViewController {

    // The game this drawer instance is showing, and its bubble session. Set on
    // create, join, and bubble tap. handleBridge MUST use these (not
    // conversation.selectedMessage, which is nil right after a create).
    private var currentRef: GameRef?
    private var currentSession: MSSession?

    // MARK: presentation routing

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        render(for: conversation)
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        if let convo = activeConversation { render(for: convo) }
    }

    private func render(for conversation: MSConversation) {
        clearChildren()
        if let message = conversation.selectedMessage, let game = GameRef(from: message) {
            // Tapped an existing Capi bubble.
            currentRef = game
            currentSession = message.session
            if let session = CapiStore.session(for: game.gameId) {
                requestPresentationStyle(.expanded)
                showGame(gameId: game.gameId, session: session)
            } else {
                showJoin(game: game)
            }
        } else {
            showCreate(conversation: conversation)
        }
    }

    // MARK: flows

    private func showCreate(conversation: MSConversation) {
        let allow2v2 = conversation.remoteParticipantIdentifiers.count >= 2
        host(CreateCard(allow2v2: allow2v2) { [weak self] nickname, is2v2 in
            Task { @MainActor in
                guard let self else { return }
                do {
                    let r = try await CapiAPI.create(nickname: nickname, avatarColor: CapiStore.avatarColor, is2v2: is2v2)
                    CapiStore.save(CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId))
                    self.insertInviteBubble(gameId: r.gameId, code: r.inviteCode, is2v2: is2v2)
                    self.requestPresentationStyle(.expanded)
                    self.showGame(gameId: r.gameId, session: CapiStore.session(for: r.gameId)!)
                } catch { self.showJoinError(error) }
            }
        })
    }

    private func showJoin(game: GameRef) {
        host(JoinCard(status: nil) { [weak self] nickname in
            Task { @MainActor in
                guard let self else { return }
                do {
                    let r = try await CapiAPI.join(gameId: game.gameId, nickname: nickname, avatarColor: CapiStore.avatarColor)
                    let session = CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId)
                    CapiStore.save(session)
                    self.currentRef = game
                    self.requestPresentationStyle(.expanded)
                    self.showGame(gameId: game.gameId, session: session)
                } catch CapiAPI.Failure.server(let msg) {
                    self.host(JoinCard(status: msg.contains("full") ? CapiStrings.tableFull : msg) { _ in })
                } catch { self.showJoinError(error) }
            }
        })
    }

    private func showGame(gameId: String, session: CapiSession) {
        let web = GameWebView(gameId: gameId, session: session)
        web.onBridgeEvent = { [weak self] event in self?.handleBridge(event, gameId: gameId) }
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        pin(web)
        addOpenInCapiButton(gameId: gameId)
    }

    private func showJoinError(_ error: Error) {
        host(JoinCard(status: "\(error)") { _ in })
    }

    // MARK: bubbles

    private func insertInviteBubble(gameId: String, code: String, is2v2: Bool) {
        let caption = is2v2 ? CapiStrings.invite2v2 : CapiStrings.invite1v1
        currentRef = GameRef(gameId: gameId, code: code)
        currentSession = MSSession()
        send(caption: caption, sub: code, gameId: gameId, code: code, session: currentSession!)
    }

    private func handleBridge(_ event: [String: Any], gameId: String) {
        guard let type = event["type"] as? String,
              let game = currentRef, game.gameId == gameId else { return }
        let my = event["myScore"] as? Int ?? 0
        let opp = event["oppScore"] as? Int ?? 0
        let name = CapiStore.nickname
        let caption: String
        switch type {
        case "moved": caption = CapiStrings.yourTurn(oppNamePlaceholder())
        case "roundOver": caption = CapiStrings.roundWon(name)
        case "gameOver": caption = CapiStrings.gameWon(name)
        default: return
        }
        let session = currentSession ?? MSSession()
        currentSession = session
        send(caption: caption, sub: "\(my) - \(opp)", gameId: game.gameId, code: game.code, session: session)
    }

    private func oppNamePlaceholder() -> String {
        // Participant display names are not exposed to extensions; the caption
        // reads naturally without one in ES and EN.
        return CapiStrings.es ? "te toca" : "you"
    }

    private func send(caption: String, sub: String, gameId: String, code: String, session: MSSession) {
        guard let convo = activeConversation else { return }
        let layout = MSMessageTemplateLayout()
        layout.image = UIImage(named: "bubble-card")
        layout.caption = caption
        layout.subcaption = sub
        let message = MSMessage(session: session)
        message.layout = layout
        message.url = GameRef(gameId: gameId, code: code).url
        message.summaryText = caption
        convo.insert(message)
    }

    // MARK: plumbing

    private func host<V: View>(_ v: V) {
        clearChildren()
        let hc = UIHostingController(rootView: v)
        addChild(hc)
        hc.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hc.view)
        pin(hc.view)
        hc.didMove(toParent: self)
    }

    private func addOpenInCapiButton(gameId: String) {
        var cfg = UIButton.Configuration.gray()
        cfg.title = CapiStrings.openInCapi
        let btn = UIButton(configuration: cfg, primaryAction: UIAction { [weak self] _ in
            self?.extensionContext?.open(URL(string: "capi://game/\(gameId)")!, completionHandler: nil)
        })
        btn.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(btn)
        NSLayoutConstraint.activate([
            btn.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 6),
            btn.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
        ])
    }

    private func pin(_ sub: UIView) {
        NSLayoutConstraint.activate([
            sub.topAnchor.constraint(equalTo: view.topAnchor),
            sub.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sub.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func clearChildren() {
        children.forEach { $0.willMove(toParent: nil); $0.view.removeFromSuperview(); $0.removeFromParent() }
        view.subviews.forEach { $0.removeFromSuperview() }
    }
}

// The bubble payload: gameId + code encoded in the message URL. The URL is
// also the web fallback for taps on macOS or devices without Capi.
struct GameRef {
    let gameId: String
    let code: String

    var url: URL {
        var c = URLComponents(string: "https://playcapi.com/game/\(gameId)")!
        c.queryItems = [URLQueryItem(name: "code", value: code)]
        return c.url!
    }

    init(gameId: String, code: String) { self.gameId = gameId; self.code = code }

    init?(from message: MSMessage) {
        guard let url = message.url,
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.host == "playcapi.com" else { return nil }
        let parts = comps.path.split(separator: "/").map(String.init)
        guard parts.count == 2, parts[0] == "game" else { return nil }
        self.gameId = parts[1]
        self.code = comps.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
    }
}
