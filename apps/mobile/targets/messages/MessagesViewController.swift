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
    // The gameId currently mounted in the view, so showGame is idempotent
    // and render's early-return (below) doesn't rebuild the same webview.
    private var currentGameId: String?

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
        // After a create, conversation.selectedMessage is nil, so re-deriving
        // on the expand transition would bounce back to the create card: if
        // we already have a live session for the game in view, keep showing
        // it instead of re-deriving from the conversation. A tapped bubble
        // for a different game must win over the current one, and
        // compact-only expansion avoids fighting the user's collapse.
        let tappedId = conversation.selectedMessage.flatMap { GameRef(from: $0) }?.gameId
        if let ref = currentRef, tappedId == nil || tappedId == ref.gameId,
           let session = CapiStore.session(for: ref.gameId) {
            if presentationStyle == .compact { requestPresentationStyle(.expanded) }
            showGame(gameId: ref.gameId, session: session)
            return
        }
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
                    let session = CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId)
                    CapiStore.save(session)
                    self.insertInviteBubble(gameId: r.gameId, code: r.inviteCode, is2v2: is2v2)
                    // insert only stages the bubble in the compose field, so
                    // collapse the extension and let the user hit send,
                    // GamePigeon style; they tap the sent bubble to sit at
                    // the table (their session is saved, so render routes
                    // straight to the game).
                    self.dismiss()
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
        if currentGameId == gameId { return }
        clearChildren()
        let web = GameWebView(gameId: gameId, session: session)
        web.onBridgeEvent = { [weak self] event in self?.handleBridge(event, gameId: gameId) }
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        pin(web)
        addOpenInCapiButton(gameId: gameId)
        currentGameId = gameId
    }

    private func showJoinError(_ error: Error) {
        host(JoinCard(status: "\(error)") { _ in })
    }

    // MARK: bubbles

    private func insertInviteBubble(gameId: String, code: String, is2v2: Bool) {
        let caption = is2v2 ? CapiStrings.invite2v2 : CapiStrings.invite1v1
        currentRef = GameRef(gameId: gameId, code: code)
        currentSession = MSSession()
        send(caption: caption, sub: code, gameId: gameId, code: code, session: currentSession!, via: .stage)
    }

    private func handleBridge(_ event: [String: Any], gameId: String) {
        guard let type = event["type"] as? String,
              let game = currentRef, game.gameId == gameId else { return }
        let my = event["myScore"] as? Int ?? 0
        let opp = event["oppScore"] as? Int ?? 0
        let name = CapiStore.nickname
        let caption: String
        switch type {
        case "moved":
            caption = CapiStrings.yourTurn(oppNamePlaceholder())
        case "roundOver", "gameOver":
            // Only the winner's client sends the terminal bubble, so both
            // players' clients don't each post one; the local nickname
            // above is therefore always the winner's own name here.
            let iWon = event["iWon"] as? Bool ?? false
            guard iWon else { return }
            caption = type == "roundOver" ? CapiStrings.roundWon(name) : CapiStrings.gameWon(name)
        default: return
        }
        let session = currentSession ?? MSSession()
        currentSession = session
        send(caption: caption, sub: "\(my) - \(opp)", gameId: game.gameId, code: game.code, session: session, via: .send)
    }

    private func oppNamePlaceholder() -> String {
        // Participant display names are not exposed to extensions; the caption
        // reads naturally without one in ES and EN.
        return CapiStrings.es ? "te toca" : "you"
    }

    // Invites are staged with insert (the user reviews and taps send);
    // milestone updates use send so both clients don't need a manual tap to
    // keep the thread's bubble in sync with the live game.
    private enum BubbleDelivery { case stage, send }

    private func send(caption: String, sub: String, gameId: String, code: String, session: MSSession, via: BubbleDelivery) {
        guard let convo = activeConversation else { return }
        let layout = MSMessageTemplateLayout()
        layout.image = UIImage(named: "bubble-card")
        layout.caption = caption
        layout.subcaption = sub
        let message = MSMessage(session: session)
        message.layout = layout
        message.url = GameRef(gameId: gameId, code: code).url
        message.summaryText = caption
        switch via {
        case .stage:
            convo.insert(message)
        case .send:
            convo.send(message) { error in
                if let error { NSLog("capi bubble send failed: \(error)") }
            }
        }
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
        currentGameId = nil
    }
}

// The bubble payload: gameId + code encoded in the message URL. The URL also
// doubles as the web fallback for taps on macOS or devices without Capi: it
// matches the web landing's own invite-link format
// (https://playcapi.com/?join=<gameId>&code=<code>) so the tap lands right
// on the join flow there.
struct GameRef {
    let gameId: String
    let code: String

    var url: URL {
        var c = URLComponents(string: "https://playcapi.com/")!
        c.queryItems = [
            URLQueryItem(name: "join", value: gameId),
            URLQueryItem(name: "code", value: code),
        ]
        return c.url!
    }

    init(gameId: String, code: String) { self.gameId = gameId; self.code = code }

    init?(from message: MSMessage) {
        guard let url = message.url,
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.host == "playcapi.com",
              let gameId = comps.queryItems?.first(where: { $0.name == "join" })?.value else { return nil }
        self.gameId = gameId
        self.code = comps.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
    }
}
