/**
 * Advanced Security Monitoring System
 * Provides threat detection, intrusion monitoring, and security analytics
 */

import { EventEmitter } from 'events';
import { logger } from '../logger-pino.js';
import { auditLogger } from '../audit/audit-logger.js';
import { getSecurityConfig } from '../config/config.js';

export interface SecurityThreat {
  id: string;
  timestamp: number;
  type: 'brute_force' | 'rate_limit_exceeded' | 'suspicious_pattern' | 'data_exfiltration' | 'injection_attempt' | 'privilege_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip?: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  };
  details: {
    description: string;
    indicators: string[];
    affectedResources: string[];
    attemptCount?: number;
    timeWindow?: number;
    metadata?: Record<string, any>;
  };
  mitigationActions: string[];
  resolved: boolean;
  resolvedAt?: number;
}

export interface SecurityConfiguration {
  enabled: boolean;
  bruteForceProtection: {
    enabled: boolean;
    maxAttempts: number;
    timeWindow: number;
    blockDuration: number;
  };
  rateLimitMonitoring: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    blockDuration: number;
  };
  suspiciousPatternDetection: {
    enabled: boolean;
    sqlInjectionDetection: boolean;
    xssDetection: boolean;
    pathTraversalDetection: boolean;
    commandInjectionDetection: boolean;
  };
  dataExfiltrationDetection: {
    enabled: boolean;
    maxResponseSize: number;
    maxRequestsPerMinute: number;
    sensitiveDataPatterns: string[];
  };
  ipBlocking: {
    enabled: boolean;
    autoBlock: boolean;
    whitelist: string[];
    blacklist: string[];
  };
  alerting: {
    enabled: boolean;
    criticalThreshold: number;
    webhookUrl?: string;
    emailRecipients: string[];
  };
}

export class SecurityMonitor extends EventEmitter {
  private config: SecurityConfiguration;
  private threats: SecurityThreat[] = [];
  private attemptTracking = new Map<string, { count: number; firstAttempt: number; lastAttempt: number }>();
  private rateLimitTracking = new Map<string, { requests: number[]; lastReset: number }>();
  private blockedIPs = new Set<string>();
  private whitelistedIPs = new Set<string>();

  constructor(config: Partial<SecurityConfiguration> = {}) {
    super();

    // Load configuration from centralized config system
    const securityConfig = getSecurityConfig();
    this.config = {
      enabled: securityConfig.monitoring.enabled,
      bruteForceProtection: {
        enabled: true,
        maxAttempts: securityConfig.bruteForceProtection.maxAttempts,
        timeWindow: securityConfig.bruteForceProtection.timeWindow,
        blockDuration: securityConfig.bruteForceProtection.blockDuration,
      },
      rateLimitMonitoring: {
        enabled: true,
        requestsPerMinute: securityConfig.rateLimiting.requestsPerMinute,
        burstLimit: securityConfig.rateLimiting.burstLimit,
        blockDuration: securityConfig.rateLimiting.blockDuration,
      },
      suspiciousPatternDetection: {
        enabled: true,
        sqlInjectionDetection: securityConfig.threatDetection.sqlInjection,
        xssDetection: securityConfig.threatDetection.xss,
        pathTraversalDetection: securityConfig.threatDetection.pathTraversal,
        commandInjectionDetection: securityConfig.threatDetection.commandInjection,
      },
      dataExfiltrationDetection: {
        enabled: true,
        maxResponseSize: securityConfig.inputValidation.maxRequestSize,
        maxRequestsPerMinute: Math.floor(securityConfig.rateLimiting.requestsPerMinute / 2),
        sensitiveDataPatterns: securityConfig.dataProtection.customMaskPatterns,
      },
      ipBlocking: {
        enabled: securityConfig.ipBlocking.enabled,
        autoBlock: securityConfig.ipBlocking.autoBlock,
        whitelist: securityConfig.ipBlocking.whitelist,
        blacklist: securityConfig.ipBlocking.blacklist,
      },
      alerting: {
        enabled: securityConfig.alerting.enabled,
        criticalThreshold: securityConfig.alerting.criticalThreshold,
        webhookUrl: securityConfig.alerting.webhookUrl,
        emailRecipients: securityConfig.alerting.emailRecipients,
      },
      ...config,
    };

    this.initializeIPLists();

    if (this.config.enabled) {
      logger.info('Security monitoring system initialized');
    }
  }

  /**
   * Monitor an HTTP request for security threats
   */
  monitorRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any,
    sourceIP?: string,
    userId?: string,
  ): SecurityThreat[] {
    if (!this.config.enabled) {
      return [];
    }

    const threats: SecurityThreat[] = [];
    const context = {
      method,
      url,
      headers,
      body,
      sourceIP,
      userId,
      timestamp: Date.now(),
    };

    // Check if IP is blocked
    if (sourceIP && this.isIPBlocked(sourceIP)) {
      threats.push(this.createThreat('suspicious_pattern', 'high', context, {
        description: 'Request from blocked IP address',
        indicators: [`Blocked IP: ${sourceIP}`],
        affectedResources: [url],
      }));
    }

    // Brute force detection
    if (this.config.bruteForceProtection.enabled) {
      const bruteForceThreats = this.detectBruteForce(context);
      threats.push(...bruteForceThreats);
    }

    // Rate limit monitoring
    if (this.config.rateLimitMonitoring.enabled) {
      const rateLimitThreats = this.detectRateLimitViolations(context);
      threats.push(...rateLimitThreats);
    }

    // Suspicious pattern detection
    if (this.config.suspiciousPatternDetection.enabled) {
      const patternThreats = this.detectSuspiciousPatterns(context);
      threats.push(...patternThreats);
    }

    // Store and process threats
    for (const threat of threats) {
      this.processThreat(threat);
    }

    return threats;
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, reason: string, duration?: number): void {
    this.blockedIPs.add(ip);

    if (duration) {
      globalThis.setTimeout(() => {
        this.unblockIP(ip);
      }, duration);
    }

    logger.warn('IP address blocked', { ip, reason, duration });
    auditLogger.logSecurity(
      'ip_blocked',
      'security_blocking',
      'success',
      'high',
      undefined,
      { metadata: { ip, reason, duration } },
    );

    this.emit('ipBlocked', { ip, reason, duration });
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    const wasBlocked = this.blockedIPs.delete(ip);
    if (wasBlocked) {
      logger.info('IP address unblocked', { ip });
      this.emit('ipUnblocked', { ip });
    }
  }

  /**
   * Check if an IP address is blocked
   */
  isIPBlocked(ip: string): boolean {
    if (this.whitelistedIPs.has(ip)) {
      return false;
    }
    return this.blockedIPs.has(ip);
  }

  /**
   * Get security threats
   */
  getThreats(): SecurityThreat[] {
    return [...this.threats].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Initialize IP whitelist and blacklist
   */
  private initializeIPLists(): void {
    this.whitelistedIPs.clear();
    this.blockedIPs.clear();

    for (const ip of this.config.ipBlocking.whitelist) {
      this.whitelistedIPs.add(ip);
    }

    for (const ip of this.config.ipBlocking.blacklist) {
      this.blockedIPs.add(ip);
    }
  }

  /**
   * Detect brute force attacks
   */
  private detectBruteForce(context: any): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const { sourceIP, userId, url } = context;

    if (!url || (!url.includes('auth') && !url.includes('login'))) {
      return threats;
    }

    const key = sourceIP || userId || 'unknown';
    const now = Date.now();
    const tracking = this.attemptTracking.get(key);

    if (tracking) {
      if (now - tracking.firstAttempt <= this.config.bruteForceProtection.timeWindow) {
        tracking.count++;
        tracking.lastAttempt = now;

        if (tracking.count >= this.config.bruteForceProtection.maxAttempts) {
          threats.push(this.createThreat('brute_force', 'high', context, {
            description: 'Brute force attack detected',
            indicators: [`${tracking.count} attempts in ${this.config.bruteForceProtection.timeWindow}ms`],
            affectedResources: [url],
            attemptCount: tracking.count,
            timeWindow: this.config.bruteForceProtection.timeWindow,
          }));

          if (this.config.ipBlocking.autoBlock && sourceIP) {
            this.blockIP(sourceIP, 'Brute force attack', this.config.bruteForceProtection.blockDuration);
          }
        }
      } else {
        tracking.count = 1;
        tracking.firstAttempt = now;
        tracking.lastAttempt = now;
      }
    } else {
      this.attemptTracking.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
    }

    return threats;
  }

  /**
   * Detect rate limit violations
   */
  private detectRateLimitViolations(context: any): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const { sourceIP } = context;

    if (!sourceIP) {
      return threats;
    }

    const now = Date.now();
    const key = sourceIP;
    const tracking = this.rateLimitTracking.get(key);

    if (tracking) {
      tracking.requests = tracking.requests.filter(timestamp => now - timestamp <= 60000);
      tracking.requests.push(now);

      if (tracking.requests.length > this.config.rateLimitMonitoring.requestsPerMinute) {
        threats.push(this.createThreat('rate_limit_exceeded', 'medium', context, {
          description: 'Rate limit exceeded',
          indicators: [`${tracking.requests.length} requests in last minute`],
          affectedResources: ['api'],
        }));

        if (this.config.ipBlocking.autoBlock) {
          this.blockIP(sourceIP, 'Rate limit exceeded', this.config.rateLimitMonitoring.blockDuration);
        }
      }
    } else {
      this.rateLimitTracking.set(key, {
        requests: [now],
        lastReset: now,
      });
    }

    return threats;
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPatterns(context: any): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const { url, body } = context;

    const content = [url, JSON.stringify(body)].filter(Boolean).join(' ');

    // SQL Injection patterns
    if (this.config.suspiciousPatternDetection.sqlInjectionDetection) {
      const sqlPatterns = [
        /(\bunion\b.*\bselect\b)|(\bselect\b.*\bfrom\b)/i,
        /(\bdrop\b|\bdelete\b|\btruncate\b).*\btable\b/i,
        /'.*or.*'.*=/i,
        /\|\|.*concat/i,
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(content)) {
          threats.push(this.createThreat('injection_attempt', 'high', context, {
            description: 'SQL injection attempt detected',
            indicators: [pattern.toString()],
            affectedResources: ['database'],
          }));
        }
      }
    }

    // XSS patterns
    if (this.config.suspiciousPatternDetection.xssDetection) {
      const xssPatterns = [
        /<script.*?>.*?<\/script>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe.*?>/i,
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(content)) {
          threats.push(this.createThreat('injection_attempt', 'high', context, {
            description: 'XSS attempt detected',
            indicators: [pattern.toString()],
            affectedResources: ['web_application'],
          }));
        }
      }
    }

    return threats;
  }

  /**
   * Create a security threat
   */
  private createThreat(
    type: SecurityThreat['type'],
    severity: SecurityThreat['severity'],
    context: any,
    details: Partial<SecurityThreat['details']>,
  ): SecurityThreat {
    const threat: SecurityThreat = {
      id: this.generateThreatId(),
      timestamp: Date.now(),
      type,
      severity,
      source: {
        ip: context.sourceIP,
        userAgent: context.headers?.['user-agent'],
        userId: context.userId,
        sessionId: context.sessionId,
      },
      details: {
        description: details.description || 'Security threat detected',
        indicators: details.indicators || [],
        affectedResources: details.affectedResources || [],
        attemptCount: details.attemptCount,
        timeWindow: details.timeWindow,
        metadata: details.metadata,
      },
      mitigationActions: [],
      resolved: false,
    };

    return threat;
  }

  /**
   * Process a detected threat
   */
  private processThreat(threat: SecurityThreat): void {
    this.threats.push(threat);

    if (this.threats.length > 1000) {
      this.threats.shift();
    }

    auditLogger.logSecurity(
      `threat_detected_${threat.type}`,
      'security_monitor',
      'success',
      threat.severity,
      threat.source.userId,
      {
        metadata: {
          threatId: threat.id,
          threatType: threat.type,
          threatSeverity: threat.severity,
          sourceIP: threat.source.ip,
          indicators: threat.details.indicators,
        },
      },
    );

    this.emit('threatDetected', threat);

    if (threat.severity === 'critical') {
      this.emit('criticalThreat', threat);
    }

    logger.warn('Security threat detected', {
      threatId: threat.id,
      type: threat.type,
      severity: threat.severity,
      sourceIP: threat.source.ip,
      description: threat.details.description,
    });
  }

  /**
   * Generate unique threat ID
   */
  private generateThreatId(): string {
    return `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();
