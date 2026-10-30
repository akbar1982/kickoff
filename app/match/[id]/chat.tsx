import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatRoom } from "../../../components/ChatRoom";

export default function MatchChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatRoom matchId={id} />;
}
