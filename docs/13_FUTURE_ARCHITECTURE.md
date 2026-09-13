# 13. Future Architecture Roadmap

## Potential Evolution Paths

### 1. Multiplayer Synchronization (WebSockets / WebRTC)
- **Current Foundation**: The `GameController` and `RulesEngine` are already decoupled from React state, making them server-authoritative ready.
- **Implementation Strategy**:
  - Replace local bot dispatches with a WebSocket action broker.
  - Server validates all moves against `RulesEngine` to prevent client tampering.
  - WebRTC mesh or WebSocket room matchmaking for private lobby play with friends.

### 2. Regional Rule Variants
- **Nepali vs. Indian vs. Western Lakdi rules**:
  - Option to toggle **Strict Must-Beat** (requiring higher trump even if player doesn't have lead suit) vs. **Relaxed Trumping**.
  - Custom match length configuration (1-round quick match, 3-round blitz, 5-round championship).
  - Optional Spade cut penalties (-0.5 points per failed ruff attempt).

### 3. Cloud Synchronization & Global Leaderboards
- Integration with Firebase Firestore or Supabase for cross-device match history sync, cloud backups, and global rankings.

### 4. Advanced Monte Carlo Tree Search (MCTS) AI
- For the "Hard / Grandmaster" AI tier: implement short-horizon MCTS trick simulation evaluating unplayed card probability distributions.
