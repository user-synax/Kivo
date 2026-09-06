import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet } from "../../lib/api";
import { useSocket } from "../../lib/socket";

function titleOf(c, me) {
  if (c?.name) return c.name;
  const other = (c?.participants || []).find(
    (p) => p?._id !== me && p?.id !== me,
  );
  return other?.displayName || other?.username || "Direct message";
}

export default function Chats() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { socket, reconnectNonce } = useSocket();

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiGet("/api/v1/conversations?type=dm");
      setItems(Array.isArray(data) ? data : data?.conversations || []);
    } catch (e) {
      setError(e?.message || "Failed to load chats");
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload list on socket reconnect
  useEffect(() => {
    load();
  }, [load, reconnectNonce]);

  useEffect(() => {
    if (!socket) return;
    const onNew = () => load();
    socket.on("message:new", onNew);
    socket.on("conversation:updated", onNew);
    return () => {
      socket.off("message:new", onNew);
      socket.off("conversation:updated", onNew);
    };
  }, [socket, load]);

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-white">Chats</Text>
        {error ? (
          <Text className="mt-1 text-sm text-red-400">{error}</Text>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(c) => c?._id || c?.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View className="items-center px-6 pt-16">
            <Text className="text-center text-base text-muted">
              No chats yet. Add a friend on web to start one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/chat/${item?._id || item?.id}`} asChild>
            <Pressable className="border-b border-border px-4 py-3 active:bg-elevated">
              <Text className="text-base font-semibold text-white">
                {titleOf(item)}
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
