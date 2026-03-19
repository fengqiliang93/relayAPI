import type { I18nMessages } from "@/i18n/types";

export const en: I18nMessages = {
  appTitle: "API Verity Lab",
  appSubtitle: "Stop the Bait-and-Switch. Verify the Truth.",
  securityNotice:
    "For account safety, use a test API key whenever possible. This tool is open-source on GitHub and runs with client-side logic only. Your API key is not uploaded or stored, and history stays in your browser.",
  configSectionTitle: "API Configuration",

  validationEndpointRequired: "Please enter an API endpoint URL",
  validationApiKeyRequired: "Please enter your API key",
  validationModelRequired: "Please select a target model",

  turnstileMissingSiteKey: "Turnstile site key is missing",
  turnstileCompleteFirst: "Please complete human verification first",
  humanVerificationFailed: "Human verification failed",
  humanVerificationFailedDetail: "Please complete verification again and retry.",

  detectionComplete: "Detection complete",
  detectionFailed: "Detection failed",
  detectionFailedDetail: "The request failed unexpectedly. Please try again.",

  upstreamPrefix: "Upstream API response:",
  systemPrefix: "System message:",

  actionStartDetection: "Start Detection",
  actionScanning: "Scanning...",

  resultTitle: "Detection Result",
  reportIdPrefix: "ID",

  historyTitle: "Recent History",
  historyEmptyTitle: "System Ready",
  historyEmptyDescription: "Detection results will appear here",
  historyExport: "Export",
  historyTimestamp: "Timestamp",
  historyModel: "Model",
  historyEndpoint: "Endpoint",
  historyScore: "Score",
  historyStatus: "Status",

  toastViewingReport: "Viewing report",
  toastExportComingSoon: "Export coming soon",

  verifyModalTitle: "Complete Human Verification",
  verifyModalDescription: "Detection will start automatically once verification succeeds.",
  verifyModalCancel: "Cancel",
  verifyModalConfirm: "Verify",

  apiEndpointLabel: "API Endpoint URL",
  apiEndpointPlaceholder: "https://api.anthropic.com",
  apiKeyLabel: "API Key",
  apiKeyPlaceholder: "sk-...",
  apiNoProvidersFound: "No providers found",
  apiActionCopy: "Copy",
  apiActionClear: "Clear",

  modelTargetLabel: "Target Model",

  overlayAnalyzing: "Analyzing endpoint...",

  metricLatency: "Latency",
  metricTokensPerSecond: "Tokens/s",
  metricInputTokens: "Input Tokens",
  metricOutputTokens: "Output Tokens",

  scoreLabelAuthentic: "Authentic",
  scoreLabelMostlyReliable: "Mostly Reliable",
  scoreLabelSuspicious: "Suspicious",
  scoreLabelFake: "Likely Fake",

  checkProtocolName: "Protocol Consistency",
  checkProtocolStable: "Stable",
  checkProtocolPartial: "Partial",
  checkProtocolWeak: "Weak",

  checkResponseStructureName: "Response Structure",
  checkResponseJsonValid: "JSON Valid",
  checkResponseSinglePrompt: "Single Prompt",
  checkResponseInvalid: "Invalid",

  checkKnowledgeCutoffName: "Knowledge Cutoff",
  checkPass: "Pass",
  checkFail: "Fail",

  checkIdentityName: "Identity Verification",
  checkIdentityConsistent: "Consistent",
  checkIdentityMismatch: "Mismatch",

  checkThinkingChainName: "Thinking Chain",
  checkThinkingPresent: "Present",
  checkThinkingNotFound: "Not Found",

  checkSignatureName: "Signature Fingerprint",
  checkSignatureLengthOk: "Length OK",
  checkSignatureShort: "Short",
  checkSignatureMissing: "Missing",

  probeRequestFailedTitle: "Request failed",
  probeRequestFailedDetail: "The verification service is temporarily unavailable. Please try again later.",
  probeInvalidResponseTitle: "Invalid response format",
  upstreamNoErrorDetail: "Upstream API did not provide an error message.",

  footerBrand: "API Verity Lab",
  footerEmail: "Email",
  footerRights: "All rights reserved.",

  notFoundDescription: "Oops! Page not found",
  notFoundBackHome: "Return to Home",
};
