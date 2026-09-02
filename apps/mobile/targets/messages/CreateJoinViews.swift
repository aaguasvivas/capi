import SwiftUI

// Shared by both cards so the controller can flip busy and status without
// re-hosting the view, which would drop what the player typed or picked.
final class CardState: ObservableObject {
    @Published var status: String?
    @Published var busy = false
}

struct CreateCard: View {
    @ObservedObject var state: CardState
    let allow2v2: Bool
    let onCreate: (_ nickname: String, _ is2v2: Bool) -> Void
    @State private var nickname = CapiStore.nickname
    @State private var is2v2 = false

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status = state.status { Text(status).foregroundColor(.secondary) }
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            if allow2v2 {
                Picker("", selection: $is2v2) {
                    Text("1v1").tag(false)
                    Text("2v2").tag(true)
                }.pickerStyle(.segmented).frame(maxWidth: 240)
            }
            SubmitButton(title: CapiStrings.create, busy: state.busy) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onCreate(name, allow2v2 && is2v2)
            }
        }.padding()
    }
}

struct JoinCard: View {
    @ObservedObject var state: CardState
    let onJoin: (_ nickname: String) -> Void
    @State private var nickname = CapiStore.nickname

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status = state.status { Text(status).foregroundColor(.secondary) }
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            SubmitButton(title: CapiStrings.join, busy: state.busy) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onJoin(name)
            }
        }.padding()
    }
}

// The card's one action: spins and ignores taps while a request is in flight.
struct SubmitButton: View {
    let title: String
    let busy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(.white) }
                Text(title)
            }
        }
        .buttonStyle(.borderedProminent)
        .disabled(busy)
    }
}
