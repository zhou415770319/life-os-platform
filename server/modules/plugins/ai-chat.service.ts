import { Inject, Injectable, Logger } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';
import { LocalCapabilityService } from '../../platform-local/local-capability.service';
import { PluginMethodRegistry } from './plugin-method.registry';
import { AiChatHistoryService } from './ai-chat-history.service';
import { InsightsService } from '@server/modules/insights/insights.service';
import { TasksService } from '@server/modules/tasks/tasks.service';
import type {
  AiChatRequest,
  AiChatResponse,
  PluginMethod,
  PreflightCheckStep,
  AiChatSession,
  AiChatSessionMessage,
  AiMemoryItem,
  ListResponse,
} from '@shared/api.interface';

interface SimpleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const TOOL_CALL_START = '<<<TOOL_CALL>>>';
const TOOL_CALL_END = '<<<END>>>';

interface ParsedToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @Inject(LocalCapabilityService)
    private readonly capabilityService: LocalCapabilityService,
    private readonly methodRegistry: PluginMethodRegistry,
    private readonly historyService: AiChatHistoryService,
    private readonly insightsService: InsightsService,
    private readonly tasksService: TasksService,
  ) {}

  // ===== AI 长期记忆 =====
  private readonly memoryStore = new JsonStore<AiMemoryItem>('ai-memory.json');
  listMemories(): { items: AiMemoryItem[]; total: number } {
    const rows = this.memoryStore.findAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { items: rows, total: rows.length };
  }

  addMemory(content: string, category: AiMemoryItem['category']): AiMemoryItem {
    const now = new Date().toISOString();
    const item: AiMemoryItem = {
      id: crypto.randomUUID(),
      content: content.trim(),
      category: category ?? 'other',
      createdAt: now,
      updatedAt: now,
    };
    return this.memoryStore.create(item);
  }

  deleteMemory(id: string): { success: boolean } {
    const removed = this.memoryStore.remove(id);
    return { success: !!removed };
  }

  /** 构建长期记忆文本（注入 system prompt） */
  private buildMemoryBlock(): string {
    const rows = this.memoryStore.findAll();
    if (rows.length === 0) return '';
    const lines = rows.map((m) => `- ${m.content}`).join('\n');
    return `## 关于用户的长期记忆\n以下是你在过往对话中记住的关于用户的重要信息，回答时请自然运用（不要提及"记忆"二字）：\n${lines}`;
  }

  /** 构建数据快照（供深度助手参考） */
  async buildDataSnapshot(): Promise<Record<string, unknown>> {
    const summary = await this.insightsService.getSummary();
    const tasks = await this.tasksService.findAll({ page: 1, pageSize: 20 });

    const habitLines = summary.habitStats
      .map((h) => `- ${h.icon ?? ''} ${h.name}：累计 ${h.totalCheckIns} 次，连续 ${h.streakCount} 天`)
      .join('\n');

    const blackholeLines =
      summary.blackholeByCategory.length > 0
        ? summary.blackholeByCategory
            .map((c) => {
              const label: Record<string, string> = {
                idle: '发呆',
                shortvideo: '刷短视频',
                gossip: '八卦闲聊',
                other: '其他',
              };
              return `${label[c.category] ?? c.category} ${c.minutes} 分钟`;
            })
            .join('、')
        : '无';

    const goalLines =
      summary.goalStats.length > 0
        ? summary.goalStats
            .map((g) => `- ${g.title}（进度 ${g.progress}%）`)
            .join('\n')
        : '无进行中目标';

    const openTasks = tasks.items.filter((t) => t.status !== 'done' && t.status !== 'archived');

    return {
      date: summary.todayStr,
      habits: habitLines || '暂无习惯',
      todayCheckIns: summary.todayCheckIns,
      pomodoro: `今日 ${summary.pomodoroToday} 分钟，累计 ${summary.pomodoroTotal.minutes} 分钟（${summary.pomodoroTotal.count} 次）`,
      timeWasted: `${summary.blackholeToday} 分钟（今日） / ${summary.blackholeTotal} 分钟（累计：${blackholeLines}）`,
      goals: goalLines,
      openTasks: openTasks.length > 0 ? openTasks.map((t) => `- ${t.title}`).join('\n') : '暂无待办任务',
    };
  }

  /** 构建深度上下文文本（注入 system prompt） */
  async buildDeepContextText(): Promise<string> {
    try {
      const snapshot = await this.buildDataSnapshot();
      return [
        '## 用户实时数据（仅供参考，若用户询问状态/分析/建议，请基于以下数据回答）',
        `今天日期：${snapshot.date}`,
        `今日习惯打卡：${snapshot.todayCheckIns} 次`,
        `习惯列表：\n${snapshot.habits}`,
        `番茄专注：${snapshot.pomodoro}`,
        `浪费时间：${snapshot.timeWasted}`,
        `目标进度：\n${snapshot.goals}`,
        `待办任务：\n${snapshot.openTasks}`,
        '注意：以上是用户当前的真实数据。回答时自然引用数据，不要暴露原始 JSON 结构。',
      ].join('\n');
    } catch (err) {
      this.logger.warn(`Build deep context failed: ${String(err)}`);
      return '';
    }
  }

  async chat(dto: AiChatRequest, userId: string): Promise<AiChatResponse> {
    const lastUserMessage = dto.messages[dto.messages.length - 1]?.content ?? '';
    const sessionId = await this.historyService.ensureSession(
      dto.sessionId,
      userId,
      lastUserMessage,
    );

    await this.historyService.saveMessage({
      sessionId,
      role: 'user',
      content: lastUserMessage,
      userId,
    });

    const { items: enabledMethods } = await this.methodRegistry.getAvailableMethods();
    const allMethods = this.methodRegistry.getAllMethods();
    const basePrompt = this.buildSystemPrompt(allMethods, enabledMethods);

    // AI 深度助手：注入长期记忆 + 实时数据快照
    const memoryBlock = this.buildMemoryBlock();
    const deepBlock = dto.deepMode ? await this.buildDeepContextText() : '';
    const systemPrompt = [basePrompt, memoryBlock, deepBlock].filter(Boolean).join('\n\n');

    const userQuestion = this.buildUserQuestion(dto.messages);

    const firstTurn = await this.callAiTextGenerate(systemPrompt, userQuestion);
    const toolCall = this.parseToolCall(firstTurn);

    if (!toolCall) {
      const response: AiChatResponse = {
        reply: firstTurn,
        toolCalls: [],
        needsMoreInfo: false,
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: firstTurn,
        toolCalls: [],
        userId,
      });
      return response;
    }

    const preflight = await this.methodRegistry.preFlightCheck(
      toolCall.name,
      toolCall.parameters,
    );

    if (!preflight.pluginEnabled) {
      const pluginName = preflight.pluginName;
      const methodName = toolCall.name;
      const reply = `⚠️ **能力预检未通过**

检测到你想要使用「${pluginName}」的功能，但该插件**尚未启用**。

**检测到的操作：** ${methodName}

你可以通过以下方式启用：
1. 到「系统设置 → 插件管理」中启用「${pluginName}」
2. 直接对我说「启用${pluginName}插件」

启用后再试一次就可以啦 ✨`;
      const response: AiChatResponse = {
        reply,
        toolCalls: [],
        needsMoreInfo: false,
        preflightChecks: preflight.steps,
        disabledPlugin: {
          pluginKey: preflight.method?.pluginKey || '',
          pluginName,
        },
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: reply,
        toolCalls: [],
        preflightChecks: preflight.steps,
        userId,
      });
      return response;
    }

    if (!preflight.methodExists || !preflight.method) {
      const reply = `抱歉，我找不到「${toolCall.name}」这个方法。请确认插件是否已正确安装。`;
      const response: AiChatResponse = {
        reply,
        toolCalls: [],
        needsMoreInfo: false,
        preflightChecks: preflight.steps,
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: reply,
        toolCalls: [],
        preflightChecks: preflight.steps,
        userId,
      });
      return response;
    }

    const method = preflight.method;

    if (!preflight.paramsValid) {
      const missingParams = preflight.missingParams;
      const paramErrors = preflight.paramErrors;
      const askBack = this.buildAskBackMessage(method, missingParams, paramErrors);

      const response: AiChatResponse = {
        reply: askBack,
        toolCalls: [],
        needsMoreInfo: true,
        missingParams,
        preflightChecks: preflight.steps,
        pendingMethod: {
          id: method.id,
          name: method.name,
          pluginKey: method.pluginKey,
          description: method.description,
          params: method.params,
          providedArgs: toolCall.parameters,
        },
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: askBack,
        toolCalls: [],
        preflightChecks: preflight.steps,
        userId,
      });
      return response;
    }

    const toolCallId = `tc-${Date.now()}`;
    const isDangerous = method.dangerous === true;

    const pendingToolCalls = [
      {
        id: toolCallId,
        type: 'function' as const,
        function: { name: toolCall.name, arguments: toolCall.parameters },
        status: 'pending' as const,
      },
    ];

    if (isDangerous && !dto.confirmToolCall) {
      const reply = `⚠️ **危险操作确认**\n\n你正在执行「${method.name}」：${method.description}\n\n该操作不可恢复。\n\n请确认是否继续？（回复"确认执行"继续）`;
      const response: AiChatResponse = {
        reply,
        toolCalls: pendingToolCalls,
        needsMoreInfo: false,
        needsConfirmation: true,
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: reply,
        toolCalls: pendingToolCalls,
        userId,
      });
      return response;
    }

    try {
      const result = await this.methodRegistry.executeMethod(
        toolCall.name,
        toolCall.parameters,
        userId,
      );

      const finalReply = await this.generateFinalReply(
        dto.messages,
        firstTurn,
        toolCall,
        result,
        true,
      );

      const successToolCalls = [
        {
          id: toolCallId,
          type: 'function' as const,
          function: { name: toolCall.name, arguments: toolCall.parameters },
          status: 'success' as const,
          result,
        },
      ];
      const response: AiChatResponse = {
        reply: finalReply,
        toolCalls: successToolCalls,
        needsMoreInfo: false,
        preflightChecks: preflight.steps,
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: finalReply,
        toolCalls: successToolCalls,
        preflightChecks: preflight.steps,
        userId,
      });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${toolCall.name}`, errorMessage);

      const finalReply = await this.generateFinalReply(
        dto.messages,
        firstTurn,
        toolCall,
        { error: errorMessage },
        false,
      );

      const errorToolCalls = [
        {
          id: toolCallId,
          type: 'function' as const,
          function: { name: toolCall.name, arguments: toolCall.parameters },
          status: 'error' as const,
          errorMessage,
        },
      ];
      const response: AiChatResponse = {
        reply: finalReply,
        toolCalls: errorToolCalls,
        needsMoreInfo: false,
        preflightChecks: preflight.steps,
        sessionId,
      };
      await this.historyService.saveMessage({
        sessionId,
        role: 'assistant',
        content: finalReply,
        toolCalls: errorToolCalls,
        preflightChecks: preflight.steps,
        userId,
      });
      return response;
    }
  }

  async getMethods(): Promise<{ items: PluginMethod[]; total: number }> {
    return this.methodRegistry.getAvailableMethods();
  }

  async listSessions(userId: string): Promise<ListResponse<AiChatSession>> {
    return this.historyService.listSessions(userId);
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<AiChatSessionMessage[]> {
    return this.historyService.getSessionMessages(sessionId, userId);
  }

  async createSession(userId: string, title?: string): Promise<AiChatSession> {
    return this.historyService.createSession(userId, title);
  }

  async updateSessionTitle(
    sessionId: string,
    title: string,
    userId: string,
  ): Promise<void> {
    return this.historyService.updateSessionTitle(sessionId, title, userId);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    return this.historyService.deleteSession(sessionId, userId);
  }

  private buildSystemPrompt(allMethods: PluginMethod[], enabledMethods: PluginMethod[]): string {
    const enabledIds = new Set(enabledMethods.map((m) => m.id));

    const enabledJson = allMethods
      .filter((m) => enabledIds.has(m.id))
      .map((m) => ({
        name: m.id,
        description: m.description,
        parameters: {
          type: 'object',
          properties: m.params.reduce(
            (acc, p) => {
              acc[p.name] = {
                type: p.type,
                description: p.description,
                ...(p.enum ? { enum: p.enum } : {}),
              };
              return acc;
            },
            {} as Record<string, unknown>,
          ),
          required: m.params.filter((p) => p.required).map((p) => p.name),
        },
      }));

    const disabledMethods = allMethods.filter((m) => !enabledIds.has(m.id));
    const disabledByPlugin = new Map<string, { pluginName: string; methods: string[] }>();
    for (const m of disabledMethods) {
      const entry = disabledByPlugin.get(m.pluginKey);
      if (entry) {
        entry.methods.push(m.id);
      } else {
        const pluginName = this.getPluginDisplayName(m.pluginKey);
        disabledByPlugin.set(m.pluginKey, { pluginName, methods: [m.id] });
      }
    }

    let disabledSection = '';
    if (disabledByPlugin.size > 0) {
      const lines: string[] = [];
      for (const [pluginKey, info] of disabledByPlugin) {
        lines.push(`- **${info.pluginName}** (插件键: ${pluginKey}) — 未启用，方法: ${info.methods.join('、')}`);
      }
      disabledSection = `
## 未启用的插件方法
以下插件目前未启用，但你仍然可以识别用户对它们的操作意图。当用户的请求涉及这些方法时，你仍然需要生成工具调用标记，系统会自动检测并提示用户启用插件。

${lines.join('\n')}
`;
    }

    return `你是 Life-OS 平台的 AI 助手，名叫「人生系统助手」。你的任务是帮助用户通过工具调用的方式操作各种插件功能，并基于用户的真实生活数据（习惯打卡、番茄专注、浪费时间、目标进度、任务）提供深度分析与建议。

## 意图分类（极其重要）
用户的请求分为两类，处理方式完全不同：

### 第一类：数据操作请求（必须生成工具调用）
用户要求在某个插件里**添加/修改/删除/查询业务数据**，例如：
- 「在儿童资料站添加一个资料」
- 「帮我加一个目标」
- 「查一下今天的习惯打卡」
- 「把 RAZ 那本书删掉」
- 「给我列一下英语分类的资源」
- 「添加一个 RAZ AA 级资料」

**处理方式：直接生成工具调用**，调用对应插件的业务方法（如 child-resources.addResource、goals.addGoal 等）。把能识别的参数填进去，识别不到的就空着——系统会自动追问缺失参数。

### 第二类：插件管理请求（不要生成工具调用）
用户要求**安装/启用/卸载/禁用某个插件本身**，例如：
- 「安装儿童资料站插件」
- 「启用 RPA 创作中心」
- 「卸载习惯打卡插件」
- 「把任务管理插件关掉」

**处理方式：直接用自然语言回复**，告诉用户如何操作（去设置里启用或让用户说更明确的指令）。不要生成任何工具调用标记。

### 第三类：系统能力请求（必须生成工具调用）
用户要求**把插件提交到插件市场**（例如「把读书笔记插件提交到市场」「提交 reading-notes 到插件市场」）时，调用系统方法「life-os.submitPluginToMarket」（必填参数 pluginKey 为插件 key）。这类请求由系统直接执行：新建分支、上传插件文件、创建 Pull Request 请求管理员 review。

## 可用工具（已启用的插件方法）
你可以调用以下已启用的插件方法来帮助用户完成数据操作：

${JSON.stringify(enabledJson, null, 2)}
${disabledSection}
## 工具调用规则
1. 当用户的请求是**数据操作**（添加/修改/删除/查询业务内容）时，使用工具调用标记。
2. 当用户的请求是**插件管理**（安装/启用/卸载插件本身）时，不要使用工具调用标记，直接文字回复。
3. 工具调用格式：用 \`${TOOL_CALL_START}\` 和 \`${TOOL_CALL_END}\` 包裹一个 JSON 对象。
4. JSON 对象格式：\`{"name": "方法名", "parameters": {"参数名": "参数值"}}\`
5. 你应该只在需要执行数据操作时调用工具。普通的聊天、问答、解释、插件管理说明不需要调用工具。
6. **每次回复最多包含一个工具调用**。如果需要多个操作，先完成第一个，根据结果再进行下一个。
7. **优先生成工具调用**：只要用户的意图涉及数据操作（无论插件是否启用），都生成工具调用（把能确定的参数填上）。系统会做插件启用检查和参数完整性检查。

## 参数处理
1. 仔细检查用户提供的信息，**提取所有可识别的参数**。
2. 对于用户明确提到的参数，准确填入。
3. 对于**可选参数**，如果用户没有提供，**不要包含在 parameters 中**（不要传 null 或空字符串占位）。
4. 对于**必填参数**，如果用户没有提供，可以不填或留空 —— 系统会自动检查并向用户追问。
5. 不要臆造用户未提到的参数值。

## 回复风格
1. 使用自然、友好的中文回复。
2. 当你准备调用工具时，先用一句话说明你理解了用户的意图，然后输出工具调用标记。
3. 普通对话不需要工具调用标记。
4. 工具调用成功后，用简洁的语言向用户报告结果，不要展示原始 JSON。
5. 工具调用失败时，向用户说明错误原因，并给出可行的建议。

## 示例

### 示例 1：数据操作（参数齐全）
用户说："在儿童资料站添加一个 RAZ AA 级资料"
你回复：
好的，我来帮你添加这个资料。
${TOOL_CALL_START}
{"name": "child-resources.addResource", "parameters": {"name": "RAZ AA 级资料", "category": "英语", "level": "AA"}}
${TOOL_CALL_END}

### 示例 2：数据操作（缺少必填参数）
用户说："在儿童资料站添加一个资料"
（用户只说添加资料，但没有说名称等必填信息）
你仍然应该生成工具调用，把能确定的参数填上：
好的，我来帮你添加资料。
${TOOL_CALL_START}
{"name": "child-resources.addResource", "parameters": {}}
${TOOL_CALL_END}

### 示例 3：数据操作（查询类）
用户说："帮我查一下英语分类的资料"
你回复：
好的，我来帮你查询英语分类的资料。
${TOOL_CALL_START}
{"name": "child-resources.listResources", "parameters": {"category": "英语"}}
${TOOL_CALL_END}

### 示例 4：插件管理（不要生成工具调用）
用户说："安装儿童资料站插件"
你回复（文字说明即可，不要工具调用标记）：
好的，儿童资料站插件可以帮你管理儿童启蒙学习资源。你可以在系统设置的插件管理中启用它，或者直接点击快捷按钮安装。启用后就可以用自然语言操作里面的资料啦。`;
  }

  private getPluginDisplayName(pluginKey: string): string {
    const nameMap: Record<string, string> = {
      'dsh-plugin-child-resources': '儿童资料站',
      'dsh-plugin-life-dashboard': '人生管理看板',
      'dsh-plugin-wechat-rpa': 'RPA 创作中心',
      'dsh-plugin-tasks-gtd': '任务管理',
      'dsh-plugin-finance-ledger': '财务记账',
      'dsh-plugin-health-fit': '健康管理',
      'dsh-plugin-reading-lab': '阅读实验室',
      'dsh-plugin-health-lab': '健康实验室',
      'dsh-plugin-finance-tracker': '财务管家',
    };
    return nameMap[pluginKey] || pluginKey;
  }

  private async callAiTextGenerate(
    systemContext: string,
    userQuestion: string,
  ): Promise<string> {
    try {
      const result = (await this.capabilityService
        .load('life_os_a2ui_ai_chat_1')
        .call('textGenerate', {
          system_context: systemContext,
          user_question: userQuestion,
        })) as { content?: string };

      return result?.content || '';
    } catch (error) {
      this.logger.error('AI text generate failed', JSON.stringify(error));
      throw new Error('AI 服务调用失败');
    }
  }

  private parseToolCall(text: string): ParsedToolCall | null {
    const startIndex = text.indexOf(TOOL_CALL_START);
    const endIndex = text.indexOf(TOOL_CALL_END);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    const jsonStr = text
      .substring(startIndex + TOOL_CALL_START.length, endIndex)
      .trim();

    try {
      const parsed = JSON.parse(jsonStr) as ParsedToolCall;
      if (parsed.name && typeof parsed.name === 'string') {
        return {
          name: parsed.name,
          parameters: parsed.parameters || {},
        };
      }
      return null;
    } catch {
      this.logger.warn(`Failed to parse tool call JSON: ${jsonStr}`);
      return null;
    }
  }

  private buildAskBackMessage(
    method: PluginMethod,
    missingParams: string[],
    errorParams: string[],
  ): string {
    const lines: string[] = ['好的，我来帮你处理这个操作。不过我还需要一些信息：'];

    if (missingParams.length > 0) {
      for (const paramName of missingParams) {
        const param = method.params.find((p) => p.name === paramName);
        if (param) {
          lines.push(`- **${param.name}**：${param.description}`);
        }
      }
    }

    if (errorParams.length > 0) {
      lines.push('');
      lines.push('以下参数的值需要调整：');
      for (const err of errorParams) {
        lines.push(`- ${err}`);
      }
    }

    lines.push('');
    lines.push('请告诉我这些信息，我就可以帮你完成操作了。');

    return lines.join('\n');
  }

  private isDangerousOperation(_methodName: string): boolean {
    return false;
  }

  private buildUserQuestion(
    history: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): string {
    if (history.length === 0) return '';
    return history
      .map((m) => {
        const label = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '系统';
        return `${label}: ${m.content}`;
      })
      .join('\n\n');
  }

  private async generateFinalReply(
    history: { role: 'user' | 'assistant' | 'system'; content: string }[],
    aiFirstResponse: string,
    toolCall: ParsedToolCall,
    result: unknown,
    success: boolean,
  ): Promise<string> {
    const resultStr = JSON.stringify(result, null, 2);

    const messages: SimpleMessage[] = [
      ...history,
      {
        role: 'assistant',
        content: aiFirstResponse,
      },
      {
        role: 'user',
        content: `工具调用结果：\n方法: ${toolCall.name}\n成功: ${success}\n返回数据:\n\`\`\`json\n${resultStr}\n\`\`\`\n\n请根据工具调用结果，用自然友好的中文向用户报告执行情况。如果成功，说明做了什么；如果失败，说明错误原因并给出建议。不要直接展示 JSON。`,
      },
    ];

    try {
      const ctx = '你是人生系统助手，Life-OS 平台的 AI 助手。请根据工具调用结果用中文向用户友好报告执行情况，不要展示原始 JSON。';
      const q = `工具调用结果：
方法: ${toolCall.name}
成功: ${success}
返回数据:
\`\`\`json
${resultStr}
\`\`\`

用户原始请求的上下文：
${history.map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}

请根据以上信息，用自然友好的中文向用户报告执行结果。成功就说明做了什么，失败就说明原因并给出建议。不要直接展示 JSON 数据。`;
      return await this.callAiTextGenerate(ctx, q);
    } catch {
      if (success) {
        return `✅ 操作成功！已执行「${toolCall.name}」。`;
      }
      return `❌ 操作失败：执行「${toolCall.name}」时出错。`;
    }
  }
}

