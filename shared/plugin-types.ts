// ---- plugin:life_os_a2ui_ai_chat_1 ----
// ============================================================
// 插件 life_os_a2ui_ai_chat_1 (Life-OS平台a2ui悬浮AI聊天窗生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface LifeOsA2uiAiChatOneInput {
  /** Life-OS平台当前上下文信息，包括已加载插件、可用功能、用户操作历史等 */
  system_context?: string;
  /** 用户在聊天窗输入的自然语言问题或指令 */
  user_question: string;
}

/**
 * capabilityClient.load('life_os_a2ui_ai_chat_1').callStream<LifeOsA2uiAiChatOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 LifeOsA2uiAiChatOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface LifeOsA2uiAiChatOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:life_os_a2ui_ai_chat_1 ----
