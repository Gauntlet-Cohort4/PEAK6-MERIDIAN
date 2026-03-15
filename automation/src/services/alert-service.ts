/**
 * @module alert-service
 * Alerting service for notifying admins of critical automation events.
 * Supports webhook delivery (Slack, Discord, PagerDuty) with console fallback.
 */

import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('alert-service');

/** Alert severity level. */
export type AlertLevel = 'warning' | 'critical';

/** Interface for sending alerts to admins. */
export interface AlertService {
  readonly sendAlert: (
    level: AlertLevel,
    title: string,
    details: Readonly<Record<string, unknown>>,
  ) => Promise<void>;
}

/**
 * Webhook-based alert service.
 * POSTs JSON payloads to a configurable URL (compatible with Slack incoming
 * webhooks, Discord webhooks, PagerDuty events API, etc.).
 */
function createWebhookAlertService(webhookUrl: string): AlertService {
  return Object.freeze({
    async sendAlert(
      level: AlertLevel,
      title: string,
      details: Readonly<Record<string, unknown>>,
    ): Promise<void> {
      const payload = Object.freeze({
        text: `[${level.toUpperCase()}] ${title}`,
        level,
        title,
        details,
        timestamp: new Date().toISOString(),
        source: 'meridian-automation',
      });

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          logger.error('sendAlert', `Webhook returned HTTP ${response.status}`, {
            context: { status: response.status, level, title },
          });
        } else {
          logger.info('sendAlert', `Alert delivered via webhook`, {
            context: { level, title },
          });
        }
      } catch (err) {
        logger.error('sendAlert', 'Failed to deliver webhook alert', {
          error: err,
          context: { level, title },
        });
      }
    },
  });
}

/**
 * Console-based alert service (fallback).
 * Logs alerts with an [ALERT] prefix for visibility in log aggregation.
 */
function createConsoleAlertService(): AlertService {
  return Object.freeze({
    async sendAlert(
      level: AlertLevel,
      title: string,
      details: Readonly<Record<string, unknown>>,
    ): Promise<void> {
      const detailsStr = JSON.stringify(details, null, 2);
      const message = `[ALERT][${level.toUpperCase()}] ${title}\n${detailsStr}`;

      if (level === 'critical') {
        logger.error('sendAlert', message);
      } else {
        logger.warn('sendAlert', message);
      }
    },
  });
}

/**
 * Factory function to create the appropriate alert service.
 * Returns a webhook implementation if a URL is provided, otherwise a console fallback.
 */
export function createAlertService(webhookUrl?: string): AlertService {
  if (webhookUrl && webhookUrl.length > 0) {
    logger.info('createAlertService', 'Using webhook alert service', {
      context: { webhookUrl: webhookUrl.replace(/\/[^/]+$/, '/***') },
    });
    return createWebhookAlertService(webhookUrl);
  }

  logger.info('createAlertService', 'Using console alert service (no webhook URL configured)');
  return createConsoleAlertService();
}
