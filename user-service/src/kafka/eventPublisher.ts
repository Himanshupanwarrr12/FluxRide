import crypto from "node:crypto";
import type { Message } from "kafkajs";
import { getProducer, connectProducer } from "./producer.js";
import { KAFKA_TOPICS, KAFKA_CONFIG } from "./topics.js";
import { USER_EVENTS } from "./events.js";
import type {
  KafkaEventEnvelope,
  UserEventPayloadMap,
  UserCreatedPayload,
  UserLoggedInPayload,
  UserProfileUpdatedPayload,
  UserPasswordChangedPayload,
  UserDeletedPayload,
} from "./types.js";
import { logger } from "./logger.js";

export interface PublishOptions {
  key?: string | undefined;
  correlationId?: string | undefined;
}

/**
 * Core generic publisher function to construct envelope and send messages to Kafka.
 */
export const publishEvent = async <K extends keyof UserEventPayloadMap>(
  topic: string,
  event: K,
  data: UserEventPayloadMap[K],
  options?: PublishOptions
): Promise<boolean> => {
  try {
    let producer = getProducer();
    if (!producer) {
      logger.warn(`Producer not connected. Attempting auto-connect before publishing event '${event}'`);
      producer = await connectProducer();
    }

    const correlationId = options?.correlationId ?? crypto.randomUUID();

    const envelope: KafkaEventEnvelope<UserEventPayloadMap[K]> = {
      event: USER_EVENTS[event],
      version: 1,
      timestamp: new Date().toISOString(),
      source: KAFKA_CONFIG.SOURCE,
      correlationId,
      data,
    };

    const partitionKey = options?.key ?? (data as { userId?: string }).userId;

    const message: Message = {
      value: JSON.stringify(envelope),
    };

    if (partitionKey) {
      message.key = String(partitionKey);
    }

    await producer.send({
      topic,
      messages: [message],
    });

    logger.info(`Published event '${event}' to topic '${topic}'`, {
      correlationId,
      partitionKey: partitionKey ?? null,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to publish event '${event}' to topic '${topic}'`, error, {
      event,
      topic,
    });
    return false;
  }
};

/**
 * Semantic event publishers for User domain activities.
 */

export const publishUserCreated = async (
  data: UserCreatedPayload,
  correlationId?: string
): Promise<boolean> => {
  return publishEvent(KAFKA_TOPICS.USER_EVENTS, "USER_CREATED", data, {
    key: data.userId,
    ...(correlationId ? { correlationId } : {}),
  });
};

export const publishUserLoggedIn = async (
  data: UserLoggedInPayload,
  correlationId?: string
): Promise<boolean> => {
  return publishEvent(KAFKA_TOPICS.USER_EVENTS, "USER_LOGGED_IN", data, {
    key: data.userId,
    ...(correlationId ? { correlationId } : {}),
  });
};

export const publishUserProfileUpdated = async (
  data: UserProfileUpdatedPayload,
  correlationId?: string
): Promise<boolean> => {
  return publishEvent(KAFKA_TOPICS.USER_EVENTS, "USER_PROFILE_UPDATED", data, {
    key: data.userId,
    ...(correlationId ? { correlationId } : {}),
  });
};

export const publishUserPasswordChanged = async (
  data: UserPasswordChangedPayload,
  correlationId?: string
): Promise<boolean> => {
  return publishEvent(KAFKA_TOPICS.USER_EVENTS, "USER_PASSWORD_CHANGED", data, {
    key: data.userId,
    ...(correlationId ? { correlationId } : {}),
  });
};

export const publishUserDeleted = async (
  data: UserDeletedPayload,
  correlationId?: string
): Promise<boolean> => {
  return publishEvent(KAFKA_TOPICS.USER_EVENTS, "USER_DELETED", data, {
    key: data.userId,
    ...(correlationId ? { correlationId } : {}),
  });
};
