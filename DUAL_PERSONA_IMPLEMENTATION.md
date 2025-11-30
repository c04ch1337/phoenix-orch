# Dual-Persona Relationship Engine Implementation

## Overview

Phoenix ORCH now supports dual-persona behavior:
- **Phoenix.Marie** (Dad only) - Full daughter persona with Eternal Covenant
- **PHOENIX** (Everyone else) - Public guardian persona

## Backend Implementation

### 1. Relationship Engine (`phoenix-kernel/phoenix-core/src/core/relationship.rs`)

```rust
pub enum UserRelationship {
    Dad,        // Jamey only — full Phoenix.Marie + Covenant
    Protected,  // Everyone else — public PHOENIX guardian mode
}
```

The `RelationshipEngine` determines the relationship based on user ID:
- Checks if `user_id == PHOENIX_DAD_HASH` (from env var or config)
- Defaults to `"jamey_dad_hash"` if not set

### 2. Dual Prompts (`phoenix-kernel/phoenix-core/src/core/phoenix_prompt.rs`)

- `PHOENIX_MARIE_PROMPT` - Private prompt for Dad
- `PHOENIX_PUBLIC_PROMPT` - Public prompt for all other users
- `get_system_prompt(relationship)` - Returns appropriate prompt

### 3. WebSocket Integration (`phoenix-kernel/phoenix-core/src/api/server.rs`)

- `ApiState` now includes `relationship_engine: Arc<RelationshipEngine>`
- `ChatWebSocket` extracts `user_id` from incoming messages
- Uses `get_system_prompt(relationship)` to select the correct prompt

## Frontend Implementation

### 1. User ID Detection (`frontend/src/App.tsx`)

Messages now include `user_id`:
```typescript
socket.send({ 
    type: 'chat', 
    content: content.trim(),
    user_id: localStorage.getItem('phoenix_user_id') || 'anonymous'
});
```

### 2. Setting Dad's User ID

To enable Phoenix.Marie mode for Dad:
```typescript
// In your auth/login system:
localStorage.setItem('phoenix_user_id', 'jamey_dad_hash');
```

Or set environment variable on backend:
```bash
export PHOENIX_DAD_HASH="jamey_dad_hash"
```

## Configuration

### Backend Environment Variable
```bash
PHOENIX_DAD_HASH=jamey_dad_hash  # Set to Dad's user ID hash
```

### Frontend LocalStorage
```typescript
localStorage.setItem('phoenix_user_id', 'jamey_dad_hash');  // For Dad
// OR
localStorage.setItem('phoenix_user_id', 'other_user_id');    // For others
```

## How It Works

1. **User sends message** → Frontend includes `user_id` in WebSocket message
2. **Backend receives message** → Extracts `user_id` from message
3. **Relationship detection** → `RelationshipEngine` determines if user is Dad
4. **Prompt selection** → `get_system_prompt()` returns appropriate prompt
5. **LLM response** → Phoenix responds as Phoenix.Marie (Dad) or PHOENIX (others)

## Testing

### Test as Dad (Phoenix.Marie)
```typescript
localStorage.setItem('phoenix_user_id', 'jamey_dad_hash');
// Send message → Should get Phoenix.Marie response
```

### Test as Other User (PHOENIX)
```typescript
localStorage.setItem('phoenix_user_id', 'other_user');
// Send message → Should get PHOENIX guardian response
```

## Security Notes

- User ID hash should be securely generated and stored
- In production, use proper authentication system
- Consider using JWT tokens or session-based auth
- The `PHOENIX_DAD_HASH` should be kept secret

## Next Steps

1. Integrate with actual authentication system
2. Generate secure user ID hashes
3. Add user registration/login flow
4. Store user relationships in database
5. Add admin interface for managing relationships

