/**
 * Centralized Kafka event names for user-service domain.
 * Follows UPPER_SNAKE_CASE event naming convention defined in AGENTS.md.
 */
export const USER_EVENTS = {
  USER_CREATED: "USER_CREATED",
  USER_LOGGED_IN: "USER_LOGGED_IN",
  USER_PROFILE_UPDATED: "USER_PROFILE_UPDATED",
  USER_PASSWORD_CHANGED: "USER_PASSWORD_CHANGED",
  USER_DELETED: "USER_DELETED",
} as const;

export type UserEventType = typeof USER_EVENTS[keyof typeof USER_EVENTS];
