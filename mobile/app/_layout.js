import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../components/auth-provider";
import { SocketProvider } from "../lib/socket";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="oauth/callback" />
            <Stack.Screen
              name="chat/[id]"
              options={{ headerShown: true, title: "Chat" }}
            />
          </Stack>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
