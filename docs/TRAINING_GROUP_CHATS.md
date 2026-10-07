# Training Group Chats — design and production rules

## Purpose
Each SportBuddy training gets one server-authoritative group chat. The group is tied to the training lifecycle, not to friendship or dating matches.

## Lifecycle
- New training: server creates `training_<trainingId>`.
- Organizer is the first participant.
- Join training: athlete is added to both training.participantIds and chat.participantIds in one transaction.
- Leave training: athlete is removed from chat access immediately.
- Legacy training: group is created lazily through `ensureGroupChat` only for a current participant.
- Complete training: final participant list is frozen and the group receives `archivedAt`.
- Archived group: final participants can read history, but no one can send, type or delete messages.

## Message rules
- Text only. No chat photos or videos.
- Same 2000-character limit and anti-flood policy as direct messages.
- Reply-to-message supported.
- Delete-for-everyone supported only while the group is active and within the existing 15-minute window.
- Unread counters are maintained independently for every participant.
- Group push does not contain message text.
- Typing state is short-lived metadata.

## Privacy / membership
- All writes go through the authenticated server API.
- Group membership is derived from the authoritative training participantIds.
- Leaving an active training removes access to the group and its history.
- Completing a training preserves read-only history only for the final participant set.
- Firestore client writes remain disabled.

## UX
Chats contains three categories:
1. Matches
2. Friends
3. Training groups

Training details expose “Чат участников” for current participants. Completed trainings open the archived conversation.
