import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../components/auth-provider";
import { apiPost } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { useSocket } from "../../lib/socket";

export default function Menu() {
  const { user, signOut } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();

  async function onLogout() {
    try {
      await apiPost("/api/v1/auth/logout", {});
    } catch {}
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold text-white">Menu</Text>
        <Text className="mt-1 text-sm text-muted">
          {user?.displayName || user?.username || "Signed in"} ·{" "}
          {isConnected ? "Online" : "Offline"}
        </Text>
        <Text className="mt-1 text-xs text-muted">{API_URL}</Text>

        <Pressable
          onPress={onLogout}
          className="mt-6 items-center rounded-xl border border-border bg-surface py-3 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
