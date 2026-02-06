
export enum UserRole {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY'
}

export interface User {
  fullName: string;
  phoneNumber: string;
  id: string; 
  email: string;
  password: string;
  role: UserRole;
}

export type ItemStatus = 'available' | 'handovered';

export interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface FoundItem {
  id: string;
  title: string;
  imageUrl: string; // High contrast B&W
  originalImageUrl: string;
  founderId: string;
  founderName: string;
  founderPhone: string;
  timestamp: number;
  status: ItemStatus;
  verificationQuestions: string[];
  verificationAnswers: string[];
  messages: ChatMessage[];
}

export interface AttemptLog {
  count: number;
  lastAttemptTime: number;
}
