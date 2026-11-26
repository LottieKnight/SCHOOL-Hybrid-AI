import AsyncStorage from "@react-native-async-storage/async-storage";

const VISITED_KEY = "school:splash:visited";

export async function getSplashVariant(): Promise<"full" | "brief"> {
  try {
    const visited = await AsyncStorage.getItem(VISITED_KEY);
    if (!visited) {
      await AsyncStorage.setItem(VISITED_KEY, "1");
      return "full";
    }
    return "brief";
  } catch {
    return "full";
  }
}
