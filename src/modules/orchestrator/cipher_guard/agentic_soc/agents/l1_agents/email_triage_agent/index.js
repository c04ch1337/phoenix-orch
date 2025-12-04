/**
 * Email Triage Agent
 * 
 * This specialized L1 agent handles the triage of suspicious emails, primarily from
 * Proofpoint alerts. It analyzes email content and attachments, extracts IOCs,
 * categorizes threats, assesses severity, and can trigger automated containment actions
 * for high-confidence threats.
 */

const { BaseL1Agent } = require('../../agentic_soc_framework');
const utils = require('../../../utils');

/**
 * Email specific detection patterns
 * @type {Array<Object>}
 * @private
 */
const EMAIL_DETECTION_PATTERNS = [
  {
    id: 'suspicious-attachment-type',
    pattern: 'attachment_extension_match',
    extensions: ['.exe', '.js', '.vbs', '.bat', '.ps1', '.hta', '.scr', '.pif', '.dll'],
    threshold: 1,
    severity: 65
  },
  {
    id: 'phishing-keywords',
    pattern: 'content_keywords_match',
    keywords: ['password', 'login', 'credentials', 'account locked', 'verify', 'update payment', 'unusual sign-in'],
    threshold: 3,
    severity: 60
  },
  {
    id: 'malicious-urls',
    pattern: 'url_analysis',
    indicators: ['redirect', 'shortened', 'lookalike domain', 'uncommon tld'],
    threshold: 1,
    severity: 70
  },
  {
    id: 'spoofed-sender',
    pattern: 'header_analysis',
    indicators: ['display name mismatch', 'domain mismatch', 'forged headers'],
    threshold: 1,
    severity: 75
  }
];

/**
 * Email IOC extraction types
 * @type {Array<string>}
 * @private
 */
const EMAIL_IOC_TYPES = [
  'url',
  'domain',
  'ip-address',
  'email-address',
  'hash',
  'filename'
];

/**
 * Email threat categories
 * @type {Object}
 * @private
 */
const EMAIL_THREAT_CATEGORIES = {
  PHISHING: 'phishing',
  MALWARE: 'malware',
  SPAM: 'spam',
  BEC: 'business-email-compromise',
  RECONNAISSANCE: 'reconnaissance',
  SPEAR_PHISHING: 'spear-phishing',
  SOCIAL_ENGINEERING: 'social-engineering'
};

/**
 * Email Triage Agent - Specializes in analyzing suspicious emails and phishing alerts
 * @class EmailTriageAgent
 * @extends BaseL1Agent
 */
class EmailTriageAgent extends BaseL1Agent {
  /**
   * Create a new EmailTriageAgent
   * @param {Object} config - Agent configuration
   * @param {Object} messageBus - System message bus
   */
  constructor(config = {}, messageBus = null) {
    // Add email-specific capabilities to config
    const emailConfig = {
      ...config,
      type: 'email_triage_agent',
      name: config.name || 'Email Triage Agent',
      capabilities: [
        ...(config.capabilities || []),
        'email_analysis',
        'ioc_extraction',
        'phishing_detection',
        'attachment_analysis',
        'header_analysis',
        'url_analysis'
      ]
    };

    super(emailConfig, messageBus);

    // Email agent specific properties
    this._emailAlert = {
      proofpointEnabled: config.proofpointEnabled !== false,
      mimecastEnabled: config.mimecastEnabled === true,
      o365DefenderEnabled: config.o365DefenderEnabled === true
    };

    // Containment configuration - controls when automatic containment is triggered
    this._containmentConfig = {
      enableAutoContainment: config.enableAutoContainment !== false,
      minSeverityForContainment: config.minSeverityForContainment || 80,
      minConfidenceForContainment: config.minConfidenceForContainment || 85,
      containmentActions: config.containmentActions || [
        'quarantine_email',
        'block_sender',
        'block_urls',
        'block_attachments'
      ]
    };

    // IOC extraction configuration
    this._iocExtractionConfig = {
      extractAttachmentHashes: config.extractAttachmentHashes !== false,
      extractEmbeddedUrls: config.extractEmbeddedUrls !== false,
      extractSenderInfo: config.extractSenderInfo !== false,
      maxUrlsToExtract: config.maxUrlsToExtract || 20
    };

    // Initialize additional event subscriptions
    this._initializeEmailEventSubscriptions();
  }

  /**
   * Initialize email-specific event subscriptions
   * @private
   */
  _initializeEmailEventSubscriptions() {
    if (this._messageBus) {
      // Subscribe to relevant email message types
      const additionalSubscriptions = [
        this.subscribeToMessages('email:suspicious', this._handleSuspiciousEmail.bind(this)),
        this.subscribeToMessages('proofpoint:alert', this._handleProofpointAlert.bind(this)),
        this.subscribeToMessages('mimecast:alert', this._handleMimecastAlert.bind(this)),
        this.subscribeToMessages('o365:defender:alert', this._handleO365DefenderAlert.bind(this))
      ];

      // Add to subscriptions array
      if (!this._subscriptions) {
        this._subscriptions = [];
      }
      this._subscriptions.push(...additionalSubscriptions);
    }
  }

  /**
   * Lifecycle hook called during initialization
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   * @protected
   */
  async _onInitialize(options) {
    // Call parent initialization
    await super._onInitialize(options);
    
    // Email agent specific initialization
    this.log.info('Initializing Email Triage Agent specific components');
    
    try {
      // Load email detection patterns
      await this._loadEmailDetectionPatterns();
      
      this.log.info('Email triage agent initialization complete');
    } catch (error) {
      this.log.error('Error during Email triage agent initialization', error);
      throw error;
    }
  }

  /**
   * Load email detection patterns
   * @returns {Promise<void>}
   * @private
   */
  async _loadEmailDetectionPatterns() {
    try {
      this.log.info('Loading email detection patterns');
      
      // In a production implementation this might load from a data source
      // Here we're adding our email-specific patterns to the base patterns
      
      // Add email-specific patterns to detection patterns
      for (const pattern of EMAIL_DETECTION_PATTERNS) {
        this.addDetectionPattern(pattern);
      }
      
      this.log.info(`Loaded ${EMAIL_DETECTION_PATTERNS.length} email detection patterns`);
    } catch (error) {
      this.log.error('Failed to load email detection patterns', error);
      throw error;
    }
  }

  /**
   * Handle suspicious email
   * @param {Object} message - Message data
   * @private
   */
  _handleSuspiciousEmail(message) {
    try {
      const email = message.data;
      
      this.log.debug(`Received suspicious email: ${email.id} - From: ${email.sender}`);
      
      // Add the email as a task to be processed
      this.addTask({
        data: {
          type: 'suspicious_email',
          email
        },
        priority: this._determineEmailPriority(email)
      });
    } catch (error) {
      this.log.error('Error handling suspicious email', error);
    }
  }

  /**
   * Handle Proofpoint alert
   * @param {Object} message - Message data
   * @private
   */
  _handleProofpointAlert(message) {
    try {
      if (!this._emailAlert.proofpointEnabled) {
        this.log.debug('Proofpoint alerts are disabled, ignoring');
        return;
      }

      const alert = message.data;
      
      this.log.debug(`Received Proofpoint alert: ${alert.id} - ${alert.threatType}`);
      
      // Convert Proofpoint alert to internal format and add as task
      const email = this._convertProofpointAlertToEmail(alert);
      this.addTask({
        data: {
          type: 'suspicious_email',
          source: 'proofpoint',
          email,
          rawAlert: alert
        },
        priority: this._determineEmailPriority(email)
      });
    } catch (error) {
      this.log.error('Error handling Proofpoint alert', error);
    }
  }

  /**
   * Handle Mimecast alert
   * @param {Object} message - Message data
   * @private
   */
  _handleMimecastAlert(message) {
    try {
      if (!this._emailAlert.mimecastEnabled) {
        this.log.debug('Mimecast alerts are disabled, ignoring');
        return;
      }

      const alert = message.data;
      
      this.log.debug(`Received Mimecast alert: ${alert.id} - ${alert.threatType}`);
      
      // Convert Mimecast alert to internal format and add as task
      const email = this._convertMimecastAlertToEmail(alert);
      this.addTask({
        data: {
          type: 'suspicious_email',
          source: 'mimecast',
          email,
          rawAlert: alert
        },
        priority: this._determineEmailPriority(email)
      });
    } catch (error) {
      this.log.error('Error handling Mimecast alert', error);
    }
  }

  /**
   * Handle Office 365 Defender alert
   * @param {Object} message - Message data
   * @private
   */
  _handleO365DefenderAlert(message) {
    try {
      if (!this._emailAlert.o365DefenderEnabled) {
        this.log.debug('Office 365 Defender alerts are disabled, ignoring');
        return;
      }

      const alert = message.data;
      
      this.log.debug(`Received O365 Defender alert: ${alert.id} - ${alert.threatType}`);
      
      // Convert O365 Defender alert to internal format and add as task
      const email = this._convertO365DefenderAlertToEmail(alert);
      this.addTask({
        data: {
          type: 'suspicious_email',
          source: 'o365_defender',
          email,
          rawAlert: alert
        },
        priority: this._determineEmailPriority(email)
      });
    } catch (error) {
      this.log.error('Error handling O365 Defender alert', error);
    }
  }

  /**
   * Convert Proofpoint alert to internal email format
   * @param {Object} alert - Proofpoint alert
   * @returns {Object} Normalized email object
   * @private
   */
  _convertProofpointAlertToEmail(alert) {
    // This would contain the actual mapping logic for Proofpoint's format
    // Placeholder implementation
    return {
      id: alert.id || utils.encryption.generateId(),
      source: 'proofpoint',
      sender: alert.sender || alert.from || '',
      recipient: alert.recipient || alert.to || '',
      subject: alert.subject || '',
      receivedTime: alert.timestamp || Date.now(),
      hasAttachments: !!alert.attachments && alert.attachments.length > 0,
      attachments: alert.attachments || [],
      urls: alert.urls || [],
      body: alert.body || '',
      headers: alert.headers || {},
      threatInfo: {
        score: alert.score,
        category: alert.threatType,
        rules: alert.rules || []
      },
      rawData: alert
    };
  }
  
  /**
   * Convert Mimecast alert to internal email format
   * @param {Object} alert - Mimecast alert
   * @returns {Object} Normalized email object
   * @private
   */
  _convertMimecastAlertToEmail(alert) {
    // This would contain the actual mapping logic for Mimecast's format
    // Placeholder implementation
    return {
      id: alert.id || utils.encryption.generateId(),
      source: 'mimecast',
      sender: alert.sender || alert.from || '',
      recipient: alert.recipient || alert.to || '',
      subject: alert.subject || '',
      receivedTime: alert.timestamp || Date.now(),
      hasAttachments: !!alert.attachments && alert.attachments.length > 0,
      attachments: alert.attachments || [],
      urls: alert.urls || [],
      body: alert.body || '',
      headers: alert.headers || {},
      threatInfo: {
        score: alert.score,
        category: alert.threatType,
        rules: alert.rules || []
      },
      rawData: alert
    };
  }
  
  /**
   * Convert Office 365 Defender alert to internal email format
   * @param {Object} alert - O365 Defender alert
   * @returns {Object} Normalized email object
   * @private
   */
  _convertO365DefenderAlertToEmail(alert) {
    // This would contain the actual mapping logic for O365's format
    // Placeholder implementation
    return {
      id: alert.id || utils.encryption.generateId(),
      source: 'o365_defender',
      sender: alert.sender || alert.from || '',
      recipient: alert.recipient || alert.to || '',
      subject: alert.subject || '',
      receivedTime: alert.timestamp || Date.now(),
      hasAttachments: !!alert.attachments && alert.attachments.length > 0,
      attachments: alert.attachments || [],
      urls: alert.urls || [],
      body: alert.body || '',
      headers: alert.headers || {},
      threatInfo: {
        score: alert.score,
        category: alert.threatType,
        rules: alert.rules || []
      },
      rawData: alert
    };
  }

  /**
   * Determine email priority
   * @param {Object} email - Email to evaluate
   * @returns {number} Priority (0-100)
   * @private
   */
  _determineEmailPriority(email) {
    // Start with a base priority
    let priority = 50;
    
    // Adjust if there's already a threat score from the email security tool
    if (email.threatInfo && typeof email.threatInfo.score === 'number') {
      priority = Math.max(priority, email.threatInfo.score);
    }
    
    // Increase priority for emails with attachments
    if (email.hasAttachments) {
      priority += 10;
    }
    
    // Increase priority for emails with suspicious URLs
    if (email.urls && email.urls.length > 0) {
      priority += 5;
    }
    
    // Increase priority for targeted emails (vs. bulk)
    if (email.recipientCount === 1 || (email.recipient && !email.recipient.includes(','))) {
      priority += 10;
    }
    
    // Increase priority for emails to VIPs or executives
    if (email.recipient && this._isRecipientVIP(email.recipient)) {
      priority += 15;
    }
    
    // Ensure priority is within bounds
    return Math.min(Math.max(priority, 0), 100);
  }

  /**
   * Check if recipient is a VIP
   * @param {string} recipient - Email recipient
   * @returns {boolean} True if recipient is a VIP
   * @private
   */
  _isRecipientVIP(recipient) {
    // In a real implementation, this would check against a VIP list
    // Placeholder implementation
    const vipDomains = ['executive', 'leadership', 'board', 'c-level'];
    const vipTitles = ['ceo', 'cfo', 'cio', 'cto', 'president', 'director', 'vp'];
    
    const lowerRecipient = recipient.toLowerCase();
    
    // Check for VIP domains
    for (const domain of vipDomains) {
      if (lowerRecipient.includes(domain)) {
        return true;
      }
    }
    
    // Check for VIP titles
    for (const title of vipTitles) {
      if (lowerRecipient.includes(title)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Process an email
   * @param {Object} data - Task data
   * @returns {Promise<Object>} Processing result
   */
  async process(data) {
    if (data.type === 'suspicious_email') {
      return await this._processSuspiciousEmail(data);
    }
    
    // For other data types, use the parent class implementation
    return await super.process(data);
  }

  /**
   * Process a suspicious email
   * @param {Object} data - Email data
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processSuspiciousEmail(data) {
    const startTime = Date.now();
    const email = data.email;
    
    this.log.info(`Processing suspicious email: ${email.id} - From: ${email.sender} - Subject: ${email.subject}`);
    
    try {
      // Perform email triage
      const triageResult = await this.triageEmail(email, data.rawAlert);
      
      // Update metrics
      this._triageMetrics.alertsProcessed++;
      this._triageMetrics.totalTriageTime += (Date.now() - startTime);
      this._triageMetrics.avgTriageTime = 
        this._triageMetrics.totalTriageTime / this._triageMetrics.alertsProcessed;
      
      // Report metrics
      utils.metrics.gauge(`agent.${this.id}.triage_time_ms`, Date.now() - startTime);
      utils.metrics.increment(`agent.${this.id}.items_processed`, 1, { 
        type: 'suspicious_email',
        source: email.source || 'unknown'
      });
      
      // Execute automatic containment if needed
      let containmentActions = null;
      if (this._shouldAutomaticallyContain(triageResult)) {
        containmentActions = await this._executeContainment(email, triageResult);
        
        // Report containment
        utils.metrics.increment(`agent.${this.id}.containment_actions`, 
          containmentActions.length, { 
            emailSource: email.source || 'unknown',
            category: triageResult.category
          }
        );
      }
      
      // Check if the email needs to be escalated
      if (this._shouldEscalate(triageResult)) {
        await this._escalateTriageResult(triageResult, {
          ...email,
          containmentActions
        });
        
        return {
          status: 'escalated',
          triageResult,
          containmentActions
        };
      }
      
      // Generate report if not escalated
      const report = await this.generateEmailReport(triageResult, email, containmentActions);
      
      return {
        status: 'resolved',
        triageResult,
        containmentActions,
        report
      };
    } catch (error) {
      this.log.error(`Error processing suspicious email: ${email.id}`, error);
      throw error;
    }
  }

  /**
   * Triage a suspicious email
   * @param {Object} email - Email to triage
   * @param {Object} rawAlert - Raw alert data (optional)
   * @returns {Promise<Object>} Triage result
   */
  async triageEmail(email, rawAlert = null) {
    try {
      this.log.info(`Triaging email: ${email.id}`);
      
      // Create base triage result
      const result = {
        id: utils.encryption.generateId(),
        emailId: email.id,
        timestamp: Date.now(),
        findings: [],
        iocs: []
      };
      
      // Extract and analyze email components
      result.headerAnalysis = await this._analyzeEmailHeaders(email);
      result.bodyAnalysis = await this._analyzeEmailBody(email);
      result.attachmentAnalysis = await this._analyzeAttachments(email);
      result.urlAnalysis = await this._analyzeUrls(email);
      
      // Extract IOCs
      result.iocs = await this._extractIOCs(email);
      
      // Determine email category
      result.category = this._categorizeEmail(email, result);
      
      // Calculate severity
      result.severity = this._calculateEmailSeverity(email, result);
      
      // Calculate confidence
      result.confidence = this._calculateConfidence(email, result);
      
      // Check if this is likely a false positive
      result.isFalsePositive = await this._checkEmailFalsePositive(email, result);
      if (result.isFalsePositive) {
        this._triageMetrics.falsePositivesIdentified++;
      }
      
      // Add pattern match assessments
      const patternMatches = await this._checkPatternMatches(email);
      if (patternMatches.length > 0) {
        result.findings.push({
          type: 'pattern_matches',
          matches: patternMatches,
          timestamp: Date.now()
        });
      }
      
      // Determine containment recommendations
      result.containmentRecommendations = this._generateContainmentRecommendations(email, result);
      
      // Determine which L2 agent should handle this if escalated
      result.recommendedEscalationTarget = this._determineEscalationTarget(result);
      
      return result;
    } catch (error) {
      this.log.error(`Error triaging email: ${email.id}`, error);
      throw error;
    }
  }

  /**
   * Analyze email headers
   * @param {Object} email - Email to analyze
   * @returns {Promise<Object>} Header analysis
   * @private
   */
  async _analyzeEmailHeaders(email) {
    // This would contain detailed header analysis logic
    // Placeholder implementation
    const result = {
      findings: [],
      suspiciousHeaders: false,
      spfResult: email.headers?.spf || 'unknown',
      dkimResult: email.headers?.dkim || 'unknown',
      dmarcResult: email.headers?.dmarc || 'unknown',
      authenticationPassed: true
    };
    
    // Check for SPF failures
    if (result.spfResult && result.spfResult !== 'pass') {
      result.findings.push({
        type: 'spf_failure',
        value: result.spfResult,
        severity: 60
      });
      
      result.authenticationPassed = false;
      result.suspiciousHeaders = true;
    }
    
    // Check for DKIM failures
    if (result.dkimResult && result.dkimResult !== 'pass') {
      result.findings.push({
        type: 'dkim_failure',
        value: result.dkimResult,
        severity: 65
      });
      
      result.authenticationPassed = false;
      result.suspiciousHeaders = true;
    }
    
    // Check for DMARC failures
    if (result.dmarcResult && result.dmarcResult !== 'pass') {
      result.findings.push({
        type: 'dmarc_failure',
        value: result.dmarcResult,
        severity: 70
      });
      
      result.authenticationPassed = false;
      result.suspiciousHeaders = true;
    }
    
    // Check for reply-to mismatch
    if (email.headers?.replyTo && email.sender && 
        !email.headers.replyTo.includes(email.sender.split('@')[1])) {
      result.findings.push({
        type: 'reply_to_mismatch',
        value: email.headers.replyTo,
        severity: 75
      });
      
      result.suspiciousHeaders = true;
    }
    
    return result;
  }

  /**
   * Analyze email body
   * @param {Object} email - Email to analyze
   * @returns {Promise<Object>} Body analysis
   * @private
   */
  async _analyzeEmailBody(email) {
    // This would contain detailed body content analysis
    // Placeholder implementation
    const result = {
      findings: [],
      containsPhishingLanguage: false,
      containsUrgencyIndicators: false,
      containsSuspiciousFormatting: false
    };
    
    // Check for phishing language
    const phishingTerms = [
      'verify your account', 'confirm your password', 'update your information',
      'suspicious activity', 'unusual sign-in', 'security alert'
    ];
    
    for (const term of phishingTerms) {
      if (email.body && email.body.toLowerCase().includes(term.toLowerCase())) {
        result.findings.push({
          type: 'phishing_language',
          value: term,
          severity: 55
        });
        
        result.containsPhishingLanguage = true;
      }
    }
    
    // Check for urgency indicators
    const urgencyTerms = [
      'immediate action required', 'urgent', 'act now', 'expires today',
      '24 hours', 'immediately', 'failure to respond'
    ];
    
    for (const term of urgencyTerms) {
      if (email.body && email.body.toLowerCase().includes(term.toLowerCase())) {
        result.findings.push({
          type: 'urgency_indicator',
          value: term,
          severity: 40
        });
        
        result.containsUrgencyIndicators = true;
      }
    }
    
    return result;
  }

  /**
   * Analyze email attachments
   * @param {Object} email - Email to analyze
   * @returns {Promise<Object>} Attachment analysis
   * @private
   */
  async _analyzeAttachments(email) {
    // This would contain detailed attachment analysis
    // Placeholder implementation
    const result = {
      findings: [],
      suspiciousAttachments: false,
      totalAttachments: email.attachments ? email.attachments.length : 0,
      suspiciousAttachmentCount: 0
    };
    
    // If no attachments, return empty analysis
    if (!email.attachments || email.attachments.length === 0) {
      return result;
    }
    
    // Suspicious file extensions
    const suspiciousExtensions = [
      '.exe', '.dll', '.bat', '.vbs', '.js', '.wsf', '.ps1', '.hta', '.scr',
      '.pif', '.reg', '.com', '.jar', '.msi'
    ];
    
    // Check each attachment
    for (const attachment of email.attachments) {
      // Check file extension
      const fileName = attachment.filename || attachment.name;
      if (fileName) {
        const extension = '.' + fileName.split('.').pop().toLowerCase();
        
        if (suspiciousExtensions.includes(extension)) {
          result.findings.push({
            type: 'suspicious_file_extension',
            value: fileName,
            extension: extension,
            severity: 80
          });
          
          result.suspiciousAttachments = true;
          result.suspiciousAttachmentCount++;
        }
      }
      
      // Check for known malicious hashes
      if (attachment.hash) {
        // In a real implementation, this would check against threat intelligence
        // For this example, we'll pretend a specific hash is known malicious
        if (attachment.hash === 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d') {
          result.findings.push({
            type: 'known_malicious_hash',
            value: attachment.hash,
            fileName: fileName,
            severity: 90
          });
          
          result.suspiciousAttachments = true;
          result.suspiciousAttachmentCount++;
        }
      }
    }
    
    return result;
  }

  /**
   * Analyze URLs in email
   * @param {Object} email - Email to analyze
   * @returns {Promise<Object>} URL analysis
   * @private
   */
  async _analyzeUrls(email) {
    // This would contain detailed URL analysis
    // Placeholder implementation
    const result = {
      findings: [],
      suspiciousUrls: false,
      totalUrls: email.urls ? email.urls.length : 0,
      suspiciousUrlCount: 0
    };
    
    // If no URLs, return empty analysis
    if (!email.urls || email.urls.length === 0) {
      return result;
    }
    
    // Check each URL
    for (const url of email.urls) {
      let urlString = url.url || url;
      if (!urlString) continue;
      
      // Check for URL shorteners
      const shortenerDomains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly'];
      if (shortenerDomains.some(domain => urlString.includes(domain))) {
        result.findings.push({
          type: 'url_shortener',
          value: urlString,
          severity: 50
        });
        
        result.suspiciousUrls = true;
        result.suspiciousUrlCount++;
      }
      
      // Check for lookalike domains
      if (email.sender) {
        const senderDomain = email.sender.split('@')[1];
        if (senderDomain && this._isLookalikeDomain(this._extractDomain(urlString), senderDomain)) {
          result.findings.push({
            type: 'lookalike_domain',
            value: urlString,
            originalDomain: senderDomain,
            severity: 85
          });
          
          result.suspiciousUrls = true;
          result.suspiciousUrlCount++;
        }
      }
      
      // Check for suspicious TLDs
      const suspiciousTlds = ['.xyz', '.top', '.club', '.work', '.info', '.click'];
      if (suspiciousTlds.some(tld => urlString.toLowerCase().endsWith(tld))) {
        result.findings.push({
          type: 'suspicious_tld',
          value: urlString,
          severity: 35
        });
        
        result.suspiciousUrls = true;
        result.suspiciousUrlCount++;
      }
    }
    
    return result;
  }

  /**
   * Extract a domain from a URL
   * @param {string} url - URL to extract domain from
   * @returns {string|null} Domain or null if not found
   * @private
   */
  _extractDomain(url) {
    try {
      // Simple domain extraction - in a real implementation this would be more robust
      let domain = url.replace(/^https?:\/\//, '').split('/')[0];
      return domain.toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Check if a domain is a lookalike of another domain
   * @param {string} domain - Domain to check
   * @param {string} originalDomain - Original domain
   * @returns {boolean} True if domain is a lookalike
   * @private
   */
  _isLookalikeDomain(domain, originalDomain) {
    if (!domain || !originalDomain) return false;
    
    // Check for typosquatting
    // Simple check for similarity - in a real implementation this would be more sophisticated
    const levenshteinDistance = (a, b) => {
      // Simple Levenshtein distance implementation
      const matrix = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill());
      
      for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
      for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
      
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      
      return matrix[a.length][b.length];
    };
    
    // Check if domains are similar but not identical
    const distance = levenshteinDistance(domain, originalDomain);
    const isSimilar = distance <= 2 && distance > 0; // Domain differs by 1-2 characters
    
    // Check for common homograph attacks (e.g., replacing 'o' with '0')
    const homographCheck1 = originalDomain.includes('o') && domain.includes('0');
    const homographCheck2 = originalDomain.includes('l') && domain.includes('1');
    
    return isSimilar || homographCheck1 || homographCheck2;
  }

  /**
   * Extract IOCs from email
   * @param {Object} email - Email to analyze
   * @returns {Promise<Array>} Extracted IOCs
   * @private
   */
  async _extractIOCs(email) {
    const iocs = [];
    
    // Extract URLs
    if (this._iocExtractionConfig.extractEmbeddedUrls && email.urls && email.urls.length > 0) {
      for (let i = 0; i < Math.min(email.urls.length, this._iocExtractionConfig.maxUrlsToExtract); i++) {
        const url = email.urls[i];
        const urlString = url.url || url;
        
        if (urlString) {
          iocs.push({
            type: 'url',
            value: urlString,
            source: 'email_body'
          });
          
          // Also extract domain as separate IOC
          const domain = this._extractDomain(urlString);
          if (domain) {
            iocs.push({
              type: 'domain',
              value: domain,
              source: 'url_extraction'
            });
          }
        }
      }
    }
    
    // Extract attachment hashes
    if (this._iocExtractionConfig.extractAttachmentHashes && 
        email.attachments && 
        email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        if (attachment.hash) {
          iocs.push({
            type: 'hash',
            value: attachment.hash,
            hashType: attachment.hashType || 'sha1',
            fileName: attachment.filename || attachment.name,
            source: 'email_attachment'
          });
        }
        
        // Add filename as IOC
        if (attachment.filename || attachment.name) {
          iocs.push({
            type: 'filename',
            value: attachment.filename || attachment.name,
            source: 'email_attachment'
          });
        }
      }
    }
    
    // Extract sender info
    if (this._iocExtractionConfig.extractSenderInfo && email.sender) {
      iocs.push({
        type: 'email-address',
        value: email.sender,
        source: 'email_sender'
      });
      
      // Extract domain from sender
      const senderDomain = email.sender.split('@')[1];
      if (senderDomain) {
        iocs.push({
          type: 'domain',
          value: senderDomain,
          source: 'email_sender'
        });
      }
    }
    
    // Extract IP addresses from headers
    if (email.headers && email.headers.receivedIp) {
      iocs.push({
        type: 'ip-address',
        value: email.headers.receivedIp,
        source: 'email_headers'
      });
    }
    
    return iocs;
  }

  /**
   * Categorize an email based on analysis
   * @param {Object} email - Email to categorize
   * @param {Object} analysis - Analysis results
   * @returns {string} Email category
   * @private
   */
  _categorizeEmail(email, analysis) {
    // Use raw alert category if available
    if (email.threatInfo && email.threatInfo.category) {
      return email.threatInfo.category;
    }
    
    // Determine category based on analysis findings
    
    // Check for business email compromise indicators
    if (analysis.headerAnalysis.suspiciousHeaders &&
        analysis.bodyAnalysis.containsUrgencyIndicators &&
        !analysis.attachmentAnalysis.suspiciousAttachments &&
        (!email.urls || email.urls.length === 0)) {
      return EMAIL_THREAT_CATEGORIES.BEC;
    }
    
    // Check for malware indicators
    if (analysis.attachmentAnalysis.suspiciousAttachments) {
      return EMAIL_THREAT_CATEGORIES.MALWARE;
    }
    
    // Check for phishing indicators
    if (analysis.urlAnalysis.suspiciousUrls &&
        (analysis.bodyAnalysis.containsPhishingLanguage || 
         analysis.bodyAnalysis.containsUrgencyIndicators)) {
      return EMAIL_THREAT_CATEGORIES.PHISHING;
    }
    
    // Check for spear phishing
    if (this._isRecipientVIP(email.recipient) &&
        (analysis.urlAnalysis.suspiciousUrls || 
         analysis.headerAnalysis.suspiciousHeaders)) {
      return EMAIL_THREAT_CATEGORIES.SPEAR_PHISHING;
    }
    
    // Default to social engineering
    if (analysis.bodyAnalysis.containsPhishingLanguage) {
      return EMAIL_THREAT_CATEGORIES.SOCIAL_ENGINEERING;
    }
    
    // Fallback to generic phishing
    return EMAIL_THREAT_CATEGORIES.PHISHING;
  }

  /**
   * Calculate the severity of a suspicious email
   * @param {Object} email - Email to evaluate
   * @param {Object} analysis - Analysis results
   * @returns {number} Severity (0-100)
   * @private
   */
  _calculateEmailSeverity(email, analysis) {
    // Start with severity provided by email security tool if available
    let severity = email.threatInfo && typeof email.threatInfo.score === 'number' 
      ? email.threatInfo.score
      : 40; // Default starting severity
    
    // Adjust based on authentication failures
    if (analysis.headerAnalysis.suspiciousHeaders) {
      severity += 15;
    }
    
    // Adjust based on suspicious attachments
    if (analysis.attachmentAnalysis.suspiciousAttachments) {
      severity += 25;
    }
    
    // Adjust based on suspicious URLs
    if (analysis.urlAnalysis.suspiciousUrls) {
      severity += 20;
    }
    
    // Adjust based on phishing language
    if (analysis.bodyAnalysis.containsPhishingLanguage) {
      severity += 10;
    }
    
    // Adjust based on urgency indicators
    if (analysis.bodyAnalysis.containsUrgencyIndicators) {
      severity += 5;
    }
    
    // Adjust for VIP targets
    if (this._isRecipientVIP(email.recipient)) {
      severity += 15;
    }
    
    // Adjust based on specific findings
    const allFindings = [
      ...(analysis.headerAnalysis?.findings || []),
      ...(analysis.bodyAnalysis?.findings || []),
      ...(analysis.attachmentAnalysis?.findings || []),
      ...(analysis.urlAnalysis?.findings || [])
    ];
    
    // Find the maximum severity from findings
    if (allFindings.length > 0) {
      const maxFindingSeverity = Math.max(...allFindings.map(f => f.severity || 0));
      severity = Math.max(severity, maxFindingSeverity);
    }
    
    // Ensure severity is within bounds
    return Math.min(Math.max(severity, 0), 100);
  }

  /**
   * Calculate confidence in email analysis
   * @param {Object} email - Email being analyzed
   * @param {Object} analysis - Analysis results
   * @returns {number} Confidence (0-100)
   * @private
   */
  _calculateConfidence(email, analysis) {
    // Start with a base confidence
    let confidence = 70; // Default starting confidence
    
    // Multiple indicators increase confidence
    const indicators = [];
    
    if (analysis.headerAnalysis.suspiciousHeaders) indicators.push('suspicious_headers');
    if (analysis.bodyAnalysis.containsPhishingLanguage) indicators.push('phishing_language');
    if (analysis.bodyAnalysis.containsUrgencyIndicators) indicators.push('urgency_indicators');
    if (analysis.attachmentAnalysis.suspiciousAttachments) indicators.push('suspicious_attachments');
    if (analysis.urlAnalysis.suspiciousUrls) indicators.push('suspicious_urls');
    
    // Increase confidence based on number of indicators
    confidence += indicators.length * 5;
    
    // Known malicious indicators significantly increase confidence
    const hasMaliciousIndicator = analysis.attachmentAnalysis.findings?.some(f => 
      f.type === 'known_malicious_hash'
    );
    
    if (hasMaliciousIndicator) {
      confidence += 20;
    }
    
    // Authentication failures increase confidence
    if (!analysis.headerAnalysis.authenticationPassed) {
      confidence += 10;
    }
    
    // Lack of indicators reduces confidence
    if (indicators.length === 0) {
      confidence -= 30;
    }
    
    // Ensure confidence is within bounds
    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Check if email is likely a false positive
   * @param {Object} email - Email to check
   * @param {Object} analysis - Analysis results
   * @returns {Promise<boolean>} True if likely a false positive
   * @private
   */
  async _checkEmailFalsePositive(email, analysis) {
    // Known trusted senders are not false positives
    if (await this._isKnownTrustedSender(email.sender)) {
      return false;
    }
    
    // If there are no suspicious indicators, likely a false positive
    if (!analysis.headerAnalysis.suspiciousHeaders &&
        !analysis.bodyAnalysis.containsPhishingLanguage &&
        !analysis.bodyAnalysis.containsUrgencyIndicators &&
        !analysis.attachmentAnalysis.suspiciousAttachments &&
        !analysis.urlAnalysis.suspiciousUrls) {
      return true;
    }
    
    // If authentication passes and only minimal indicators, likely false positive
    if (analysis.headerAnalysis.authenticationPassed && 
        !analysis.attachmentAnalysis.suspiciousAttachments &&
        (!analysis.urlAnalysis.suspiciousUrls || analysis.urlAnalysis.suspiciousUrlCount === 0)) {
      return true;
    }
    
    // Not a false positive
    return false;
  }

  /**
   * Check if a sender is a known trusted sender
   * @param {string} sender - Email sender
   * @returns {Promise<boolean>} True if a known trusted sender
   * @private
   */
  async _isKnownTrustedSender(sender) {
    // In a real implementation, this would check against a database of trusted senders
    // Placeholder implementation
    const trustedDomains = [
      'company.com',
      'trusted-partner.com',
      'vendor.com'
    ];
    
    if (!sender) return false;
    
    const domain = sender.split('@')[1];
    if (!domain) return false;
    
    return trustedDomains.includes(domain.toLowerCase());
  }

  /**
   * Generate containment recommendations
   * @param {Object} email - Email being analyzed
   * @param {Object} analysis - Analysis results
   * @returns {Array} Containment recommendations
   * @private
   */
  _generateContainmentRecommendations(email, analysis) {
    const recommendations = [];
    
    // Always recommend quarantining the email
    recommendations.push({
      type: 'quarantine_email',
      reason: `Suspicious email from ${email.sender}`,
      automatable: true,
      priority: 'high'
    });
    
    // Recommend blocking sender if authentication failed or known bad
    if (!analysis.headerAnalysis.authenticationPassed || 
        analysis.attachmentAnalysis.findings?.some(f => f.type === 'known_malicious_hash')) {
      recommendations.push({
        type: 'block_sender',
        target: email.sender,
        reason: 'Sender failed authentication or sent malicious content',
        automatable: true, 
        priority: 'high'
      });
    }
    
    // Recommend blocking URLs if suspicious
    if (analysis.urlAnalysis.suspiciousUrls) {
      for (const finding of analysis.urlAnalysis.findings) {
        recommendations.push({
          type: 'block_url',
          target: finding.value,
          reason: `Suspicious URL: ${finding.type}`,
          automatable: true,
          priority: 'high'
        });
      }
    }
    
    // Recommend blocking attachment hashes if suspicious
    if (analysis.attachmentAnalysis.suspiciousAttachments) {
      for (const finding of analysis.attachmentAnalysis.findings) {
        recommendations.push({
          type: 'block_hash',
          target: finding.value || finding.hash,
          reason: `Suspicious attachment: ${finding.type}`,
          automatable: true,
          priority: 'high'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Determine which L2 agent should handle this if escalated
   * @param {Object} analysis - Analysis results
   * @returns {string} Recommended escalation target
   * @private
   */
  _determineEscalationTarget(analysis) {
    // Default to incident response
    let target = 'incident_response_agent';
    
    // For malware, escalate to threat intelligence
    if (analysis.category === EMAIL_THREAT_CATEGORIES.MALWARE) {
      target = 'threat_intelligence_agent';
    }
    
    // For business email compromise, escalate to incident response
    if (analysis.category === EMAIL_THREAT_CATEGORIES.BEC) {
      target = 'incident_response_agent';
    }
    
    return target;
  }

  /**
   * Check if email should be automatically contained
   * @param {Object} triageResult - Email triage result
   * @returns {boolean} True if automatic containment should be performed
   * @private
   */
  _shouldAutomaticallyContain(triageResult) {
    // Don't contain if auto containment is disabled
    if (!this._containmentConfig.enableAutoContainment) {
      return false;
    }
    
    // Don't contain if it's a false positive
    if (triageResult.isFalsePositive) {
      return false;
    }
    
    // Check severity and confidence thresholds
    return triageResult.severity >= this._containmentConfig.minSeverityForContainment &&
           triageResult.confidence >= this._containmentConfig.minConfidenceForContainment;
  }

  /**
   * Execute containment actions
   * @param {Object} email - Email to contain
   * @param {Object} triageResult - Triage result
   * @returns {Promise<Array>} Executed actions
   * @private
   */
  async _executeContainment(email, triageResult) {
    try {
      this.log.info(`Executing automatic containment for email: ${email.id}`);
      
      const executedActions = [];
      
      // Get containment recommendations
      const recommendations = triageResult.containmentRecommendations || [];
      
      // Filter to only include enabled and automatable actions
      const actionsToExecute = recommendations.filter(rec => 
        rec.automatable && 
        this._containmentConfig.containmentActions.includes(rec.type)
      );
      
      // Execute each action
      for (const action of actionsToExecute) {
        try {
          const result = await this._executeContainmentAction(email.source, action);
          
          executedActions.push({
            ...action,
            status: result.success ? 'success' : 'failure',
            message: result.message,
            timestamp: Date.now()
          });
          
          this.log.info(
            `Containment action ${action.type} for ${email.id}: ${result.success ? 'Successful' : 'Failed'}`
          );
        } catch (error) {
          this.log.error(`Error executing containment action: ${action.type}`, error);
          
          executedActions.push({
            ...action,
            status: 'error',
            message: error.message,
            timestamp: Date.now()
          });
        }
      }
      
      return executedActions;
    } catch (error) {
      this.log.error(`Error executing containment for email: ${email.id}`, error);
      throw error;
    }
  }

  /**
   * Execute a specific containment action
   * @param {string} source - Email source system
   * @param {Object} action - Action to execute
   * @returns {Promise<Object>} Action result
   * @private
   */
  async _executeContainmentAction(source, action) {
    // In a real implementation, this would integrate with email security tools
    // Placeholder implementation
    return {
      success: true,
      message: `Simulated containment action: ${action.type} on target: ${action.target}`
    };
  }

  /**
   * Generate a report for an analyzed email
   * @param {Object} triageResult - Triage result
   * @param {Object} email - Original email
   * @param {Array} containmentActions - Executed containment actions
   * @returns {Promise<Object>} Report
   */
  async generateEmailReport(triageResult, email, containmentActions) {
    try {
      this.log.info(`Generating report for email: ${email.id}`);
      
      // Build a comprehensive report
      const report = {
        id: utils.encryption.generateId(),
        type: 'email_analysis_report',
        emailId: email.id,
        emailSource: email.source || 'unknown',
        sender: email.sender,
        recipient: email.recipient,
        subject: email.subject,
        receivedTime: email.receivedTime,
        category: triageResult.category,
        severity: triageResult.severity,
        confidence: triageResult.confidence,
        isFalsePositive: triageResult.isFalsePositive || false,
        summary: `Analysis of suspicious ${triageResult.category} email from ${email.sender}`,
        findings: [
          ...(triageResult.headerAnalysis?.findings || []),
          ...(triageResult.bodyAnalysis?.findings || []),
          ...(triageResult.attachmentAnalysis?.findings || []),
          ...(triageResult.urlAnalysis?.findings || [])
        ],
        iocs: triageResult.iocs || [],
        containmentRecommendations: triageResult.containmentRecommendations || [],
        containmentActions: containmentActions || [],
        escalationRecommendation: triageResult.recommendedEscalationTarget,
        timestamp: Date.now(),
        generatedBy: {
          agentId: this.id,
          agentName: this.name,
          agentType: this.type
        }
      };
      
      return report;
    } catch (error) {
      this.log.error(`Error generating email report for ${email.id}`, error);
      throw error;
    }
  }
}

module.exports = EmailTriageAgent;
