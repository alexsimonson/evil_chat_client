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
  channelId: number;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
};
