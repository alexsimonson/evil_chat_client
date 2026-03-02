export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
};

export type Server = {
  id: number;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type Member = {
  id: string;
  username: string;
  displayName: string | null;
  online: boolean;
};

export type ChannelType = "text" | "voice";

export type Channel = {
  id: number;
  serverId: number;
  name: string;
  type: ChannelType;
  sortOrder: number | null;
  livekitRoomName?: string | null;
  createdAt?: string;
};

export type Message = {
  id: number;
  channelId: number | null;
  conversationId?: number | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export type DirectMessageConversation = {
  id: number;
  createdAt: string;
  updatedAt: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};
