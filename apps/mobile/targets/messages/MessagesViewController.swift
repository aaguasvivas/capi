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
    // Which chat the state above belongs to: the local participant plus the
    // remote ones, so a second chat never resumes another chat's game.
    private var conversationKey: String?
    private let cardState = CardState()
    // The last bubble sent, so a repeated bridge event does not post twice.
    private var lastBubble: (gameId: String, type: String, my: Int, opp: Int, at: Date)?

    // What the drawer shows. Every route below returns early when its screen
    // is already up, so an expand or a collapse never rebuilds it: a card
    // keeps what the player typed and picked, and a table keeps its page.
    private enum Screen: Hashable { case create, join(String), game(String), watch(String) }
    private var screen: Screen?
    // The create and join cards whose request is still waiting on the
    // server. It outlives a teardown: a card mounted again for the same
    // request (the drawer closed and reopened) keeps spinning and ignores
    // taps, so a second Join cannot take a second seat, and the answer goes
    // to whichever card for that request is on screen when it lands. The
    // seat is saved either way.
    private var inFlight: Set<Screen> = []
    // Bumped by every teardown. The join card's table check answers the card
    // that asked only while that card is still on screen.
    private var generation = 0
    // The one-button card laid over a table after a collapse. The table stays
    // loaded under it, so an in-flight move still posts its bubble and the
    // table comes back as it was, with no reload.
    private var tableCard: UIViewController?
    // The drawer is expanding because the name field took focus.
    private var expandingForKeyboard = false

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
            // A collapse from a table, ours after a move or the user's, lays
            // one button over it so the staged bubble is what shows; nothing
            // re-expands on its own. A create or join card stays: iOS 26
            // reports the drawer's first appearance as a transition to
            // compact, and clearing the card there left the drawer blank.
            switch screen {
            case .game, .watch: showTableCard()
            default: break
            }
            return
        }
        hideTableCard()
        if let convo = activeConversation { render(for: convo, tapped: nil) }
        // The expand took the focus from the name field; give it back once
        // the drawer has settled, so the keyboard comes up without a second
        // tap. (Focusing in the same pass as the request can crash.)
        if expandingForKeyboard {
            expandingForKeyboard = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                self?.cardState.focusRequest += 1
            }
        }
    }

    // A tapped bubble names the game to show and wins over the one in view;
    // a transition-driven render (tapped nil) keeps whatever is current.
    private func render(for conversation: MSConversation, tapped: MSMessage?) {
        if let message = tapped, let game = GameRef(from: message) {
            currentRef = game
            currentSession = message.session
        }
        guard let game = currentRef else { return showCreate(conversation: conversation) }
        if CapiStore.session(for: game.gameId) == nil, let finished = game.finishedId,
           let seated = CapiStore.session(for: finished) {
            // A rematch invite, and this device has a seat only at the
            // finished table: open that one, whose card seats this player
            // back in their own seat at the rematch.
            currentRef = GameRef(gameId: finished, code: "")
            if tapped != nil, presentationStyle == .compact { requestPresentationStyle(.expanded) }
            return showGame(gameId: finished, session: seated)
        }
        guard let session = CapiStore.session(for: game.gameId) else {
            // No seat here: a table already found full stays up to watch.
            if screen == .watch(game.gameId) { return }
            return showJoin(game: game)
        }
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
        guard screen != .create else { return }
        let allow2v2 = conversation.remoteParticipantIdentifiers.count >= 2
        mountCard(.create, CreateCard(state: cardState, allow2v2: allow2v2, onNeedsKeyboard: expandForKeyboard) { [weak self] nickname, is2v2 in
            self?.attemptCreate(nickname: nickname, is2v2: is2v2)
        })
    }

    private func attemptCreate(nickname: String, is2v2: Bool) {
        guard !cardState.busy, !inFlight.contains(.create) else { return }
        cardState.busy = true
        cardState.status = nil
        inFlight.insert(.create)
        let asked = conversationKey
        Task { @MainActor in
            do {
                let r = try await CapiAPI.create(nickname: nickname, avatarColor: CapiStore.avatarColor, is2v2: is2v2)
                CapiStore.save(CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId))
                self.inFlight.remove(.create)
                // The seat is saved either way, but the invite belongs to a
                // create card still on screen in the chat that asked for it.
                guard self.screen == .create else { return }
                self.cardState.busy = false
                guard self.conversationKey == asked else { return }
                self.insertInviteBubble(gameId: r.gameId, code: r.inviteCode, is2v2: is2v2)
                // insert only stages the bubble in the compose field, so
                // dismiss the drawer and let the user hit send, GamePigeon
                // style: the staged bubble and its send arrow are all that
                // is left on screen. They tap the sent bubble to sit at the
                // table (their session is saved, so render routes straight
                // to the game).
                self.dismiss()
            } catch {
                self.inFlight.remove(.create)
                guard self.screen == .create else { return }
                self.cardState.busy = false
                guard self.conversationKey == asked else { return }
                self.cardState.status = Self.statusText(for: error)
            }
        }
    }

    private func showJoin(game: GameRef) {
        guard screen != .join(game.gameId) else { return }
        mountCard(.join(game.gameId), JoinCard(state: cardState, onNeedsKeyboard: expandForKeyboard) { [weak self] nickname in
            self?.attemptJoin(game: game, nickname: nickname)
        })
        // A table that already started, or has no free seat, is shown to
        // watch instead of a join form that can only fail.
        let shown = generation
        Task { @MainActor in
            guard let table = try? await CapiAPI.game(id: game.gameId), !table.canJoin,
                  self.generation == shown, !self.cardState.busy else { return }
            self.showWatch(gameId: game.gameId)
        }
    }

    private func attemptJoin(game: GameRef, nickname: String) {
        let card = Screen.join(game.gameId)
        guard !cardState.busy, !inFlight.contains(card) else { return }
        cardState.busy = true
        cardState.status = nil
        inFlight.insert(card)
        Task { @MainActor in
            do {
                let r = try await CapiAPI.join(gameId: game.gameId, nickname: nickname, avatarColor: CapiStore.avatarColor)
                let session = CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId)
                CapiStore.save(session)
                self.inFlight.remove(card)
                // The seat is kept even if the player moved on to another
                // bubble or chat meanwhile; only the view must not follow.
                // A join card for this table mounted again after the drawer
                // closed and reopened is the one that follows.
                guard self.screen == card else { return }
                self.cardState.busy = false
                self.requestPresentationStyle(.expanded)
                self.showGame(gameId: game.gameId, session: session)
                // This join filled the table and dealt the first hand.
                if r.waiting != true { self.announceTurn(gameId: game.gameId, session: session) }
            } catch {
                self.inFlight.remove(card)
                guard self.screen == card else { return }
                self.cardState.busy = false
                // No seat left (full, started, or finished): watch it.
                if case CapiAPI.Failure.server(409, _) = error { return self.showWatch(gameId: game.gameId) }
                self.cardState.status = Self.statusText(for: error)
            }
        }
    }

    // Players only ever see CapiStrings, never a server string.
    private static func statusText(for error: Error) -> String {
        guard case CapiAPI.Failure.server(404, _) = error else { return CapiStrings.connectionError }
        return CapiStrings.tableNotFound
    }

    // The compact drawer has no keyboard; a focused name field needs the
    // expanded one. The card stays mounted through the expand (what was
    // typed stays), and didTransition hands the field its focus back.
    private func expandForKeyboard() {
        guard presentationStyle == .compact else { return }
        expandingForKeyboard = true
        requestPresentationStyle(.expanded)
    }

    private func showGame(gameId: String, session: CapiSession) {
        guard screen != .game(gameId) else { return }
        // Restamps lastSeen, so a table in use is never pruned.
        CapiStore.save(session)
        mountTable(gameId: gameId, session: session)
        screen = .game(gameId)
    }

    // A table this device has no seat at: the page without a session shows
    // it to watch.
    private func showWatch(gameId: String) {
        guard screen != .watch(gameId) else { return }
        mountTable(gameId: gameId, session: nil)
        screen = .watch(gameId)
        // A full table found from its join card can mount in the compact
        // drawer, where no collapse lays the card over it. After mountTable:
        // clearChildren drops any card.
        if presentationStyle == .compact { showTableCard() }
    }

    private func mountTable(gameId: String, session: CapiSession?) {
        clearChildren()
        let web = GameWebView(gameId: gameId, session: session)
        // Wired for a watched table too: a page that still holds this
        // player's seat in its own storage plays as them, and its bubbles
        // must reach the chat.
        web.onBridgeEvent = { [weak self, weak web] event, shownId in
            guard let self, let web else { return }
            self.handleBridge(event, gameId: shownId, web: web)
        }
        // The buttons get their own bar above the page: laid over it, they
        // covered the page's turn line under the score bar.
        let bar = gameButtons(seated: session != nil)
        view.addSubview(bar)
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 2),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            web.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 4),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
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
        send(caption: caption, sub: code, ref: GameRef(gameId: gameId, code: code), session: session, via: .stage)
    }

    private func handleBridge(_ event: [String: Any], gameId: String, web: GameWebView) {
        // The page is remote content: every field is type-checked, and the
        // scores and names are clamped before anything reaches a bubble.
        guard let game = currentRef, game.gameId == gameId,
              let type = event["type"] as? String else { return }
        if type == "rematch" { return followRematch(event, web: web) }
        // Newer pages name their table; older ones rely on the webview's tag.
        if let named = event["gameId"] as? String, named != game.gameId { return }
        guard let myRaw = event["myScore"] as? Int, let oppRaw = event["oppScore"] as? Int else { return }
        let my = min(max(myRaw, 0), 999)
        let opp = min(max(oppRaw, 0), 999)
        let caption: String
        switch type {
        case "moved":
            caption = Self.name(event["turnName"]).map(CapiStrings.yourTurnFor) ?? CapiStrings.yourTurnGeneric
        case "roundOver", "gameOver":
            // Only the client whose move ended the round sends the result,
            // whichever side won, and names the round's winner. An older
            // page sent it from every client, so there only the winner's
            // own client (iWon) may speak, under the local name. A 2v2 game
            // result names the winning side ("Ana & Rosa"), so the caption
            // takes the plural.
            let named = Self.name(event["winnerName"])
            let winner = named ?? (event["iWon"] as? Bool == true ? Self.name(CapiStore.nickname) : nil)
            guard let winner else { return }
            if type == "roundOver" {
                caption = CapiStrings.roundWon(winner)
            } else if named != nil, event["winnerIsTeam"] as? Bool == true {
                caption = CapiStrings.gameWonTeam(winner)
            } else {
                caption = CapiStrings.gameWon(winner)
            }
        default:
            return
        }
        let sub = Self.scoreLine(my: my, opp: opp, myName: Self.name(event["myName"]), oppName: Self.name(event["oppName"]))
        deliver(type: type, caption: caption, sub: sub, my: my, opp: opp)
    }

    // A turn bubble for a table this client just started (a join or a
    // rematch arrival that filled it), when the first turn is someone else's.
    // The page never sees these moments, so the drawer reads the table itself.
    private func announceTurn(gameId: String, session: CapiSession) {
        Task { @MainActor in
            guard let table = try? await CapiAPI.game(id: gameId),
                  let state = table.game.gameState, state.phase == "playing",
                  state.currentTurn != session.seat, state.scores.count == 2,
                  self.screen == .game(gameId), self.currentRef?.gameId == gameId else { return }
            let mine = table.team(of: session.seat)
            let my = min(max(state.scores[mine], 0), 999)
            let opp = min(max(state.scores[1 - mine], 0), 999)
            let caption = Self.name(table.nickname(state.currentTurn)).map(CapiStrings.yourTurnFor) ?? CapiStrings.yourTurnGeneric
            let sub = Self.scoreLine(my: my, opp: opp, myName: Self.name(table.teamName(mine)), oppName: Self.name(table.teamName(1 - mine)))
            self.deliver(type: "moved", caption: caption, sub: sub, my: my, opp: opp)
        }
    }

    // Sends one milestone bubble on the table's session, then collapses so
    // the staged bubble and its send arrow are what shows.
    private func deliver(type: String, caption: String, sub: String, my: Int, opp: Int) {
        guard let game = currentRef else { return }
        // The same milestone must not post twice when the page re-renders
        // it; a later turn with unchanged scores is a new bubble, so only a
        // repeat within two seconds counts as the same event.
        let now = Date()
        if let last = lastBubble, last.gameId == game.gameId, last.type == type, last.my == my, last.opp == opp,
           now.timeIntervalSince(last.at) < 2 { return }
        lastBubble = (game.gameId, type, my, opp, now)
        let session = currentSession ?? MSSession()
        currentSession = session
        send(caption: caption, sub: sub, ref: game, session: session, via: .send)
        // iOS stages extension sends for user confirmation; collapsing
        // makes the staged bubble visible so the turn notification is one
        // tap away, and the live table stays one tap away under the card.
        // Deferring makes Messages honor the request after the current
        // transaction, since a synchronous call here lands mid-transaction
        // (during the webview's touch handling) and gets silently ignored.
        DispatchQueue.main.async { [weak self] in self?.requestPresentationStyle(.compact) }
    }

    // "Play again" seated this player at a new table and the page moved there
    // on its own. Save that seat and make the new table the current game, so
    // later bubbles link to it instead of the finished one. While the new
    // table waits for the others, a bubble tells them. It names both tables:
    // a player already seated at the rematch opens it, and one seated only
    // at the finished table opens that, whose card seats them back in the
    // same place (see render). The arrival that fills the table announces
    // the first turn instead.
    private func followRematch(_ event: [String: Any], web: GameWebView) {
        guard let gameId = event["gameId"] as? String, GameRef.isValidId(gameId),
              let code = event["code"] as? String, code.count <= 12,
              code.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }),
              let playerId = event["playerId"] as? String, GameRef.isValidId(playerId),
              let seat = event["seat"] as? String, ["n", "e", "s", "w"].contains(seat) else { return }
        let finished = currentRef
        let session = CapiSession(playerId: playerId, seat: seat, gameId: gameId)
        CapiStore.save(session)
        currentRef = GameRef(gameId: gameId, code: code)
        screen = .game(gameId)
        lastBubble = nil
        web.follow(gameId: gameId, session: session)
        switch event["waiting"] as? Bool {
        case true?:
            guard let finished else { return }
            let bubble = currentSession ?? MSSession()
            currentSession = bubble
            send(caption: CapiStrings.inviteRematch, sub: nil,
                 ref: GameRef(gameId: gameId, code: code, finishedId: finished.gameId), session: bubble, via: .send)
            DispatchQueue.main.async { [weak self] in self?.requestPresentationStyle(.compact) }
        case false?:
            announceTurn(gameId: gameId, session: session)
        case nil:
            break
        }
    }

    // A name from the page or the table: trimmed, one line, and short enough
    // for a bubble ("Ana & Luis" at most two 20-character names).
    private static func name(_ raw: Any?) -> String? {
        guard let text = raw as? String else { return nil }
        let clean = text.split(whereSeparator: \.isNewline).joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return clean.isEmpty ? nil : String(clean.prefix(43))
    }

    // "Ana 20 · Luis 35" from the sender's side; bare scores without names.
    private static func scoreLine(my: Int, opp: Int, myName: String?, oppName: String?) -> String {
        guard let myName, let oppName else { return "\(my) - \(opp)" }
        return "\(myName) \(my) · \(oppName) \(opp)"
    }

    // Invites are staged with insert (the user reviews and taps send);
    // milestone updates use send so both clients don't need a manual tap to
    // keep the thread's bubble in sync with the live game.
    private enum BubbleDelivery { case stage, send }

    private func send(caption: String, sub: String?, ref: GameRef, session: MSSession, via: BubbleDelivery) {
        guard let convo = activeConversation else { return }
        let layout = MSMessageTemplateLayout()
        layout.image = UIImage(named: "bubble-card")
        layout.caption = caption
        layout.subcaption = sub
        let message = MSMessage(session: session)
        message.layout = layout
        message.url = ref.url
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

    // Hosts a create or join card as the drawer's screen, fresh: no status,
    // and busy only while this card's request is still in flight.
    private func mountCard<V: View>(_ card: Screen, _ v: V) {
        clearChildren()
        cardState.status = nil
        cardState.busy = inFlight.contains(card)
        let hc = UIHostingController(rootView: v)
        addChild(hc)
        hc.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hc.view)
        pin(hc.view)
        hc.didMove(toParent: self)
        screen = card
    }

    private func showTableCard() {
        guard tableCard == nil else { return }
        view.subviews.forEach { $0.isHidden = true }
        let hc = UIHostingController(rootView: TableCard { [weak self] in self?.requestPresentationStyle(.expanded) })
        addChild(hc)
        hc.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hc.view)
        pin(hc.view)
        hc.didMove(toParent: self)
        tableCard = hc
    }

    private func hideTableCard() {
        guard let hc = tableCard else { return }
        hc.willMove(toParent: nil)
        hc.view.removeFromSuperview()
        hc.removeFromParent()
        tableCard = nil
        view.subviews.forEach { $0.isHidden = false }
    }

    private func gameButtons(seated: Bool) -> UIStackView {
        var fresh = UIButton.Configuration.plain()
        fresh.title = CapiStrings.newGame
        fresh.buttonSize = .small
        let newButton = UIButton(configuration: fresh, primaryAction: UIAction { [weak self] _ in
            self?.startNewGame()
        })
        let row = UIStackView(arrangedSubviews: [newButton])
        if seated {
            var open = UIButton.Configuration.gray()
            open.title = CapiStrings.openInCapi
            // Reads the game at tap time: a rematch changes it under the buttons.
            let openButton = UIButton(configuration: open, primaryAction: UIAction { [weak self] _ in
                guard let self, case .game(let gameId) = self.screen,
                      let session = CapiStore.session(for: gameId),
                      let url = Self.appLink(gameId: gameId, session: session) else { return }
                self.extensionContext?.open(url, completionHandler: nil)
            })
            row.addArrangedSubview(openButton)
        } else {
            // One button: keep it at the leading edge.
            row.addArrangedSubview(UIView())
        }
        row.distribution = .equalSpacing
        row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        return row
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
        screen = nil
        tableCard = nil
        generation += 1
    }
}

// The bubble payload: gameId + code encoded in the message URL. The URL also
// doubles as the web fallback for taps on macOS or devices without Capi: the
// landing page only consumes the join param and fetches the invite code
// itself, so the code query item here is not for the landing. It exists for
// the extension's own round-trip, so GameRef(from:) below can recover the
// code for the bubble subcaption without an extra API call. A rematch invite
// adds from=<finished gameId>, which the landing page ignores.
struct GameRef {
    let gameId: String
    let code: String
    // On a rematch invite: the finished table it follows.
    let finishedId: String?

    // Game ids are server UUIDs; anything else in a bubble is malformed.
    static func isValidId(_ id: String) -> Bool { UUID(uuidString: id) != nil }

    var url: URL {
        var c = URLComponents(string: "https://playcapi.com/")!
        c.queryItems = [
            URLQueryItem(name: "join", value: gameId),
            URLQueryItem(name: "code", value: code),
        ]
        if let finishedId { c.queryItems?.append(URLQueryItem(name: "from", value: finishedId)) }
        return c.url!
    }

    init(gameId: String, code: String, finishedId: String? = nil) {
        self.gameId = gameId
        self.code = code
        self.finishedId = finishedId
    }

    init?(from message: MSMessage) {
        guard let url = message.url,
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.host == "playcapi.com",
              let gameId = comps.queryItems?.first(where: { $0.name == "join" })?.value,
              GameRef.isValidId(gameId) else { return nil }
        self.gameId = gameId
        self.code = comps.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
        self.finishedId = comps.queryItems?.first(where: { $0.name == "from" })?.value.flatMap { GameRef.isValidId($0) ? $0 : nil }
    }
}
