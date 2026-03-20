import type { I18nMessages } from "@/i18n/types";

export const en: I18nMessages = {
  seoTitle: "API Relay Verifier | Check Claude and OpenAI Relay Endpoints",
  seoDescription:
    "Verify whether an API relay endpoint is trustworthy by checking protocol consistency, knowledge behavior, identity signals, and signature fingerprints before you integrate it.",
  seoOgTitle: "API Relay Verifier | Check Claude and OpenAI Relay Endpoints",
  seoOgDescription:
    "Quickly evaluate API relay services for protocol mismatch, identity issues, suspicious knowledge behavior, and missing signature traces.",
  appTitle: "Hvoy API Verity Lab",
  appSubtitle: "Stop the Bait-and-Switch. Verify the Truth.",
  securityNotice:
    "For account safety, use a test API key whenever possible. This tool is open-source on GitHub and runs with client-side logic only. Your API key is not uploaded or stored, and history stays in your browser.",
  configSectionTitle: "API Configuration",
  introSectionTitle: "What This API Relay Check Does",
  introSectionBody1:
    "This page helps you quickly judge whether an API relay is forwarding a real upstream model reliably or whether it shows signs of wrapping, impersonation, protocol mismatch, or watered-down capability. We send controlled probe requests and compare response structure, knowledge behavior, identity consistency, thinking traces, and signature fingerprints.",
  introSectionBody2:
    "It is not a formal audit and it does not guarantee perfect accuracy, but it gives you a low-cost technical sanity check before you buy, integrate, or rely on a relay service for production traffic.",
  faqSectionTitle: "FAQ",
  faqQuestion1: "What is an API relay service?",
  faqAnswer1:
    "An API relay sits between you and an upstream model provider. It forwards requests, normalizes billing, switches providers, or wraps multiple model backends behind one interface. That can be convenient, but it also means you are no longer talking directly to the original model vendor.",
  faqQuestion2: "What risks can an API relay introduce?",
  faqAnswer2:
    "Common risks include protocol mismatches, identity substitution, abnormal knowledge behavior, modified responses, unclear logging or key handling, and uptime that depends on a hidden upstream. Some services also market one model name while routing traffic to a weaker or different backend.",
  faqQuestion3: "How do we detect suspicious relays?",
  faqAnswer3:
    "We send structured probe requests and score the results across protocol consistency, response structure, knowledge answers, identity consistency, thinking traces, and signature fingerprints. Instead of trusting a single field, the tool cross-checks multiple technical signals to surface suspicious relay behavior faster.",
  faqQuestion4: "Any recommended relay services?",
  faqAnswer4:
    "I have tried many relay services recently and recorded my usage notes in this document. You can refer to",
  faqAnswer4LinkLabel: "the API review document",

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
  historyClear: "Clear Cache",
  historyTimestamp: "Timestamp",
  historyModel: "Model",
  historyEndpoint: "Endpoint",
  historyScore: "Score",
  historyStatus: "Status",

  toastViewingReport: "Viewing report",
  toastExportComingSoon: "Export coming soon",
  toastHistoryCleared: "History cache cleared",

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
