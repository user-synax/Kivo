import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../components/auth-provider";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/(tabs)" : "/(auth)/login");
  }, [user, loading, router]);

  return (
    <View className="flex-1 items-center justify-center bg-base">
      <ActivityIndicator size="large" color="#4ba9e1" />
    </View>
  );
}
