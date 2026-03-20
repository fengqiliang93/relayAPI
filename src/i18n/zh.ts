import type { I18nMessages } from "@/i18n/types";

export const zh: I18nMessages = {
  seoTitle: "API中转站鉴定所 | 检测 Claude / OpenAI API 中转站真假",
  seoDescription:
    "免费检测 API 中转站是否存在协议不一致、知识异常、身份错配与签名缺失等问题，帮助你快速识别 Claude、OpenAI 等接口是否可靠。",
  seoOgTitle: "API中转站鉴定所 | 检测 Claude / OpenAI API 中转站真假",
  seoOgDescription:
    "快速检测 API 中转站是否靠谱，识别协议一致性、知识问答、身份一致性与签名指纹等关键风险。",
  appTitle: "Hvoy API中转站鉴定所",
  appSubtitle: "拒绝挂羊头卖狗肉，快速识别中转站真假",
  securityNotice:
    "为保障账户安全，建议优先使用测试专用 API Key。本工具已在 GitHub 开源，采用纯前端处理逻辑，不会上传或存储你的 API Key。检测历史仅保存在当前浏览器本地。",
  configSectionTitle: "接口配置",
  introSectionTitle: "什么是 API 中转站鉴定",
  introSectionBody1:
    "这个页面用于帮助你快速判断一个 API 中转站到底是在稳定转发真实模型接口，还是存在包装、伪装、协议不一致或者能力掺水等情况。我们会通过多轮探测请求，对接口返回结构、知识表现、身份一致性、思维链痕迹和签名指纹进行交叉判断。",
  introSectionBody2:
    "它不是法律意义上的审计报告，也不承诺百分之百准确，但可以在你购买、集成或长期使用某个中转站前，先做一次低成本的技术核验，减少踩坑风险。",
  faqSectionTitle: "常见问题",
  faqQuestion1: "什么是 API 中转站？",
  faqAnswer1:
    "API 中转站通常位于你和上游模型服务之间，负责转发请求、统一计费、切换渠道，或者把多个模型接口包装成同一种调用方式。它的价值在于接入方便、价格灵活、可做聚合与分发，但同时也意味着你并不是直接面对原始模型提供商。",
  faqQuestion2: "API 中转站有什么样的隐患？",
  faqAnswer2:
    "常见风险包括返回协议与官方不一致、模型身份被替换、知识表现异常、响应内容被二次加工、日志与密钥处理不透明，以及服务稳定性依赖单一上游。一些站点还可能在宣传中高配低卖，表面写的是某个模型，实际转发到的是别的能力层级。",
  faqQuestion3: "我们是怎么识别的？",
  faqAnswer3:
    "我们会向目标接口发送结构化探测请求，并结合返回协议、响应结构、知识问答结果、身份一致性、思维链痕迹和签名指纹等维度综合评分。这样做不是只看单一字段，而是尽量从多种技术特征交叉验证，帮助你更快发现可疑中转站。",
  faqQuestion4: "有推荐的中转站吗？",
  faqAnswer4:
    "我自己近段时间尝试了很多中转站，把使用记录都放在这个文档里，可以参考",
  faqAnswer4LinkLabel: "API中转站评测",

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
  historyClear: "清除缓存",
  historyTimestamp: "时间",
  historyModel: "模型",
  historyEndpoint: "接口",
  historyScore: "评分",
  historyStatus: "状态",

  toastViewingReport: "正在查看报告",
  toastExportComingSoon: "导出功能即将上线",
  toastHistoryCleared: "历史缓存已清除",

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
