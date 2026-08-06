import SwiftUI

struct CreateCard: View {
    @State var nickname: String = CapiStore.nickname
    let allow2v2: Bool
    let status: String?
    let onCreate: (_ nickname: String, _ is2v2: Bool) -> Void
    @State private var is2v2 = false

    // Explicit init (not the synthesized memberwise one) so status keeps a
    // real, overridable default: a stored property default alone would be
    // baked in and un-overridable from call sites.
    init(allow2v2: Bool, status: String? = nil, onCreate: @escaping (_ nickname: String, _ is2v2: Bool) -> Void) {
        self.allow2v2 = allow2v2
        self.status = status
        self.onCreate = onCreate
    }

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status { Text(status).foregroundColor(.secondary) }
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            if allow2v2 {
                Picker("", selection: $is2v2) {
                    Text("1v1").tag(false)
                    Text("2v2").tag(true)
                }.pickerStyle(.segmented).frame(maxWidth: 240)
            }
            Button(CapiStrings.create) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onCreate(name, allow2v2 && is2v2)
            }.buttonStyle(.borderedProminent)
        }.padding()
    }
}

struct JoinCard: View {
    @State var nickname: String = CapiStore.nickname
    let status: String?
    let onJoin: (_ nickname: String) -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status { Text(status).foregroundColor(.secondary) }
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            Button(CapiStrings.join) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onJoin(name)
            }.buttonStyle(.borderedProminent)
        }.padding()
    }
}
