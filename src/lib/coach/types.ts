export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** For assistant messages: claims the guard removed or flagged. */
  flagged?: string[];
}

export interface CoachConversation {
  id: string;
  /** What the conversation is about. */
  context: { kind: 'exercise'; exerciseId: string } | { kind: 'position'; fen: string } | { kind: 'game'; gameId: string; ply?: number };
  createdAt: string;
  messages: CoachMessage[];
}
