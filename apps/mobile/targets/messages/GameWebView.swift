import UIKit
import WebKit

// Expanded-mode game surface: the playcapi.com game page in embed mode with
// the session handed over via URL fragment. Bridge messages arrive on the
// "capi" handler and are forwarded to the shell for bubble refreshes.
final class GameWebView: UIView, WKScriptMessageHandler {
    private var webView: WKWebView!
    var onBridgeEvent: (([String: Any]) -> Void)?

    init(gameId: String, session: CapiSession) {
        super.init(frame: .zero)
        let config = WKWebViewConfiguration()
        // The controller retains its handlers strongly, and a direct self
        // would cycle through webView.configuration and leak every webview.
        config.userContentController.add(WeakScriptMessageHandler(self), name: "capi")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
        var comps = URLComponents(url: CapiAPI.base.appendingPathComponent("/game/\(gameId)"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "embed", value: "imessage"),
            URLQueryItem(name: "lang", value: CapiStrings.es ? "es" : "en"),
        ]
        comps.fragment = "s=\(session.playerId).\(session.seat)"
        webView.load(URLRequest(url: comps.url!))
    }

    required init?(coder: NSCoder) { fatalError() }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any] { onBridgeEvent?(body) }
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
