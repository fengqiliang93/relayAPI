export type Language = "zh" | "en";

export interface I18nMessages {
  appTitle: string;
  appSubtitle: string;
  securityNotice: string;
  configSectionTitle: string;

  validationEndpointRequired: string;
  validationApiKeyRequired: string;
  validationModelRequired: string;

  turnstileMissingSiteKey: string;
  turnstileCompleteFirst: string;
  humanVerificationFailed: string;
  humanVerificationFailedDetail: string;

  detectionComplete: string;
  detectionFailed: string;
  detectionFailedDetail: string;

  upstreamPrefix: string;
  systemPrefix: string;

  actionStartDetection: string;
  actionScanning: string;

  resultTitle: string;
  reportIdPrefix: string;

  historyTitle: string;
  historyEmptyTitle: string;
  historyEmptyDescription: string;
  historyExport: string;
  historyTimestamp: string;
  historyModel: string;
  historyEndpoint: string;
  historyScore: string;
  historyStatus: string;

  toastViewingReport: string;
  toastExportComingSoon: string;

  verifyModalTitle: string;
  verifyModalDescription: string;
  verifyModalCancel: string;
  verifyModalConfirm: string;

  apiEndpointLabel: string;
  apiEndpointPlaceholder: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  apiNoProvidersFound: string;
  apiActionCopy: string;
  apiActionClear: string;

  modelTargetLabel: string;

  overlayAnalyzing: string;

  metricLatency: string;
  metricTokensPerSecond: string;
  metricInputTokens: string;
  metricOutputTokens: string;

  scoreLabelAuthentic: string;
  scoreLabelMostlyReliable: string;
  scoreLabelSuspicious: string;
  scoreLabelFake: string;

  checkProtocolName: string;
  checkProtocolStable: string;
  checkProtocolPartial: string;
  checkProtocolWeak: string;

  checkResponseStructureName: string;
  checkResponseJsonValid: string;
  checkResponseSinglePrompt: string;
  checkResponseInvalid: string;

  checkKnowledgeCutoffName: string;
  checkPass: string;
  checkFail: string;

  checkIdentityName: string;
  checkIdentityConsistent: string;
  checkIdentityMismatch: string;

  checkThinkingChainName: string;
  checkThinkingPresent: string;
  checkThinkingNotFound: string;

  checkSignatureName: string;
  checkSignatureLengthOk: string;
  checkSignatureShort: string;
  checkSignatureMissing: string;

  probeRequestFailedTitle: string;
  probeRequestFailedDetail: string;
  probeInvalidResponseTitle: string;
  upstreamNoErrorDetail: string;

  footerBrand: string;
  footerEmail: string;
  footerRights: string;

  notFoundDescription: string;
  notFoundBackHome: string;
}
