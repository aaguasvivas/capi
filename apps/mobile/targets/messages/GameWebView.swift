import UIKit
import WebKit

// Expanded-mode game surface: the playcapi.com game page in embed mode with
// the session handed over via URL fragment (none for a table this device only
// watches). Bridge messages arrive on the "capi" handler and are forwarded to
// the shell for bubble refreshes, tagged with the game the page is showing.
final class GameWebView: UIView, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private let webView: WKWebView
    // The game on screen. A rematch moves the page to a new table by itself;
    // follow(gameId:session:) keeps this and pageURL in step with it.
    private(set) var gameId: String
    private var pageURL: URL
    // Covers the table when the page cannot load; Retry reloads pageURL.
    private let offlineView = UIView()
    // Until the first page load finishes the webview has nothing to draw, so
    // the page's own loading colors and a spinner stand in for it.
    private let spinner = UIActivityIndicatorView(style: .medium)
    private static let pageColor = UIColor(red: 0xf5 / 255, green: 0xf0 / 255, blue: 0xe8 / 255, alpha: 1)
    var onBridgeEvent: ((_ event: [String: Any], _ gameId: String) -> Void)?
    // The open alert or confirm and its WebKit callback. WebKit raises if a
    // dialog callback is dropped without being called, so teardown answers it.
    private weak var dialog: UIAlertController?
    private var answerDialog: ((Bool) -> Void)?

    init(gameId: String, session: CapiSession?) {
        self.gameId = gameId
        pageURL = GameWebView.makePageURL(gameId: gameId, session: session)
        webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        super.init(frame: .zero)
        backgroundColor = Self.pageColor
        // The controller retains its handlers strongly, and a direct self
        // would cycle through webView.configuration and leak every webview.
        webView.configuration.userContentController.add(WeakScriptMessageHandler(self), name: "capi")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // Clear until the page paints, so the view's page color shows
        // instead of a white sheet.
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(webView)
        pin(webView)
        spinner.color = .gray
        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false
        addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        buildOfflineView()
        spinner.startAnimating()
        webView.load(URLRequest(url: pageURL))
    }

    required init?(coder: NSCoder) { fatalError() }

    deinit {
        // A collapsed drawer tears this view down under an open dialog.
        dialog?.dismiss(animated: false)
        finishDialog(false)
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "capi")
    }

    private static func makePageURL(gameId: String, session: CapiSession?) -> URL {
        var comps = URLComponents(url: CapiAPI.base.appendingPathComponent("/game/\(gameId)"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "embed", value: "imessage"),
            URLQueryItem(name: "lang", value: CapiStrings.es ? "es" : "en"),
        ]
        // No fragment, no seat: the page shows the table to watch.
        if let session { comps.fragment = "s=\(session.playerId).\(session.seat)" }
        return comps.url!
    }

    // The page already navigated to the new table; this only retargets the
    // bridge tag and what Retry reloads.
    func follow(gameId: String, session: CapiSession) {
        self.gameId = gameId
        pageURL = GameWebView.makePageURL(gameId: gameId, session: session)
    }

    // MARK: bridge

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any] { onBridgeEvent?(body, gameId) }
    }

    // MARK: JavaScript dialogs

    // Without these, WebKit answers alert() at once and confirm() with false,
    // so a page action that asks first (claiming the win) silently did nothing.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        presentDialog(message: message, cancellable: false) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        presentDialog(message: message, cancellable: true, answer: completionHandler)
    }

    private func presentDialog(message: String, cancellable: Bool, answer: @escaping (Bool) -> Void) {
        // One dialog at a time, and only when there is a controller free to
        // present it; otherwise answer as a cancel so the page never hangs.
        guard answerDialog == nil, let host = hostController(), host.presentedViewController == nil else {
            return answer(false)
        }
        answerDialog = answer
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        if cancellable {
            alert.addAction(UIAlertAction(title: CapiStrings.cancel, style: .cancel) { [weak self] _ in
                self?.finishDialog(false)
            })
        }
        alert.addAction(UIAlertAction(title: CapiStrings.ok, style: .default) { [weak self] _ in
            self?.finishDialog(true)
        })
        dialog = alert
        host.present(alert, animated: true)
    }

    private func finishDialog(_ confirmed: Bool) {
        guard let answer = answerDialog else { return }
        answerDialog = nil
        dialog = nil
        answer(confirmed)
    }

    private func hostController() -> UIViewController? {
        var responder: UIResponder? = self
        while let next = responder?.next {
            if let controller = next as? UIViewController { return controller }
            responder = next
        }
        return nil
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Only the Capi origin (and blank frames) load here, and the drawer's
        // own frame loads game pages only: any other page of the site would
        // put the website in Messages. In-page moves (the page's own router)
        // never reach this; the embed page keeps those on the table itself.
        let url = navigationAction.request.url
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        let allowed = url?.absoluteString == "about:blank"
            || (url?.host == CapiAPI.base.host && (!mainFrame || url?.path.hasPrefix("/game/") == true))
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        offlineView.isHidden = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        spinner.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOffline(after: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showOffline(after: error)
    }

    private func showOffline(after error: Error) {
        let e = error as NSError
        // A load superseded by a newer one (-999) or stopped by our own
        // policy above (WebKit 102) is not an outage.
        if e.code == NSURLErrorCancelled || (e.domain == "WebKitErrorDomain" && e.code == 102) { return }
        spinner.stopAnimating()
        offlineView.isHidden = false
    }

    private func reload() {
        offlineView.isHidden = true
        spinner.startAnimating()
        webView.load(URLRequest(url: pageURL))
    }

    // MARK: offline view

    private func buildOfflineView() {
        offlineView.backgroundColor = .systemBackground
        offlineView.isHidden = true
        let label = UILabel()
        label.text = CapiStrings.cannotLoad
        label.textAlignment = .center
        label.numberOfLines = 0
        label.textColor = .secondaryLabel
        var cfg = UIButton.Configuration.borderedProminent()
        cfg.title = CapiStrings.retry
        let retry = UIButton(configuration: cfg, primaryAction: UIAction { [weak self] _ in self?.reload() })
        let stack = UIStackView(arrangedSubviews: [label, retry])
        stack.axis = .vertical
        stack.spacing = 12
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        offlineView.addSubview(stack)
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(offlineView)
        pin(offlineView)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.trailingAnchor, constant: -24),
        ])
    }

    private func pin(_ sub: UIView) {
        NSLayoutConstraint.activate([
            sub.topAnchor.constraint(equalTo: topAnchor),
            sub.bottomAnchor.constraint(equalTo: bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: leadingAnchor),
            sub.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
