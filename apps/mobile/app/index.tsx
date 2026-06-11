import { Text, View } from "react-native";
import { createInitialState } from "@capi/engine";

export default function Index() {
  const s = createInitialState({ mode: "turn_based", theme: "barberia", is2v2: false });
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-lg font-bold">Engine OK — tiles: {s.board.length}</Text>
    </View>
  );
}
