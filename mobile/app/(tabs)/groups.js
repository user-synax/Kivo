import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet } from "../../lib/api";

export default function Groups() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/api/v1/conversations?type=group");
      setItems(Array.isArray(data) ? data : data?.conversations || []);
    } catch (e) {
      setError(e?.message || "Failed to load groups");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-white">Groups</Text>
        {error ? (
          <Text className="mt-1 text-sm text-red-400">{error}</Text>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(c) => c?._id || c?.id}
        ListEmptyComponent={
          <View className="items-center px-6 pt-16">
            <Text className="text-center text-base text-muted">
              No groups yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/chat/${item?._id || item?.id}`} asChild>
            <Pressable className="border-b border-border px-4 py-3 active:bg-elevated">
              <Text className="text-base font-semibold text-white">
                {item?.name || "Group"}
              </Text>
              <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>
                {item?.lastMessage?.content || "No messages yet"}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}
