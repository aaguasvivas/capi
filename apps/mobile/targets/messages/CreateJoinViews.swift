import SwiftUI

struct CreateCard: View {
    @State var nickname: String = CapiStore.nickname
    let allow2v2: Bool
    let onCreate: (_ nickname: String, _ is2v2: Bool) -> Void
    @State private var is2v2 = false

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
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
