import { View } from "react-native";
import TileDisplay from "../components/TileDisplay";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
      }}
    >
      <TileDisplay tile={[6, 6]} />
      <TileDisplay tile={[3, 5]} />
      <TileDisplay tile={[0, 1]} selected />
      <TileDisplay tile={[4, 2]} highlight />
      <TileDisplay tile={[0, 0]} faceDown />
      <TileDisplay tile={[5, 6]} small />
    </View>
  );
}
