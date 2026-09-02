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
    // and an expand transition does not rebuild the same webview.
    private var currentGameId: String?
    // Which chat the state above belongs to: the local participant plus the
    // remote ones, so a second chat never resumes another chat's game.
    private var conversationKey: String?
    // One create or join at a time; the hosted card spins while this is set.
    private var isRequesting = false { didSet { cardState.busy = isRequesting } }
    private let cardState = CardState()
    // The last bubble sent, so a repeated bridge event does not post twice.
    private var lastBubble: (gameId: String, type: String, my: Int, opp: Int, at: Date)?

    // MARK: presentation routing

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        CapiStore.pruneSessions()
        let key = ([conversation.localParticipantIdentifier] + conversation.remoteParticipantIdentifiers)
            .map(\.uuidString).joined(separator: ",")
        // A different chat, or the drawer opened fresh with no bubble tapped,
        // starts from nothing.
        if key != conversationKey || conversation.selectedMessage == nil { resetGameState() }
        conversationKey = key
        render(for: conversation, tapped: conversation.selectedMessage)
    }

    override func didSelect(_ message: MSMessage, conversation: MSConversation) {
        super.didSelect(message, conversation: conversation)
        render(for: conversation, tapped: message)
    }

    override func didResignActive(with conversation: MSConversation) {
        super.didResignActive(with: conversation)
        // Tear the webview down now so its socket does not outlive the
        // drawer; currentRef stays so the same chat resumes on bubble tap.
        clearChildren()
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        if presentationStyle == .compact {
            // Every collapse, ours after a move or the user's, empties the
            // drawer so the staged bubble is what shows; nothing re-expands
            // until a bubble tap or the user's own expand.
            clearChildren()
            return
        }
        if let convo = activeConversation { render(for: convo, tapped: nil) }
    }

    // A tapped bubble names the game to show and wins over the one in view;
    // a transition-driven render (tapped nil) keeps whatever is current.
    private func render(for conversation: MSConversation, tapped: MSMessage?) {
        if let message = tapped, let game = GameRef(from: message) {
            currentRef = game
            currentSession = message.session
        }
        guard let game = currentRef else { return showCreate(conversation: conversation) }
        guard let session = CapiStore.session(for: game.gameId) else { return showJoin(game: game) }
        // Only the bubble-tap path auto-expands, so a manual collapse sticks.
        if tapped != nil, presentationStyle == .compact { requestPresentationStyle(.expanded) }
        showGame(gameId: game.gameId, session: session)
    }

    private func resetGameState() {
        clearChildren()
        currentRef = nil
        currentSession = nil
        lastBubble = nil
    }

    // MARK: flows

    private func showCreate(conversation: MSConversation) {
        cardState.status = nil
        let allow2v2 = conversation.remoteParticipantIdentifiers.count >= 2
        host(CreateCard(state: cardState, allow2v2: allow2v2) { [weak self] nickname, is2v2 in
            self?.attemptCreate(nickname: nickname, is2v2: is2v2)
        })
    }

    private func attemptCreate(nickname: String, is2v2: Bool) {
        guard !isRequesting else { return }
        isRequesting = true
        let startedIn = conversationKey
        Task { @MainActor in
            defer { self.isRequesting = false }
            do {
                let r = try await CapiAPI.create(nickname: nickname, avatarColor: CapiStore.avatarColor, is2v2: is2v2)
                CapiStore.save(CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId))
                // The seat is saved either way, but the invite belongs to the
                // chat it was created from, and not over a bubble tapped since.
                guard self.conversationKey == startedIn, self.currentRef == nil else { return }
                self.insertInviteBubble(gameId: r.gameId, code: r.inviteCode, is2v2: is2v2)
                // insert only stages the bubble in the compose field, so
                // dismiss the drawer and let the user hit send, GamePigeon
                // style: the staged bubble and its send arrow are all that
                // is left on screen. They tap the sent bubble to sit at the
                // table (their session is saved, so render routes straight
                // to the game).
                self.dismiss()
            } catch {
                guard self.conversationKey == startedIn else { return }
                self.cardState.status = Self.statusText(for: error)
            }
        }
    }

    private func showJoin(game: GameRef) {
        cardState.status = nil
        host(JoinCard(state: cardState) { [weak self] nickname in
            self?.attemptJoin(game: game, nickname: nickname)
        })
    }

    private func attemptJoin(game: GameRef, nickname: String) {
        guard !isRequesting else { return }
        isRequesting = true
        Task { @MainActor in
            defer { self.isRequesting = false }
            do {
                let r = try await CapiAPI.join(gameId: game.gameId, nickname: nickname, avatarColor: CapiStore.avatarColor)
                let session = CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId)
                CapiStore.save(session)
                // The seat is kept even if the player moved on to another
                // bubble or chat meanwhile; only the view must not follow.
                guard self.currentRef?.gameId == game.gameId else { return }
                self.requestPresentationStyle(.expanded)
                self.showGame(gameId: game.gameId, session: session)
            } catch {
                guard self.currentRef?.gameId == game.gameId else { return }
                self.cardState.status = Self.statusText(for: error)
            }
        }
    }

    // Players only ever see CapiStrings, never a server string.
    private static func statusText(for error: Error) -> String {
        guard case CapiAPI.Failure.server(let status, let message) = error else { return CapiStrings.connectionError }
        switch (status, message) {
        case (404, _): return CapiStrings.tableNotFound
        case (409, "Game is full"): return CapiStrings.tableFull
        case (409, "Game already started"): return CapiStrings.gameStarted
        default: return CapiStrings.connectionError
        }
    }

    private func showGame(gameId: String, session: CapiSession) {
        if currentGameId == gameId { return }
        clearChildren()
        // Restamps lastSeen, so a table in use is never pruned.
        CapiStore.save(session)
        let web = GameWebView(gameId: gameId, session: session)
        web.onBridgeEvent = { [weak self] event in self?.handleBridge(event, gameId: gameId) }
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        pin(web)
        addGameButtons(gameId: gameId, session: session)
        currentGameId = gameId
    }

    private func startNewGame() {
        guard let convo = activeConversation else { return }
        resetGameState()
        showCreate(conversation: convo)
    }

    // MARK: bubbles

    private func insertInviteBubble(gameId: String, code: String, is2v2: Bool) {
        let caption = is2v2 ? CapiStrings.invite2v2 : CapiStrings.invite1v1
        let session = MSSession()
        currentRef = GameRef(gameId: gameId, code: code)
        currentSession = session
        send(caption: caption, sub: code, gameId: gameId, code: code, session: session, via: .stage)
    }

    private func handleBridge(_ event: [String: Any], gameId: String) {
        // The page is remote content: every field is type-checked and the
        // scores are clamped before anything reaches a bubble.
        guard let game = currentRef, game.gameId == gameId,
              let type = event["type"] as? String,
              let myRaw = event["myScore"] as? Int, let oppRaw = event["oppScore"] as? Int else { return }
        let my = min(max(myRaw, 0), 999)
        let opp = min(max(oppRaw, 0), 999)
        let caption: String
        switch type {
        case "moved":
            caption = CapiStrings.yourTurnGeneric
        case "roundOver", "gameOver":
            // Only the winner's client sends the terminal bubble, so both
            // players' clients don't each post one; the local nickname is
            // therefore always the winner's own name here.
            guard event["iWon"] as? Bool == true else { return }
            let name = CapiStore.nickname
            caption = type == "roundOver" ? CapiStrings.roundWon(name) : CapiStrings.gameWon(name)
        default:
            return
        }
        // The same milestone must not post twice when the page re-renders
        // it; a later turn with unchanged scores is a new bubble, so only a
        // repeat within two seconds counts as the same event.
        let now = Date()
        if let last = lastBubble, last.gameId == gameId, last.type == type, last.my == my, last.opp == opp,
           now.timeIntervalSince(last.at) < 2 { return }
        lastBubble = (gameId, type, my, opp, now)
        let session = currentSession ?? MSSession()
        currentSession = session
        send(caption: caption, sub: "\(my) - \(opp)", gameId: game.gameId, code: game.code, session: session, via: .send)
        // iOS stages extension sends for user confirmation; collapsing
        // makes the staged bubble visible so the turn notification is one
        // tap away, and the live table stays one bubble-tap away. Deferring
        // makes Messages honor the request after the current transaction,
        // since a synchronous call here lands mid-transaction (during the
        // webview's touch handling) and gets silently ignored.
        DispatchQueue.main.async { [weak self] in self?.requestPresentationStyle(.compact) }
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

    private func addGameButtons(gameId: String, session: CapiSession) {
        var open = UIButton.Configuration.gray()
        open.title = CapiStrings.openInCapi
        let openButton = UIButton(configuration: open, primaryAction: UIAction { [weak self] _ in
            guard let url = Self.appLink(gameId: gameId, session: session) else { return }
            self?.extensionContext?.open(url, completionHandler: nil)
        })
        var fresh = UIButton.Configuration.plain()
        fresh.title = CapiStrings.newGame
        fresh.buttonSize = .small
        let newButton = UIButton(configuration: fresh, primaryAction: UIAction { [weak self] _ in
            self?.startNewGame()
        })
        let row = UIStackView(arrangedSubviews: [newButton, openButton])
        row.spacing = 4
        row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(row)
        NSLayoutConstraint.activate([
            // 64: sits below the embedded page's score bar.
            row.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 64),
            row.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
        ])
    }

    // capi://game/<gameId>?p=<playerId>&seat=<seat>: the app seats this
    // player straight away instead of showing its own join form.
    private static func appLink(gameId: String, session: CapiSession) -> URL? {
        guard GameRef.isValidId(gameId) else { return nil }
        var c = URLComponents()
        c.scheme = "capi"
        c.host = "game"
        c.path = "/" + gameId
        c.queryItems = [
            URLQueryItem(name: "p", value: session.playerId),
            URLQueryItem(name: "seat", value: session.seat),
        ]
        return c.url
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
// doubles as the web fallback for taps on macOS or devices without Capi: the
// landing page only consumes the join param and fetches the invite code
// itself, so the code query item here is not for the landing. It exists for
// the extension's own round-trip, so GameRef(from:) below can recover the
// code for the bubble subcaption without an extra API call.
struct GameRef {
    let gameId: String
    let code: String

    // Game ids are server UUIDs; anything else in a bubble is malformed.
    static func isValidId(_ id: String) -> Bool { UUID(uuidString: id) != nil }

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
              let gameId = comps.queryItems?.first(where: { $0.name == "join" })?.value,
              GameRef.isValidId(gameId) else { return nil }
        self.gameId = gameId
        self.code = comps.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
    }
}
