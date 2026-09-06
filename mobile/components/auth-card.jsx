import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Native port of frontend/components/auth/AuthCard.jsx:
// canvas backdrop + subtle brand glow, centered logo, floating card.
export default function AuthCard({ children, scrollable = false }) {
  const body = (
    <View className="w-full max-w-[440px] self-center">
      <View className="mb-8 flex-row items-center justify-center gap-2">
        <Image
          source={require("../assets/icon.png")}
          style={{ width: 40, height: 40, borderRadius: 10 }}
          accessibilityLabel="Kivo"
        />
        <Text className="text-[22px] font-semibold tracking-tight text-white">
          Kivo
        </Text>
      </View>

      <View className="rounded-2xl border border-border bg-surface p-6 shadow-black">
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="pointer-events-none absolute inset-0 items-center justify-center">
        <View className="h-[560px] w-[560px] rounded-full bg-accent opacity-[0.08]" />
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 16,
              paddingVertical: 48,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-4 py-12">
            {body}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
