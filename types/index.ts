export interface User {
  uid: string;
  username: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  participants: string[];  // user UIDs
  lastMessage?: Message;
  createdAt: string;
}