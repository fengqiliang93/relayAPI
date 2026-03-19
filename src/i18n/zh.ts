import type { I18nMessages } from "@/i18n/types";

export const zh: I18nMessages = {
  appTitle: "API 中转站鉴定所",
  appSubtitle: "拒绝挂羊头卖狗肉，快速识别中转站真假模型。",
  securityNotice:
    "为保障账户安全，建议优先使用测试专用 API Key。本工具已在 GitHub 开源，采用纯前端处理逻辑，不会上传或存储你的 API Key。检测历史仅保存在当前浏览器本地。",
  configSectionTitle: "接口配置",

  validationEndpointRequired: "请输入 API 接口地址",
  validationApiKeyRequired: "请输入 API Key",
  validationModelRequired: "请选择目标模型",

  turnstileMissingSiteKey: "缺少 Turnstile 站点密钥",
  turnstileCompleteFirst: "请先完成人机验证",
  humanVerificationFailed: "人机验证失败",
  humanVerificationFailedDetail: "请重新完成人机验证后再试。",

  detectionComplete: "检测完成",
  detectionFailed: "检测失败",
  detectionFailedDetail: "请求过程中出现异常，请稍后重试。",

  upstreamPrefix: "API 站点返回：",
  systemPrefix: "系统提示：",

  actionStartDetection: "开始检测",
  actionScanning: "检测中...",

  resultTitle: "检测结果",
  reportIdPrefix: "编号",

  historyTitle: "最近历史",
  historyEmptyTitle: "准备就绪",
  historyEmptyDescription: "检测结果会显示在这里",
  historyExport: "导出",
  historyTimestamp: "时间",
  historyModel: "模型",
  historyEndpoint: "接口",
  historyScore: "评分",
  historyStatus: "状态",

  toastViewingReport: "正在查看报告",
  toastExportComingSoon: "导出功能即将上线",

  verifyModalTitle: "请完成人机验证",
  verifyModalDescription: "验证通过后将自动开始检测。",
  verifyModalCancel: "取消",
  verifyModalConfirm: "验证",

  apiEndpointLabel: "API 接口地址",
  apiEndpointPlaceholder: "https://api.anthropic.com",
  apiKeyLabel: "API Key",
  apiKeyPlaceholder: "sk-...",
  apiNoProvidersFound: "未找到匹配的服务商",
  apiActionCopy: "复制",
  apiActionClear: "清空",

  modelTargetLabel: "目标模型",

  overlayAnalyzing: "正在分析接口...",

  metricLatency: "延迟",
  metricTokensPerSecond: "Tokens/秒",
  metricInputTokens: "输入 Tokens",
  metricOutputTokens: "输出 Tokens",

  scoreLabelAuthentic: "可信",
  scoreLabelMostlyReliable: "基本可信",
  scoreLabelSuspicious: "疑似掺水",
  scoreLabelFake: "可疑",

  checkProtocolName: "协议一致性",
  checkProtocolStable: "稳定",
  checkProtocolPartial: "部分匹配",
  checkProtocolWeak: "较弱",

  checkResponseStructureName: "响应结构",
  checkResponseJsonValid: "JSON 有效",
  checkResponseSinglePrompt: "仅单轮",
  checkResponseInvalid: "结构异常",

  checkKnowledgeCutoffName: "知识问答校验",
  checkPass: "通过",
  checkFail: "失败",

  checkIdentityName: "身份一致性",
  checkIdentityConsistent: "一致",
  checkIdentityMismatch: "不一致",

  checkThinkingChainName: "思维链痕迹",
  checkThinkingPresent: "已发现",
  checkThinkingNotFound: "未发现",

  checkSignatureName: "签名指纹",
  checkSignatureLengthOk: "长度达标",
  checkSignatureShort: "长度偏短",
  checkSignatureMissing: "未发现",

  probeRequestFailedTitle: "接口请求失败",
  probeRequestFailedDetail: "检测服务暂时不可用，请稍后重试。",
  probeInvalidResponseTitle: "接口返回格式异常",
  upstreamNoErrorDetail: "上游 API 未返回错误详情。",

  footerBrand: "API Verity Lab",
  footerEmail: "邮箱",
  footerRights: "保留所有权利。",

  notFoundDescription: "抱歉，页面不存在",
  notFoundBackHome: "返回首页",
};
