import UIKit
import WebKit

// Expanded-mode game surface: the playcapi.com game page in embed mode with
// the session handed over via URL fragment. Bridge messages arrive on the
// "capi" handler and are forwarded to the shell for bubble refreshes.
final class GameWebView: UIView, WKScriptMessageHandler, WKNavigationDelegate {
    private let webView: WKWebView
    private let pageURL: URL
    // Covers the table when the page cannot load; Retry reloads pageURL.
    private let offlineView = UIView()
    var onBridgeEvent: (([String: Any]) -> Void)?

    init(gameId: String, session: CapiSession) {
        var comps = URLComponents(url: CapiAPI.base.appendingPathComponent("/game/\(gameId)"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "embed", value: "imessage"),
            URLQueryItem(name: "lang", value: CapiStrings.es ? "es" : "en"),
        ]
        comps.fragment = "s=\(session.playerId).\(session.seat)"
        pageURL = comps.url!
        webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        super.init(frame: .zero)
        // The controller retains its handlers strongly, and a direct self
        // would cycle through webView.configuration and leak every webview.
        webView.configuration.userContentController.add(WeakScriptMessageHandler(self), name: "capi")
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(webView)
        pin(webView)
        buildOfflineView()
        webView.load(URLRequest(url: pageURL))
    }

    required init?(coder: NSCoder) { fatalError() }

    deinit {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "capi")
    }

    // MARK: bridge

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any] { onBridgeEvent?(body) }
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // The embed page blocks external navigation itself; this is the
        // shell's own line: only the Capi origin (and blank frames) load here.
        let url = navigationAction.request.url
        let allowed = url?.absoluteString == "about:blank" || url?.host == CapiAPI.base.host
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        offlineView.isHidden = true
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
        offlineView.isHidden = false
    }

    private func reload() {
        offlineView.isHidden = true
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
