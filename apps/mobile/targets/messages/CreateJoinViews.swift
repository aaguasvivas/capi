import SwiftUI

// Shared by both cards so the controller can flip busy and status without
// re-hosting the view, which would drop what the player typed or picked.
final class CardState: ObservableObject {
    @Published var status: String?
    @Published var busy = false
    // Bumped after the drawer expanded for the name field: the expand drops
    // the field's focus, and this puts it back so the keyboard shows.
    @Published var focusRequest = 0
}

struct CreateCard: View {
    @ObservedObject var state: CardState
    let allow2v2: Bool
    // The compact drawer cannot show a keyboard: the field asks to expand.
    let onNeedsKeyboard: () -> Void
    let onCreate: (_ nickname: String, _ is2v2: Bool) -> Void
    @State private var nickname = CapiStore.nickname
    @State private var is2v2 = false
    @FocusState private var nameFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status = state.status { Text(status).foregroundColor(.secondary) }
            NameField(nickname: $nickname, focused: $nameFocused, focusRequest: state.focusRequest, onNeedsKeyboard: onNeedsKeyboard)
            if allow2v2 {
                Picker("", selection: $is2v2) {
                    Text("1v1").tag(false)
                    Text("2v2").tag(true)
                }.pickerStyle(.segmented).frame(maxWidth: 240)
            }
            SubmitButton(title: CapiStrings.create, busy: state.busy, enabled: !CapiStore.clean(nickname).isEmpty) {
                let name = CapiStore.clean(nickname)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onCreate(name, allow2v2 && is2v2)
            }
        }
        .padding()
        .avoidsOnlyOwnKeyboard(nameFocused)
    }
}

struct JoinCard: View {
    @ObservedObject var state: CardState
    let onNeedsKeyboard: () -> Void
    let onJoin: (_ nickname: String) -> Void
    @State private var nickname = CapiStore.nickname
    @FocusState private var nameFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status = state.status { Text(status).foregroundColor(.secondary) }
            NameField(nickname: $nickname, focused: $nameFocused, focusRequest: state.focusRequest, onNeedsKeyboard: onNeedsKeyboard)
            SubmitButton(title: CapiStrings.join, busy: state.busy, enabled: !CapiStore.clean(nickname).isEmpty) {
                let name = CapiStore.clean(nickname)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onJoin(name)
            }
        }
        .padding()
        .avoidsOnlyOwnKeyboard(nameFocused)
    }
}

// The name field of both cards. Focus asks the drawer to expand, since the
// compact drawer has no keyboard, and the field never holds more UTF-16
// units than the server keeps (CapiStore.clean counts the same way), cut at
// a whole character.
struct NameField: View {
    @Binding var nickname: String
    var focused: FocusState<Bool>.Binding
    let focusRequest: Int
    let onNeedsKeyboard: () -> Void

    var body: some View {
        TextField(CapiStrings.yourName, text: $nickname)
            .textFieldStyle(.roundedBorder)
            .frame(maxWidth: 240)
            .textContentType(.nickname)
            .submitLabel(.done)
            .focused(focused)
            .onChange(of: focused.wrappedValue) { if $0 { onNeedsKeyboard() } }
            .onChange(of: focusRequest) { _ in focused.wrappedValue = true }
            .onChange(of: nickname) { value in
                var units = 0
                var out = ""
                for ch in value {
                    units += ch.utf16.count
                    if units > CapiStore.nicknameMax { break }
                    out.append(ch)
                }
                if out != value { nickname = out }
            }
    }
}

extension View {
    // Centers a card in the whole drawer and moves it for a keyboard only
    // while the card's own field has focus. When the drawer opens over the
    // Messages keyboard, Messages hands that keyboard to the drawer as a
    // plain bottom inset, not a keyboard one, and it pushed the card up under
    // the grabber; so every bottom inset is ignored until the field is in use.
    func avoidsOnlyOwnKeyboard(_ typing: Bool) -> some View {
        frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.all, edges: typing ? [] : .bottom)
    }
}

// The collapsed drawer after the table: the staged bubble sits above it, and
// one tap brings the live table back.
struct TableCard: View {
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            Button(CapiStrings.backToTable, action: onBack)
                .buttonStyle(.borderedProminent)
        }
        .padding()
        .avoidsOnlyOwnKeyboard(false)
    }
}

// The card's one action: spins and ignores taps while a request is in flight,
// and stays dimmed until there is a name to send.
struct SubmitButton: View {
    let title: String
    let busy: Bool
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(.white) }
                Text(title)
            }
        }
        .buttonStyle(.borderedProminent)
        .disabled(busy || !enabled)
    }
}
