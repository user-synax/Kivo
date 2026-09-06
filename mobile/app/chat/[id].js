import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useSocket } from "../../lib/socket";

export default function ChatDetail() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const { socket } = useSocket();
  const listRef = useRef(null);
  const me = getUser();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiGet(
        `/api/v1/conversations/${id}/messages?limit=50`,
      );
      const list = Array.isArray(data) ? data : data?.messages || [];
      setMessages([...list].reverse());
    } catch (e) {
      setError(e?.message || "Failed to load messages");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !id) return;
    const onNew = (msg) => {
      const cid = msg?.conversationId?.toString?.() || msg?.conversationId;
      if (cid && cid !== id) return;
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("message:new", onNew);
    socket.emit("conversation:focus", { conversationId: id });
    return () => {
      socket.off("message:new", onNew);
      socket.emit("conversation:blur", { conversationId: id });
    };
  }, [socket, id]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      const msg = await apiPost(`/api/v1/conversations/${id}/messages`, {
        content,
      });
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      setError(e?.message || "Send failed");
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  const myId = me?.id || me?._id;

  return (
    <SafeAreaView
      className="flex-1 bg-base"
      edges={["bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {error ? (
          <Text className="px-4 pt-2 text-sm text-red-400">{error}</Text>
        ) : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => (m?._id || m?.id || `${i}`).toString()}
          contentContainerStyle={{ padding: 12 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item }) => {
            const mine =
              (item?.senderId?.toString?.() ||
                item?.senderId ||
                item?.sender?._id) === myId?.toString?.();
            return (
              <View
                className={`mb-2 max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "self-end bg-white" : "self-start bg-elevated"}`}
              >
                <Text
                  className={`text-base ${mine ? "text-black" : "text-white"}`}
                >
                  {item?.content || ""}
                </Text>
              </View>
            );
          }}
        />
        <View className="flex-row items-center gap-2 border-t border-border bg-surface px-3 py-2">
          <TextInput
            className="flex-1 rounded-full border border-border bg-base px-4 py-2.5 text-white"
            placeholder="Message"
            placeholderTextColor="#999"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable
            onPress={send}
            className="items-center rounded-full bg-accent px-4 py-2.5 active:opacity-80"
          >
            <Text className="font-semibold text-black">Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
