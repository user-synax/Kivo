import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet } from "../../lib/api";

export default function Spaces() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/api/v1/spaces");
      setItems(Array.isArray(data) ? data : data?.spaces || []);
    } catch (e) {
      setError(e?.message || "Failed to load spaces");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-white">Spaces</Text>
        {error ? (
          <Text className="mt-1 text-sm text-red-400">{error}</Text>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(s) => s?._id || s?.id}
        ListEmptyComponent={
          <View className="items-center px-6 pt-16">
            <Text className="text-center text-base text-muted">
              No spaces yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="border-b border-border px-4 py-3">
            <Text className="text-base font-semibold text-white">
              {item?.name || "Space"}
            </Text>
            <Text className="mt-0.5 text-sm text-muted" numberOfLines={2}>
              {item?.description || `#${item?.slug || "general"}`}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
