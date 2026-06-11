import { View } from "react-native";
import Board from "../components/Board";

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: "#1a5c2e" }}>
      <Board
        board={[
          [6, 6],
          [6, 3],
          [3, 3],
          [3, 1],
          [1, 5],
          [5, 5],
          [5, 0],
          [0, 2],
          [2, 4],
          [4, 4],
          [4, 1],
        ]}
      />
    </View>
  );
}
