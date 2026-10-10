import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { ChildResourcesService } from '@server/modules/child-resources/child-resources.service';
import { GoalsService } from '@server/modules/goals/goals.service';
import { HabitsService } from '@server/modules/habits/habits.service';
import { NotesService } from '@server/modules/notes/notes.service';
import { TasksService } from '@server/modules/tasks/tasks.service';
import { FinanceService } from '@server/modules/finance/finance.service';
import { HealthService } from '@server/modules/health/health.service';
import { LifeLogService } from '@server/modules/life-log/life-log.service';
import { PomodoroService } from '@server/modules/pomodoro/pomodoro.service';
import { TimeBlackholeService } from '@server/modules/time-blackhole/time-blackhole.service';
import { RpaManagerService } from '@server/modules/rpa-manager/rpa-manager.service';
import { InsightsService } from '@server/modules/insights/insights.service';
import { ReviewService } from '@server/modules/review/review.service';
import { ReviewBoardService } from '@server/modules/review-board/review-board.service';
import { ChildTvService } from '@server/modules/child-tv/child-tv.service';
import type {
  PluginMethod,
  PluginMethodParam,
  PreflightCheckStep,
} from '@shared/api.interface';

interface MethodHandler {
  method: PluginMethod;
  execute: (args: Record<string, unknown>, userId: string) => Promise<unknown>;
}

@Injectable()
export class PluginMethodRegistry {
  private readonly logger = new Logger(PluginMethodRegistry.name);
  private readonly methods = new Map<string, MethodHandler>();

  constructor(
    private readonly pluginsService: PluginsService,
    private readonly childResourcesService: ChildResourcesService,
    private readonly goalsService: GoalsService,
    private readonly habitsService: HabitsService,
    private readonly notesService: NotesService,
    private readonly tasksService: TasksService,
    private readonly financeService: FinanceService,
    private readonly healthService: HealthService,
    private readonly lifeLogService: LifeLogService,
    private readonly pomodoroService: PomodoroService,
    private readonly timeBlackholeService: TimeBlackholeService,
    private readonly rpaManagerService: RpaManagerService,
    private readonly insightsService: InsightsService,
    private readonly reviewService: ReviewService,
    private readonly reviewBoardService: ReviewBoardService,
    private readonly childTvService: ChildTvService,
  ) {
    this.registerChildResourcesMethods();
    this.registerGoalsMethods();
    this.registerHabitsMethods();
    this.registerNotesMethods();
    this.registerTasksMethods();
    this.registerFinanceMethods();
    this.registerHealthMethods();
    this.registerLifeLogMethods();
    this.registerPomodoroMethods();
    this.registerTimeBlackholeMethods();
    this.registerRpaManagerMethods();
    this.registerInsightsMethods();
    this.registerReviewMethods();
    this.registerReviewBoardMethods();
    this.registerChildTvMethods();
    this.registerTaskFocusMethods();
  }

  // ===== Child Resources =====

  private registerChildResourcesMethods(): void {
    const pluginKey = 'dsh-plugin-child-resources';

    const addResourceParams: PluginMethodParam[] = [
      { name: 'name', type: 'string', required: true, description: '资料名称，必填' },
      { name: 'category', type: 'string', required: false, description: '分类，可选值：英语、中文、数学、科学、其他，默认英语', enum: ['英语', '中文', '数学', '科学', '其他'] },
      { name: 'series', type: 'string', required: false, description: '系列名称，如 RAZ、廖彩杏、牛津树 等' },
      { name: 'resourceType', type: 'string', required: false, description: '资源类型，可选值：book、video、kit、audio，默认 book', enum: ['book', 'video', 'kit', 'audio'] },
      { name: 'level', type: 'string', required: false, description: '级别，如 AA、Level 1 等' },
      { name: 'description', type: 'string', required: false, description: '资料描述' },
      { name: 'resourceUrl', type: 'string', required: false, description: '资源链接，必须以 http:// 或 https:// 开头' },
      { name: 'icon', type: 'string', required: false, description: '图标名称' },
    ];

    this.register({
      id: 'child-resources.addResource',
      name: '添加儿童资料',
      description: '在儿童资料站中添加一条新的学习资料',
      pluginKey,
      params: addResourceParams,
    }, async (args, userId) => {
      return this.childResourcesService.create({
        name: String(args.name ?? ''),
        category: args.category ? String(args.category) : '英语',
        series: args.series ? String(args.series) : undefined,
        resourceType: args.resourceType ? String(args.resourceType) : 'book',
        level: args.level ? String(args.level) : undefined,
        description: args.description ? String(args.description) : undefined,
        resourceUrl: args.resourceUrl ? String(args.resourceUrl) : undefined,
        icon: args.icon ? String(args.icon) : undefined,
      }, userId);
    });

    this.register({
      id: 'child-resources.updateResource',
      name: '修改儿童资料',
      description: '修改儿童资料站中已有的一条资料',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '资料ID，必填' },
        ...addResourceParams.filter((p) => p.name !== 'name').map((p) => ({ ...p, required: false })),
        { name: 'name', type: 'string', required: false, description: '资料名称' },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      return this.childResourcesService.update(id, rest as Record<string, unknown>, userId);
    });

    this.register({
      id: 'child-resources.deleteResource',
      name: '删除儿童资料',
      description: '删除儿童资料站中的一条资料（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的资料ID，必填' },
      ],
      dangerous: true,
    }, async (args) => {
      const id = String(args.id ?? '');
      return this.childResourcesService.remove(id);
    });

    this.register({
      id: 'child-resources.listResources',
      name: '查询儿童资料列表',
      description: '按分类或关键词查询儿童资料站的资料列表',
      pluginKey,
      params: [
        { name: 'category', type: 'string', required: false, description: '分类筛选，可选值：英语、中文、数学、科学、其他', enum: ['英语', '中文', '数学', '科学', '其他'] },
        { name: 'keyword', type: 'string', required: false, description: '关键词搜索，匹配名称和描述' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      return this.childResourcesService.findAll({
        category: args.category ? String(args.category) : undefined,
        search: args.keyword ? String(args.keyword) : undefined,
        page: args.page ? Number(args.page) : 1,
        pageSize: args.pageSize ? Number(args.pageSize) : 20,
      });
    });
  }

  // ===== Goals =====

  private registerGoalsMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'goals.addGoal',
      name: '添加目标',
      description: '创建一个新的人生目标或OKR',
      pluginKey,
      params: [
        { name: 'title', type: 'string', required: true, description: '目标标题，必填' },
        { name: 'category', type: 'string', required: false, description: '目标分类，如职业、健康、财务、学习等' },
        { name: 'description', type: 'string', required: false, description: '目标详细描述' },
        { name: 'deadline', type: 'string', required: false, description: '截止日期，格式 YYYY-MM-DD' },
        { name: 'milestones', type: 'string', required: false, description: '里程碑名称列表，用逗号分隔，如"调研,设计,开发,上线"' },
        { name: 'progress', type: 'number', required: false, description: '进度百分比，0-100，默认0' },
        { name: 'status', type: 'string', required: false, description: '目标状态，可选值：active、completed、archived，默认active', enum: ['active', 'completed', 'archived'] },
      ],
    }, async (args, userId) => {
      const milestonesStr = args.milestones ? String(args.milestones) : '';
      const milestones = milestonesStr
        ? milestonesStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean).map((title, i) => ({
            id: `ms-${Date.now()}-${i}`,
            title,
            completed: false,
          }))
        : undefined;

      return this.goalsService.create({
        title: String(args.title ?? ''),
        category: args.category ? String(args.category) : undefined,
        description: args.description ? String(args.description) : undefined,
        deadline: args.deadline ? String(args.deadline) : undefined,
        milestones,
        progress: args.progress !== undefined ? Number(args.progress) : undefined,
        status: args.status ? String(args.status) as 'active' | 'completed' | 'archived' : undefined,
      });
    });

    this.register({
      id: 'goals.updateGoal',
      name: '修改目标',
      description: '修改已有的目标信息',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '目标ID，必填' },
        { name: 'title', type: 'string', required: false, description: '目标标题' },
        { name: 'category', type: 'string', required: false, description: '目标分类' },
        { name: 'description', type: 'string', required: false, description: '目标描述' },
        { name: 'deadline', type: 'string', required: false, description: '截止日期，格式 YYYY-MM-DD' },
        { name: 'progress', type: 'number', required: false, description: '进度百分比，0-100' },
        { name: 'status', type: 'string', required: false, description: '目标状态，可选值：active、completed、archived', enum: ['active', 'completed', 'archived'] },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if (rest.title !== undefined) patch.title = String(rest.title);
      if (rest.category !== undefined) patch.category = String(rest.category);
      if (rest.description !== undefined) patch.description = String(rest.description);
      if (rest.deadline !== undefined) patch.deadline = String(rest.deadline);
      if (rest.progress !== undefined) patch.progress = Number(rest.progress);
      if (rest.status !== undefined) patch.status = String(rest.status);
      return this.goalsService.update(id, patch as Parameters<typeof this.goalsService.update>[1]);
    });

    this.register({
      id: 'goals.deleteGoal',
      name: '删除目标',
      description: '删除一个目标（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的目标ID，必填' },
      ],
      dangerous: true,
    }, async (args) => {
      const id = String(args.id ?? '');
      await this.goalsService.remove(id);
      return { success: true, message: '目标已删除' };
    });

    this.register({
      id: 'goals.listGoals',
      name: '查询目标列表',
      description: '查询人生目标列表，支持按状态和关键词筛选',
      pluginKey,
      params: [
        { name: 'status', type: 'string', required: false, description: '状态筛选，可选值：active、completed、archived', enum: ['active', 'completed', 'archived'] },
        { name: 'keyword', type: 'string', required: false, description: '关键词搜索' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      const result = await this.goalsService.findAll(page, pageSize);
      if (args.keyword) {
        const kw = String(args.keyword).toLowerCase();
        result.items = result.items.filter((g) =>
          g.title.toLowerCase().includes(kw) ||
          (g.description && g.description.toLowerCase().includes(kw)),
        );
        result.total = result.items.length;
      }
      if (args.status) {
        const status = String(args.status);
        result.items = result.items.filter((g) => g.status === status);
        result.total = result.items.length;
      }
      return result;
    });

    this.register({
      id: 'goals.addMilestone',
      name: '添加里程碑',
      description: '为指定目标添加一个里程碑',
      pluginKey,
      params: [
        { name: 'goalId', type: 'string', required: true, description: '目标ID，必填' },
        { name: 'title', type: 'string', required: true, description: '里程碑标题，必填' },
      ],
    }, async (args) => {
      const goalId = String(args.goalId ?? '');
      const milestoneTitle = String(args.title ?? '');
      const goal = await this.goalsService.findOne(goalId);
      const currentMilestones = (goal.milestones ?? []) as { id: string; title: string; completed: boolean }[];
      const newMilestone = {
        id: `ms-${Date.now()}`,
        title: milestoneTitle,
        completed: false,
      };
      const updatedMilestones = [...currentMilestones, newMilestone];
      await this.goalsService.update(goalId, { milestones: updatedMilestones });
      return { success: true, milestone: newMilestone, totalMilestones: updatedMilestones.length };
    });
  }

  // ===== Habits =====

  private registerHabitsMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'habits.addHabit',
      name: '添加习惯',
      description: '创建一个新的习惯打卡项',
      pluginKey,
      params: [
        { name: 'name', type: 'string', required: true, description: '习惯名称，必填' },
        { name: 'icon', type: 'string', required: false, description: '图标名称，如 sun、book、dumbbell 等' },
        { name: 'color', type: 'string', required: false, description: '习惯颜色，如 #6366f1' },
        { name: 'frequency', type: 'string', required: false, description: '频率，可选值：daily、weekly，默认daily', enum: ['daily', 'weekly'] },
      ],
    }, async (args) => {
      return this.habitsService.createHabit({
        name: String(args.name ?? ''),
        icon: args.icon ? String(args.icon) : undefined,
        color: args.color ? String(args.color) : undefined,
        frequency: args.frequency ? String(args.frequency) as 'daily' | 'weekly' : 'daily',
      });
    });

    this.register({
      id: 'habits.checkIn',
      name: '习惯打卡',
      description: '为指定习惯完成今日打卡',
      pluginKey,
      params: [
        { name: 'habitId', type: 'string', required: true, description: '习惯ID，必填' },
        { name: 'date', type: 'string', required: false, description: '打卡日期，格式 YYYY-MM-DD，默认今天' },
      ],
    }, async (args) => {
      const habitId = String(args.habitId ?? '');
      const date = args.date
        ? String(args.date)
        : new Date().toISOString().split('T')[0];
      return this.habitsService.toggleRecord(habitId, date);
    });

    this.register({
      id: 'habits.updateHabit',
      name: '修改习惯',
      description: '修改已有的习惯信息',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '习惯ID，必填' },
        { name: 'name', type: 'string', required: false, description: '习惯名称' },
        { name: 'icon', type: 'string', required: false, description: '图标名称' },
        { name: 'color', type: 'string', required: false, description: '颜色' },
        { name: 'frequency', type: 'string', required: false, description: '频率，可选值：daily、weekly', enum: ['daily', 'weekly'] },
      ],
    }, async (args) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      throw new BadRequestException('修改习惯功能暂未开放，请直接删除后重新创建');
    });

    this.register({
      id: 'habits.deleteHabit',
      name: '删除习惯',
      description: '删除一个习惯（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的习惯ID，必填' },
      ],
      dangerous: true,
    }, async (args) => {
      const id = String(args.id ?? '');
      await this.habitsService.deleteHabit(id);
      return { success: true, message: '习惯已删除' };
    });

    this.register({
      id: 'habits.listHabits',
      name: '查询习惯列表',
      description: '查询所有习惯打卡项',
      pluginKey,
      params: [
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      return this.habitsService.findAllHabits(page, pageSize);
    });

    this.register({
      id: 'habits.addEnergyRecord',
      name: '记录精力状态',
      description: '记录今日的精力和专注力水平',
      pluginKey,
      params: [
        { name: 'energyLevel', type: 'number', required: true, description: '精力等级，1-10，必填' },
        { name: 'focusLevel', type: 'number', required: false, description: '专注力等级，1-10，默认5' },
        { name: 'mood', type: 'string', required: false, description: '心情描述，如开心、平静、疲惫等' },
        { name: 'note', type: 'string', required: false, description: '备注说明' },
        { name: 'recordDate', type: 'string', required: false, description: '记录日期，格式 YYYY-MM-DD，默认今天' },
      ],
    }, async (args) => {
      const recordDate = args.recordDate
        ? String(args.recordDate)
        : new Date().toISOString().split('T')[0];
      return this.habitsService.createEnergyRecord({
        recordDate,
        energyLevel: Number(args.energyLevel ?? 5),
        focusLevel: args.focusLevel !== undefined ? Number(args.focusLevel) : 5,
        mood: args.mood ? String(args.mood) : undefined,
        note: args.note ? String(args.note) : undefined,
      });
    });
  }

  // ===== Notes =====

  private registerNotesMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'notes.addNote',
      name: '添加笔记',
      description: '创建一条新的闪念笔记',
      pluginKey,
      params: [
        { name: 'title', type: 'string', required: true, description: '笔记标题，必填' },
        { name: 'content', type: 'string', required: false, description: '笔记内容' },
        { name: 'tags', type: 'string', required: false, description: '标签列表，用逗号分隔，如"工作,灵感,读书"' },
        { name: 'pinned', type: 'boolean', required: false, description: '是否置顶，默认false' },
      ],
    }, async (args, userId) => {
      const tagsStr = args.tags ? String(args.tags) : '';
      const tags = tagsStr
        ? tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        : [];
      return this.notesService.createNote({
        title: String(args.title ?? ''),
        content: args.content ? String(args.content) : '',
        tags: tags.length > 0 ? tags : undefined,
        isPinned: args.pinned !== undefined ? Boolean(args.pinned) : undefined,
      });
    });

    this.register({
      id: 'notes.updateNote',
      name: '修改笔记',
      description: '修改已有的笔记内容',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '笔记ID，必填' },
        { name: 'title', type: 'string', required: false, description: '笔记标题' },
        { name: 'content', type: 'string', required: false, description: '笔记内容' },
        { name: 'tags', type: 'string', required: false, description: '标签列表，用逗号分隔' },
        { name: 'pinned', type: 'boolean', required: false, description: '是否置顶' },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if (rest.title !== undefined) patch.title = String(rest.title);
      if (rest.content !== undefined) patch.content = String(rest.content);
      if (rest.tags !== undefined) {
        const tagsStr = String(rest.tags);
        patch.tags = tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      }
      if (rest.pinned !== undefined) patch.isPinned = Boolean(rest.pinned);
      return this.notesService.updateNote(id, patch as Parameters<typeof this.notesService.updateNote>[1]);
    });

    this.register({
      id: 'notes.deleteNote',
      name: '删除笔记',
      description: '删除一条笔记（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的笔记ID，必填' },
      ],
      dangerous: true,
    }, async (args) => {
      const id = String(args.id ?? '');
      await this.notesService.deleteNote(id);
      return { success: true, message: '笔记已删除' };
    });

    this.register({
      id: 'notes.listNotes',
      name: '查询笔记列表',
      description: '查询闪念笔记列表，支持按标签和关键词筛选',
      pluginKey,
      params: [
        { name: 'tag', type: 'string', required: false, description: '按标签筛选' },
        { name: 'keyword', type: 'string', required: false, description: '关键词搜索，匹配标题和内容' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      const result = await this.notesService.findAllNotes(page, pageSize);
      if (args.tag) {
        const tag = String(args.tag);
        result.items = result.items.filter((n) => n.tags?.includes(tag));
        result.total = result.items.length;
      }
      if (args.keyword) {
        const kw = String(args.keyword).toLowerCase();
        result.items = result.items.filter((n) =>
          (n.title && n.title.toLowerCase().includes(kw)) ||
          (n.content && n.content.toLowerCase().includes(kw)),
        );
        result.total = result.items.length;
      }
      return result;
    });

    this.register({
      id: 'notes.addPrinciple',
      name: '添加人生原则',
      description: '创建一条新的人生原则或座右铭',
      pluginKey,
      params: [
        { name: 'title', type: 'string', required: true, description: '原则标题，必填' },
        { name: 'content', type: 'string', required: false, description: '原则详细内容' },
        { name: 'category', type: 'string', required: false, description: '原则分类，如工作、生活、学习、健康等' },
      ],
    }, async (args) => {
      return this.notesService.createPrinciple({
        title: String(args.title ?? ''),
        content: args.content ? String(args.content) : '',
        category: args.category ? String(args.category) : undefined,
      });
    });

    this.register({
      id: 'notes.addQuickLink',
      name: '添加快速链接',
      description: '添加一个常用网站快速链接',
      pluginKey,
      params: [
        { name: 'title', type: 'string', required: true, description: '链接标题，必填' },
        { name: 'url', type: 'string', required: true, description: '链接地址，必须以 http:// 或 https:// 开头，必填' },
        { name: 'category', type: 'string', required: false, description: '链接分类，如工具、学习、娱乐等' },
        { name: 'icon', type: 'string', required: false, description: '图标名称' },
      ],
    }, async (args) => {
      return this.notesService.createQuickLink({
        title: String(args.title ?? ''),
        url: String(args.url ?? ''),
        category: args.category ? String(args.category) : undefined,
        icon: args.icon ? String(args.icon) : undefined,
      });
    });
  }

  // ===== Tasks =====

  private registerTasksMethods(): void {
    const pluginKey = 'dsh-plugin-tasks-gtd';

    this.register({
      id: 'tasks.addTask',
      name: '添加任务',
      description: '创建一个新的任务（GTD收集箱）',
      pluginKey,
      params: [
        { name: 'title', type: 'string', required: true, description: '任务标题，必填' },
        { name: 'description', type: 'string', required: false, description: '任务详细描述' },
        { name: 'priority', type: 'string', required: false, description: '优先级，可选值：low、medium、high，默认medium', enum: ['low', 'medium', 'high'] },
        { name: 'tags', type: 'string', required: false, description: '标签列表，用逗号分隔' },
        { name: 'dueDate', type: 'string', required: false, description: '截止日期，格式 YYYY-MM-DD' },
        { name: 'project', type: 'string', required: false, description: '所属项目名称' },
        { name: 'status', type: 'string', required: false, description: '任务状态，可选值：inbox、todo、in_progress、done、archived，默认inbox', enum: ['inbox', 'todo', 'in_progress', 'done', 'archived'] },
      ],
    }, async (args, userId) => {
      const tagsStr = args.tags ? String(args.tags) : '';
      const tags = tagsStr
        ? tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        : undefined;
      return this.tasksService.create({
        title: String(args.title ?? ''),
        description: args.description ? String(args.description) : undefined,
        priority: (args.priority ? String(args.priority) : 'medium') as 'low' | 'medium' | 'high',
        tags,
        dueDate: args.dueDate ? String(args.dueDate) : undefined,
        project: args.project ? String(args.project) : undefined,
        status: (args.status ? String(args.status) : 'inbox') as 'inbox' | 'todo' | 'in_progress' | 'done' | 'archived',
      }, userId);
    });

    this.register({
      id: 'tasks.updateTask',
      name: '修改任务',
      description: '修改已有的任务信息',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '任务ID，必填' },
        { name: 'title', type: 'string', required: false, description: '任务标题' },
        { name: 'description', type: 'string', required: false, description: '任务描述' },
        { name: 'priority', type: 'string', required: false, description: '优先级，可选值：low、medium、high', enum: ['low', 'medium', 'high'] },
        { name: 'tags', type: 'string', required: false, description: '标签列表，用逗号分隔' },
        { name: 'dueDate', type: 'string', required: false, description: '截止日期，格式 YYYY-MM-DD' },
        { name: 'project', type: 'string', required: false, description: '所属项目' },
        { name: 'status', type: 'string', required: false, description: '任务状态，可选值：inbox、todo、in_progress、done、archived', enum: ['inbox', 'todo', 'in_progress', 'done', 'archived'] },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if (rest.title !== undefined) patch.title = String(rest.title);
      if (rest.description !== undefined) patch.description = String(rest.description);
      if (rest.priority !== undefined) patch.priority = String(rest.priority);
      if (rest.dueDate !== undefined) patch.dueDate = String(rest.dueDate);
      if (rest.project !== undefined) patch.project = String(rest.project);
      if (rest.status !== undefined) patch.status = String(rest.status);
      if (rest.tags !== undefined) {
        const tagsStr = String(rest.tags);
        patch.tags = tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      }
      return this.tasksService.update(id, patch as Parameters<typeof this.tasksService.update>[1], userId);
    });

    this.register({
      id: 'tasks.completeTask',
      name: '完成任务',
      description: '将任务标记为已完成',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '任务ID，必填' },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      return this.tasksService.update(id, { status: 'done' }, userId);
    });

    this.register({
      id: 'tasks.deleteTask',
      name: '删除任务',
      description: '删除一个任务（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的任务ID，必填' },
      ],
      dangerous: true,
    }, async (args) => {
      const id = String(args.id ?? '');
      return this.tasksService.remove(id);
    });

    this.register({
      id: 'tasks.listTasks',
      name: '查询任务列表',
      description: '查询任务列表，支持按状态和优先级筛选',
      pluginKey,
      params: [
        { name: 'status', type: 'string', required: false, description: '状态筛选，可选值：inbox、todo、in_progress、done、archived', enum: ['inbox', 'todo', 'in_progress', 'done', 'archived'] },
        { name: 'priority', type: 'string', required: false, description: '优先级筛选，可选值：low、medium、high', enum: ['low', 'medium', 'high'] },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      return this.tasksService.findAll({
        status: args.status ? String(args.status) : undefined,
        priority: args.priority ? String(args.priority) : undefined,
        page,
        pageSize,
      });
    });
  }

  // ===== Finance =====

  private registerFinanceMethods(): void {
    const pluginKey = 'dsh-plugin-finance-ledger';

    this.register({
      id: 'finance.addTransaction',
      name: '记账',
      description: '记录一笔收入或支出',
      pluginKey,
      params: [
        { name: 'amount', type: 'number', required: true, description: '金额，正数，必填' },
        { name: 'type', type: 'string', required: false, description: '收支类型，可选值：expense（支出）、income（收入）、transfer（转账），默认expense', enum: ['expense', 'income', 'transfer'] },
        { name: 'category', type: 'string', required: true, description: '分类，如餐饮、交通、工资、投资等，必填' },
        { name: 'subcategory', type: 'string', required: false, description: '子分类' },
        { name: 'accountId', type: 'string', required: false, description: '账户ID' },
        { name: 'note', type: 'string', required: false, description: '备注说明' },
        { name: 'transactionDate', type: 'string', required: false, description: '交易日期，格式 YYYY-MM-DD，默认今天' },
      ],
    }, async (args, userId) => {
      const transactionDate = args.transactionDate
        ? String(args.transactionDate)
        : new Date().toISOString().split('T')[0];
      const type = (args.type ? String(args.type) : 'expense') as 'expense' | 'income' | 'transfer';
      return this.financeService.createTransaction({
        type,
        amount: Number(args.amount ?? 0),
        category: String(args.category ?? ''),
        subcategory: args.subcategory ? String(args.subcategory) : undefined,
        accountId: args.accountId ? String(args.accountId) : undefined,
        targetAccountId: undefined,
        note: args.note ? String(args.note) : undefined,
        transactionDate,
      }, userId);
    });

    this.register({
      id: 'finance.updateTransaction',
      name: '修改账目',
      description: '修改已有的账目记录',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '账目ID，必填' },
        { name: 'amount', type: 'number', required: false, description: '金额' },
        { name: 'type', type: 'string', required: false, description: '收支类型，可选值：expense、income、transfer', enum: ['expense', 'income', 'transfer'] },
        { name: 'category', type: 'string', required: false, description: '分类' },
        { name: 'subcategory', type: 'string', required: false, description: '子分类' },
        { name: 'accountId', type: 'string', required: false, description: '账户ID' },
        { name: 'note', type: 'string', required: false, description: '备注' },
        { name: 'transactionDate', type: 'string', required: false, description: '交易日期，格式 YYYY-MM-DD' },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      const { id: _id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if (rest.amount !== undefined) patch.amount = Number(rest.amount);
      if (rest.type !== undefined) patch.type = String(rest.type);
      if (rest.category !== undefined) patch.category = String(rest.category);
      if (rest.subcategory !== undefined) patch.subcategory = String(rest.subcategory);
      if (rest.accountId !== undefined) patch.accountId = String(rest.accountId);
      if (rest.note !== undefined) patch.note = String(rest.note);
      if (rest.transactionDate !== undefined) patch.transactionDate = String(rest.transactionDate);
      return this.financeService.updateTransaction(id, patch as Parameters<typeof this.financeService.updateTransaction>[1], userId);
    });

    this.register({
      id: 'finance.deleteTransaction',
      name: '删除账目',
      description: '删除一条账目记录（危险操作，需确认）',
      pluginKey,
      params: [
        { name: 'id', type: 'string', required: true, description: '要删除的账目ID，必填' },
      ],
    }, async (args, userId) => {
      const id = String(args.id ?? '');
      return this.financeService.deleteTransaction(id);
    });

    this.register({
      id: 'finance.listTransactions',
      name: '查询流水',
      description: '查询收支流水记录',
      pluginKey,
      params: [
        { name: 'category', type: 'string', required: false, description: '按分类筛选' },
        { name: 'type', type: 'string', required: false, description: '按类型筛选，可选值：expense、income、transfer', enum: ['expense', 'income', 'transfer'] },
        { name: 'month', type: 'string', required: false, description: '按月份筛选，格式 YYYY-MM，如 2025-09' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (args.month) {
        const monthStr = String(args.month);
        startDate = `${monthStr}-01`;
        const [year, month] = monthStr.split('-').map(Number);
        const nextMonth = new Date(year, month, 1);
        endDate = nextMonth.toISOString().split('T')[0];
      }
      return this.financeService.getTransactions({
        category: args.category ? String(args.category) : undefined,
        type: args.type ? String(args.type) : undefined,
        startDate,
        endDate,
        page,
        pageSize,
      });
    });

    this.register({
      id: 'finance.addAccount',
      name: '添加账户',
      description: '创建一个新的财务账户',
      pluginKey,
      params: [
        { name: 'name', type: 'string', required: true, description: '账户名称，必填' },
        { name: 'type', type: 'string', required: false, description: '账户类型，可选值：cash、bank、credit、investment、alipay、wechat，默认cash', enum: ['cash', 'bank', 'credit', 'investment', 'alipay', 'wechat'] },
        { name: 'initialBalance', type: 'number', required: false, description: '初始余额，默认0' },
        { name: 'currency', type: 'string', required: false, description: '货币，默认CNY' },
        { name: 'color', type: 'string', required: false, description: '账户颜色' },
        { name: 'note', type: 'string', required: false, description: '备注' },
      ],
    }, async (args, userId) => {
      return this.financeService.createAccount({
        name: String(args.name ?? ''),
        type: args.type ? String(args.type) : 'cash',
        balance: args.initialBalance !== undefined ? Number(args.initialBalance) : 0,
        currency: args.currency ? String(args.currency) : 'CNY',
        color: args.color ? String(args.color) : null,
        icon: null,
        note: args.note ? String(args.note) : null,
      }, userId);
    });

    this.register({
      id: 'finance.setBudget',
      name: '设置预算',
      description: '为某个分类设置月度预算',
      pluginKey,
      params: [
        { name: 'category', type: 'string', required: true, description: '预算分类，必填' },
        { name: 'amount', type: 'number', required: true, description: '预算金额，必填' },
        { name: 'period', type: 'string', required: false, description: '预算周期，可选值：monthly、weekly，默认monthly', enum: ['monthly', 'weekly'] },
      ],
    }, async (args, userId) => {
      const period = args.period ? String(args.period) : 'monthly';
      const now = new Date();
      const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return this.financeService.createBudget({
        category: String(args.category ?? ''),
        amount: Number(args.amount ?? 0),
        period: period as 'monthly' | 'weekly',
        periodKey,
      }, userId);
    });
  }

  // ===== Health =====

  private registerHealthMethods(): void {
    const pluginKey = 'dsh-plugin-health-fit';

    this.register({
      id: 'health.addHealthRecord',
      name: '记录身体数据',
      description: '记录体重、体脂、血压、心率等身体指标',
      pluginKey,
      params: [
        { name: 'type', type: 'string', required: true, description: '数据类型，必填。可选值：weight（体重）、bodyFat（体脂）、bloodPressure（血压）、heartRate（心率）', enum: ['weight', 'bodyFat', 'bloodPressure', 'heartRate'] },
        { name: 'value', type: 'number', required: true, description: '数值，必填。血压请传收缩压，舒张压用 diastolic 参数' },
        { name: 'diastolic', type: 'number', required: false, description: '舒张压，血压类型时使用' },
        { name: 'unit', type: 'string', required: false, description: '单位，如 kg、%、bpm 等' },
        { name: 'date', type: 'string', required: false, description: '记录日期，格式 YYYY-MM-DD，默认今天' },
        { name: 'note', type: 'string', required: false, description: '备注' },
      ],
    }, async (args, userId) => {
      const recordDate = args.date
        ? String(args.date)
        : new Date().toISOString().split('T')[0];
      const type = String(args.type ?? '');
      const value = Number(args.value ?? 0);

      const metrics: Record<string, number> = {};
      if (type === 'weight') {
        metrics.weight = value;
      } else if (type === 'bodyFat') {
        metrics.bodyFat = value;
      } else if (type === 'bloodPressure') {
        metrics.bloodPressureSystolic = value;
        if (args.diastolic !== undefined) {
          metrics.bloodPressureDiastolic = Number(args.diastolic);
        }
      } else if (type === 'heartRate') {
        metrics.heartRate = value;
      }

      return this.healthService.create({
        recordType: 'body',
        recordDate,
        metrics: metrics as any,
        note: args.note ? String(args.note) : undefined,
      }, userId);
    });

    this.register({
      id: 'health.addExerciseLog',
      name: '记录运动',
      description: '记录一次运动，如跑步、健身、游泳等',
      pluginKey,
      params: [
        { name: 'type', type: 'string', required: true, description: '运动类型，如跑步、游泳、健身、骑行等，必填' },
        { name: 'duration', type: 'number', required: true, description: '运动时长，单位分钟，必填' },
        { name: 'intensity', type: 'string', required: false, description: '运动强度，可选值：low、medium、high，默认medium', enum: ['low', 'medium', 'high'] },
        { name: 'calories', type: 'number', required: false, description: '消耗卡路里' },
        { name: 'date', type: 'string', required: false, description: '运动日期，格式 YYYY-MM-DD，默认今天' },
        { name: 'note', type: 'string', required: false, description: '备注' },
      ],
    }, async (args, userId) => {
      const recordDate = args.date
        ? String(args.date)
        : new Date().toISOString().split('T')[0];
      const metrics: Record<string, unknown> = {
        exerciseType: String(args.type ?? ''),
        durationMinutes: Number(args.duration ?? 0),
      };
      if (args.intensity) metrics.intensity = String(args.intensity);
      if (args.calories !== undefined) metrics.calories = Number(args.calories);

      return this.healthService.create({
        recordType: 'exercise',
        recordDate,
        metrics: metrics as any,
        note: args.note ? String(args.note) : undefined,
      }, userId);
    });

    this.register({
      id: 'health.addSleepRecord',
      name: '记录睡眠',
      description: '记录睡眠时长和质量',
      pluginKey,
      params: [
        { name: 'duration', type: 'number', required: true, description: '睡眠时长，单位小时，必填' },
        { name: 'quality', type: 'number', required: false, description: '睡眠质量评分，1-10，默认5' },
        { name: 'date', type: 'string', required: false, description: '记录日期（起床日期），格式 YYYY-MM-DD，默认今天' },
        { name: 'note', type: 'string', required: false, description: '备注' },
      ],
    }, async (args, userId) => {
      const recordDate = args.date
        ? String(args.date)
        : new Date().toISOString().split('T')[0];
      const metrics: Record<string, unknown> = {
        sleepHours: Number(args.duration ?? 0),
      };
      if (args.quality !== undefined) metrics.sleepQuality = Number(args.quality);

      return this.healthService.create({
        recordType: 'sleep',
        recordDate,
        metrics: metrics as any,
        note: args.note ? String(args.note) : undefined,
      }, userId);
    });

    this.register({
      id: 'health.listHealthRecords',
      name: '查询身体数据',
      description: '查询身体指标记录',
      pluginKey,
      params: [
        { name: 'type', type: 'string', required: false, description: '数据类型筛选，可选值：weight、bodyFat、bloodPressure、heartRate', enum: ['weight', 'bodyFat', 'bloodPressure', 'heartRate'] },
        { name: 'days', type: 'number', required: false, description: '查询最近多少天的数据，默认7天' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      const days = args.days !== undefined ? Number(args.days) : 7;
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days + 1);
      const startDateStr = startDate.toISOString().split('T')[0];

      let result = await this.healthService.findRecords({
        recordType: 'body',
        startDate: startDateStr,
        page,
        pageSize,
      });

      if (args.type) {
        const type = String(args.type);
        const fieldMap: Record<string, string> = {
          weight: 'weight',
          bodyFat: 'bodyFat',
          bloodPressure: 'bloodPressureSystolic',
          heartRate: 'heartRate',
        };
        const field = fieldMap[type];
        if (field) {
          result.items = result.items.filter((item) => {
            const m = item.metrics as Record<string, unknown>;
            return m[field] !== undefined && m[field] !== null;
          });
          result.total = result.items.length;
        }
      }

      return result;
    });

    this.register({
      id: 'health.listExerciseLogs',
      name: '查询运动日志',
      description: '查询运动记录日志',
      pluginKey,
      params: [
        { name: 'days', type: 'number', required: false, description: '查询最近多少天，默认7天' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      const days = args.days !== undefined ? Number(args.days) : 7;
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days + 1);
      const startDateStr = startDate.toISOString().split('T')[0];

      return this.healthService.findRecords({
        recordType: 'exercise',
        startDate: startDateStr,
        page,
        pageSize,
      });
    });
  }

  // ===== Life Log =====

  private registerLifeLogMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'lifeLog.listLogs',
      name: '查询人生日志',
      description: '查询人生事件日志记录（只读）',
      pluginKey,
      params: [
        { name: 'type', type: 'string', required: false, description: '事件类型筛选，如 task_created、habit_checked 等' },
        { name: 'days', type: 'number', required: false, description: '查询最近多少天，默认7天' },
        { name: 'page', type: 'number', required: false, description: '页码，默认1' },
        { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认20' },
      ],
    }, async (args) => {
      const page = args.page ? Number(args.page) : 1;
      const pageSize = args.pageSize ? Number(args.pageSize) : 20;
      const days = args.days !== undefined ? Number(args.days) : 7;
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days + 1);
      const startDateStr = startDate.toISOString().split('T')[0];

      return this.lifeLogService.findAll({
        eventType: args.type ? String(args.type) : undefined,
        startDate: startDateStr,
        page,
        pageSize,
      });
    });
  }

  // ===== Core Registry Methods =====

  /**
   * 注册在线市场插件的 AI 方法（通用数据操作，无需编写后端代码）。
   * 方法 ID 自动补全为 <pluginKey>.<shortId>，执行时通过回调交给 MarketService。
   */
  registerMarketMethods(
    pluginKey: string,
    defs: Array<{
      id: string;
      name: string;
      description: string;
      kind: string;
      collection: string;
      params?: PluginMethodParam[];
    }>,
    execute: (
      method: PluginMethod & { kind: string; collection: string },
      args: Record<string, unknown>,
      userId: string,
    ) => Promise<unknown>,
  ): void {
    for (const d of defs) {
      const method = {
        id: `${pluginKey}.${d.id}`,
        name: d.name,
        description: d.description,
        pluginKey,
        params: d.params ?? [],
        kind: d.kind,
        collection: d.collection,
      } as PluginMethod & { kind: string; collection: string };
      this.register(method, (args, userId) => execute(method, args, userId));
    }
    this.logger.log(`Registered ${defs.length} market methods for plugin: ${pluginKey}`);
  }

  private register(
    method: PluginMethod,
    execute: (args: Record<string, unknown>, userId: string) => Promise<unknown>,
  ): void {
    this.methods.set(method.id, { method, execute });
    this.logger.debug(`Registered plugin method: ${method.id}`);
  }

  async getAvailableMethods(): Promise<{ items: PluginMethod[]; total: number }> {
    const { items: installedPlugins } = await this.pluginsService.getInstalledPlugins();
    const installedKeys = new Set(installedPlugins.map((p) => p.pluginKey));

    const items: PluginMethod[] = [];
    for (const handler of this.methods.values()) {
      // 系统级方法不依赖插件安装状态，始终可用
      if (handler.method.system || installedKeys.has(handler.method.pluginKey)) {
        items.push(handler.method);
      }
    }
    return { items, total: items.length };
  }

  async preFlightCheck(
    methodId: string,
    args: Record<string, unknown>,
  ): Promise<{
    steps: PreflightCheckStep[];
    pluginEnabled: boolean;
    methodExists: boolean;
    paramsValid: boolean;
    method: PluginMethod | null;
    missingParams: string[];
    paramErrors: string[];
    pluginName: string;
  }> {
    const steps: PreflightCheckStep[] = [];
    let pluginEnabled = false;
    let methodExists = false;
    let paramsValid = false;
    let method: PluginMethod | null = null;
    let missingParams: string[] = [];
    let paramErrors: string[] = [];
    let pluginName = '';

    const methodHandler = this.methods.get(methodId);
    method = methodHandler ? methodHandler.method : null;

    const { items: allPlugins } = await this.pluginsService.getInstalledPlugins();

    if (method) {
      // 系统级方法：不依赖具体插件启用状态
      if (method.system) {
        pluginEnabled = true;
        methodExists = true;
        pluginName = method.name;
        steps.push({
          step: 'plugin_enabled',
          status: 'pass',
          title: `系统能力「${method.name}」可用`,
          detail: '系统级方法，无需安装插件即可调用。',
        });
        steps.push({
          step: 'method_exists',
          status: 'pass',
          title: `找到方法「${method.name}」`,
          detail: method.description,
        });
        const validation = this.validateParams(method, args);
        missingParams = validation.missing;
        paramErrors = validation.errors;
        paramsValid = validation.valid;
        if (paramsValid) {
          steps.push({
            step: 'params_check',
            status: 'pass',
            title: '参数校验通过',
            detail: '所有必填参数已提供，即将执行。',
          });
        } else {
          const parts: string[] = [];
          if (missingParams.length > 0) {
            const missingDetail = missingParams
              .map((name) => {
                const p = method!.params.find((pp) => pp.name === name);
                return p ? `• ${name}（${p.description}）` : `• ${name}`;
              })
              .join('\n');
            parts.push(`缺少必填参数：\n${missingDetail}`);
          }
          if (paramErrors.length > 0) {
            parts.push(`参数错误：${paramErrors.join('；')}`);
          }
          steps.push({
            step: 'params_check',
            status: 'fail',
            title: '参数不完整，需要补充信息',
            detail: parts.join('\n\n'),
          });
        }
        return {
          steps,
          pluginEnabled,
          methodExists,
          paramsValid,
          method,
          missingParams,
          paramErrors,
          pluginName,
        };
      }

      const plugin = allPlugins.find(
        (p) => p.pluginKey === method.pluginKey && p.lifecycleStatus === 'active',
      );
      pluginName = plugin?.name || this.getPluginDisplayName(method.pluginKey);
      pluginEnabled = !!plugin;

      steps.push({
        step: 'plugin_enabled',
        status: pluginEnabled ? 'pass' : 'fail',
        title: pluginEnabled
          ? `插件「${pluginName}」已启用`
          : `插件「${pluginName}」未启用`,
        detail: pluginEnabled
          ? `插件键：${method.pluginKey}`
          : `该插件尚未启用或安装，无法使用其功能。`,
      });

      if (pluginEnabled) {
        methodExists = true;
        steps.push({
          step: 'method_exists',
          status: 'pass',
          title: `找到方法「${method.name}」`,
          detail: method.description,
        });

        const validation = this.validateParams(method, args);
        missingParams = validation.missing;
        paramErrors = validation.errors;
        paramsValid = validation.valid;

        if (paramsValid) {
          steps.push({
            step: 'params_check',
            status: 'pass',
            title: '参数校验通过',
            detail: '所有必填参数已提供，即将执行。',
          });
        } else {
          const parts: string[] = [];
          if (missingParams.length > 0) {
            const missingDetail = missingParams
              .map((name) => {
                const p = method!.params.find((pp) => pp.name === name);
                return p ? `• ${name}（${p.description}）` : `• ${name}`;
              })
              .join('\n');
            parts.push(`缺少必填参数：\n${missingDetail}`);
          }
          if (paramErrors.length > 0) {
            parts.push(`参数错误：${paramErrors.join('；')}`);
          }
          steps.push({
            step: 'params_check',
            status: 'fail',
            title: '参数不完整，需要补充信息',
            detail: parts.join('\n\n'),
          });
        }
      }
    } else {
      const guessedPluginKey = methodId.split('.')[0];
      const allPluginList = await this.pluginsService.findAll();
      const maybePlugin = allPluginList.items.find((p) =>
        p.pluginKey.includes(guessedPluginKey),
      );
      pluginName = maybePlugin?.name || guessedPluginKey;

      steps.push({
        step: 'plugin_enabled',
        status: 'fail',
        title: `未找到对应的插件或方法`,
        detail: `无法识别的方法：${methodId}。请检查插件是否已安装，或是否存在该方法。`,
      });
    }

    return {
      steps,
      pluginEnabled,
      methodExists,
      paramsValid,
      method,
      missingParams,
      paramErrors,
      pluginName,
    };
  }

  private getPluginDisplayName(pluginKey: string): string {
    const nameMap: Record<string, string> = {
      'dsh-plugin-child-resources': '儿童资料站',
      'dsh-plugin-life-dashboard': '人生管理看板',
      'dsh-plugin-wechat-rpa': 'RPA 创作中心',
      'dsh-plugin-review-board': '复盘面板',
    };
    return nameMap[pluginKey] || pluginKey;
  }

  getAllMethods(): PluginMethod[] {
    return Array.from(this.methods.values()).map((h) => h.method);
  }

  getMethod(methodId: string): PluginMethod | null {
    const handler = this.methods.get(methodId);
    return handler ? handler.method : null;
  }

  validateParams(method: PluginMethod, args: Record<string, unknown>): { valid: boolean; missing: string[]; errors: string[] } {
    const missing: string[] = [];
    const errors: string[] = [];

    for (const param of method.params) {
      const value = args[param.name];

      if (param.required && (value === undefined || value === null || value === '')) {
        missing.push(param.name);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (param.enum && param.enum.length > 0) {
        if (!param.enum.includes(String(value))) {
          errors.push(`${param.name} 的值 ${String(value)} 不在允许的枚举范围内，可选值：${param.enum.join('、')}`);
        }
      }

      switch (param.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${param.name} 应该是字符串类型`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`${param.name} 应该是数字类型`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${param.name} 应该是布尔类型`);
          }
          break;
      }
    }

    return { valid: missing.length === 0 && errors.length === 0, missing, errors };
  }

  async executeMethod(
    methodId: string,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<unknown> {
    const handler = this.methods.get(methodId);
    if (!handler) {
      throw new NotFoundException(`方法 ${methodId} 不存在`);
    }

    const method = handler.method;

    // 系统级方法：跳过插件安装/启用检查
    if (method.system) {
      const { valid, missing, errors } = this.validateParams(method, args);
      if (!valid) {
        const messages: string[] = [];
        if (missing.length > 0) {
          messages.push(`缺少必填参数：${missing.join('、')}`);
        }
        if (errors.length > 0) {
          messages.push(...errors);
        }
        throw new BadRequestException(messages.join('；'));
      }
      return handler.execute(args, userId);
    }

    const { items: installedPlugins } = await this.pluginsService.getInstalledPlugins();
    const isInstalled = installedPlugins.some((p) => p.pluginKey === method.pluginKey && p.lifecycleStatus === 'active');
    if (!isInstalled) {
      throw new ForbiddenException(`插件 ${method.pluginKey} 未安装或未启用，无法调用该方法`);
    }

    const { valid, missing, errors } = this.validateParams(method, args);
    if (!valid) {
      const messages: string[] = [];
      if (missing.length > 0) {
        messages.push(`缺少必填参数：${missing.join('、')}`);
      }
      if (errors.length > 0) {
        messages.push(...errors);
      }
      throw new BadRequestException(messages.join('；'));
    }

    return handler.execute(args, userId);
  }

  // ===== 番茄钟记录 =====

  private registerPomodoroMethods(): void {
    const pluginKey = 'dsh-plugin-pomodoro';

    this.register({
      id: 'pomodoro.addRecord',
      name: '记录番茄专注',
      description: '记录一次番茄钟专注，自动计算开始时间',
      pluginKey,
      params: [
        { name: 'durationMinutes', type: 'number', required: true, description: '专注时长（分钟），必填，如 25' },
        { name: 'taskName', type: 'string', required: false, description: '专注任务名称，默认"未命名专注"' },
        { name: 'completedAt', type: 'string', required: false, description: '完成时间 ISO 字符串，默认当前时间' },
        { name: 'abandoned', type: 'boolean', required: false, description: '是否放弃（未完成），默认 false' },
      ],
    }, async (args) => {
      const completedAt = typeof args.completedAt === 'string' ? args.completedAt : new Date().toISOString();
      return this.pomodoroService.createRecord({
        durationMinutes: Number(args.durationMinutes),
        taskName: typeof args.taskName === 'string' ? args.taskName : undefined,
        completedAt,
        abandoned: typeof args.abandoned === 'boolean' ? args.abandoned : undefined,
      });
    });

    this.register({
      id: 'pomodoro.listRecords',
      name: '查询番茄钟记录',
      description: '查询番茄钟专注记录列表',
      pluginKey,
      params: [],
    }, async () => {
      const records = await this.pomodoroService.getRecords();
      return { items: records, total: records.length };
    });

    this.register({
      id: 'pomodoro.getStats',
      name: '番茄钟统计',
      description: '获取番茄钟专注统计（今日专注、累计专注、完成次数等）',
      pluginKey,
      params: [],
    }, async () => {
      return this.pomodoroService.getStats();
    });
  }

  // ===== 时间黑洞 =====

  private registerTimeBlackholeMethods(): void {
    const pluginKey = 'dsh-plugin-time-blackhole';

    this.register({
      id: 'time-blackhole.addRecord',
      name: '记录浪费时间',
      description: '诚实记录一次被浪费的时间（发呆、刷短视频、八卦闲聊等）',
      pluginKey,
      params: [
        { name: 'category', type: 'string', required: true, description: '浪费类型，必填。可选值：idle（发呆）、shortvideo（刷短视频）、gossip（八卦闲聊）、other（其他）', enum: ['idle', 'shortvideo', 'gossip', 'other'] },
        { name: 'durationMinutes', type: 'number', required: true, description: '浪费时长（分钟），必填' },
        { name: 'note', type: 'string', required: false, description: '备注说明' },
        { name: 'recordDate', type: 'string', required: false, description: '记录日期，格式 YYYY-MM-DD，默认今天' },
      ],
    }, async (args) => {
      return this.timeBlackholeService.createRecord({
        category: String(args.category),
        durationMinutes: Number(args.durationMinutes),
        note: typeof args.note === 'string' ? args.note : undefined,
        recordDate: typeof args.recordDate === 'string' ? args.recordDate : undefined,
      });
    });

    this.register({
      id: 'time-blackhole.listRecords',
      name: '查询浪费时间记录',
      description: '查询时间黑洞的浪费时间记录，可按日期筛选',
      pluginKey,
      params: [
        { name: 'recordDate', type: 'string', required: false, description: '记录日期，格式 YYYY-MM-DD，默认查询全部' },
      ],
    }, async (args) => {
      const records = await this.timeBlackholeService.getRecords(
        typeof args.recordDate === 'string' ? args.recordDate : undefined,
      );
      return { items: records, total: records.length };
    });

    this.register({
      id: 'time-blackhole.getStats',
      name: '时间黑洞统计',
      description: '获取浪费时间统计（今日浪费分钟数、累计浪费、分类占比）',
      pluginKey,
      params: [],
    }, async () => {
      return this.timeBlackholeService.getStats();
    });
  }

  // ===== RPA 管理 =====

  private registerRpaManagerMethods(): void {
    const pluginKey = 'dsh-plugin-rpa-manager';

    this.register({
      id: 'rpa-manager.listFiles',
      name: '查看已保存的Excel文件',
      description: '列出 RPA 管理中本地已保存的 Excel 文件清单',
      pluginKey,
      params: [],
    }, async () => {
      return this.rpaManagerService.listFiles();
    });

    this.register({
      id: 'rpa-manager.readExcel',
      name: '读取Excel文件内容',
      description: '读取 RPA 管理中已保存的 Excel 文件，返回各工作表（sheet）的表头与全部行数据',
      pluginKey,
      params: [
        { name: 'fileName', type: 'string', required: true, description: '已保存的 Excel 文件名，如 数据.xlsx，必填' },
      ],
    }, async (args) => {
      const fileName = String(args.fileName ?? '');
      if (!fileName) throw new BadRequestException('缺少 fileName 参数');
      const data = this.rpaManagerService.readSavedFile(fileName);
      return {
        fileName: data.fileName,
        sheets: data.sheets.map((s) => ({
          name: s.name,
          headers: s.headers,
          rows: s.rows.slice(0, 200), // AI 展示上限 200 行
          totalRows: s.rows.length,
        })),
      };
    });

    this.register({
      id: 'rpa-manager.editCell',
      name: '修改Excel单元格',
      description: '修改 RPA 本地文件库中已登记 Excel 文件（按路径定位）的单元格，写入新值并保存（直接写回原文件）',
      pluginKey,
      params: [
        { name: 'path', type: 'string', required: true, description: '本地文件库登记的文件绝对路径，必填（可在 RPA 管理-本地文件库中查看）' },
        { name: 'sheetName', type: 'string', required: true, description: '工作表名称，如 Sheet1，必填' },
        { name: 'rowIndex', type: 'number', required: true, description: '行号（从 0 开始，0 为表头行），必填' },
        { name: 'colIndex', type: 'number', required: true, description: '列号（从 0 开始），必填' },
        { name: 'value', type: 'string', required: true, description: '要写入的单元格新值，必填' },
      ],
    }, async (args) => {
      const filePath = String(args.path ?? '');
      const sheetName = String(args.sheetName ?? '');
      const rowIndex = Number(args.rowIndex);
      const colIndex = Number(args.colIndex);
      const value = String(args.value ?? '');
      if (!filePath || !sheetName) throw new BadRequestException('缺少 path 或 sheetName');
      if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new BadRequestException('rowIndex 必须是 >= 0 的整数');
      if (!Number.isInteger(colIndex) || colIndex < 0) throw new BadRequestException('colIndex 必须是 >= 0 的整数');

      const data = this.rpaManagerService.readSavedFile(filePath);
      const sheet = data.sheets.find((s) => s.name === sheetName);
      if (!sheet) throw new BadRequestException(`工作表 ${sheetName} 不存在`);
      if (rowIndex >= sheet.rows.length) throw new BadRequestException(`行号 ${rowIndex} 超出范围（共 ${sheet.rows.length} 行）`);

      const updatedRows = sheet.rows.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
      );

      const allSheets = data.sheets.map((s) =>
        s.name === sheetName ? { name: s.name, rows: updatedRows } : { name: s.name, rows: s.rows },
      );

      return this.rpaManagerService.saveExcel({ path: filePath, sheets: allSheets });
    });

    this.register({
      id: 'rpa-manager.addRow',
      name: '在Excel中追加行',
      description: '在 RPA 本地文件库中已登记 Excel 文件（按路径定位）的工作表末尾追加一行数据并保存（直接写回原文件）',
      pluginKey,
      params: [
        { name: 'path', type: 'string', required: true, description: '本地文件库登记的文件绝对路径，必填（可在 RPA 管理-本地文件库中查看）' },
        { name: 'sheetName', type: 'string', required: true, description: '工作表名称，必填' },
        { name: 'values', type: 'array', required: true, description: '新行的单元格值数组，按列顺序，必填' },
      ],
    }, async (args) => {
      const filePath = String(args.path ?? '');
      const sheetName = String(args.sheetName ?? '');
      const values = Array.isArray(args.values) ? args.values.map((v) => String(v ?? '')) : [];
      if (!filePath || !sheetName) throw new BadRequestException('缺少 path 或 sheetName');
      if (values.length === 0) throw new BadRequestException('values 不能为空');

      const data = this.rpaManagerService.readSavedFile(filePath);
      const sheet = data.sheets.find((s) => s.name === sheetName);
      if (!sheet) throw new BadRequestException(`工作表 ${sheetName} 不存在`);

      const allSheets = data.sheets.map((s) =>
        s.name === sheetName ? { name: s.name, rows: [...s.rows, values] } : { name: s.name, rows: s.rows },
      );

      return this.rpaManagerService.saveExcel({ path: filePath, sheets: allSheets });
    });
  }

  // ===== 数据洞察 =====

  private registerInsightsMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'insights.getSummary',
      name: '数据洞察总览',
      description: '获取人生数据洞察汇总：近91天习惯打卡热力图、近30天番茄专注与时间浪费趋势、目标进度、今日打卡数等',
      pluginKey,
      params: [],
    }, async () => {
      return this.insightsService.getSummary();
    });
  }

  // ===== 自动复盘 =====

  private registerReviewMethods(): void {
    const pluginKey = 'dsh-plugin-life-dashboard';

    this.register({
      id: 'review.generate',
      name: '生成复盘',
      description: '根据当日或本周数据生成复盘总结（含习惯打卡、专注、浪费时间、目标进度），有 AI 配置时由 AI 生成个性化总结',
      pluginKey,
      params: [
        {
          name: 'type',
          type: 'string',
          required: false,
          description: '复盘类型，可选值：daily（每日）、weekly（每周），默认 daily',
          enum: ['daily', 'weekly'],
        },
        {
          name: 'date',
          type: 'string',
          required: false,
          description: '复盘日期，格式 YYYY-MM-DD，默认今天',
        },
      ],
    }, async (args: Record<string, unknown>) => {
      return this.reviewService.generate(
        args.type === 'weekly' ? 'weekly' : 'daily',
        args.date ? String(args.date) : undefined,
      );
    });

    this.register({
      id: 'review.list',
      name: '查询复盘记录',
      description: '查询历史复盘记录列表',
      pluginKey,
      params: [],
    }, async () => {
      return this.reviewService.list();
    });

    this.register({
      id: 'review.getToday',
      name: '查询今日复盘状态',
      description: '查询今日是否已生成复盘、是否到提醒时间以及提醒设置',
      pluginKey,
      params: [],
    }, async () => {
      return this.reviewService.getToday();
    });

    this.register({
      id: 'review.updateSettings',
      name: '修改复盘提醒设置',
      description: '修改每日/每周复盘提醒的开关与时间，以及是否到点自动生成',
      pluginKey,
      params: [
        {
          name: 'dailyReminderEnabled',
          type: 'boolean',
          required: false,
          description: '是否开启每日复盘提醒',
        },
        {
          name: 'dailyReminderTime',
          type: 'string',
          required: false,
          description: '每日提醒时间，格式 HH:mm，如 21:00',
        },
        {
          name: 'weeklyReminderEnabled',
          type: 'boolean',
          required: false,
          description: '是否开启每周复盘提醒',
        },
        {
          name: 'weeklyReminderDay',
          type: 'number',
          required: false,
          description: '每周提醒日，0-6（0=周日），默认 0',
        },
        {
          name: 'weeklyReminderTime',
          type: 'string',
          required: false,
          description: '每周提醒时间，格式 HH:mm',
        },
        {
          name: 'autoGenerateEnabled',
          type: 'boolean',
          required: false,
          description: '到点是否自动生成复盘，默认 true',
        },
      ],
    }, async (args: Record<string, unknown>) => {
      return this.reviewService.saveSettings({
        dailyReminderEnabled:
          typeof args.dailyReminderEnabled === 'boolean' ? args.dailyReminderEnabled : undefined,
        dailyReminderTime:
          typeof args.dailyReminderTime === 'string' ? args.dailyReminderTime : undefined,
        weeklyReminderEnabled:
          typeof args.weeklyReminderEnabled === 'boolean' ? args.weeklyReminderEnabled : undefined,
        weeklyReminderDay:
          typeof args.weeklyReminderDay === 'number' ? args.weeklyReminderDay : undefined,
        weeklyReminderTime:
          typeof args.weeklyReminderTime === 'string' ? args.weeklyReminderTime : undefined,
        autoGenerateEnabled:
          typeof args.autoGenerateEnabled === 'boolean' ? args.autoGenerateEnabled : undefined,
      });
    });
  }

  // ===== GTD 任务-番茄钟联动 =====

  private registerReviewBoardMethods(): void {
    const pluginKey = 'dsh-plugin-review-board';
    const levelParam: PluginMethodParam = {
      name: 'level',
      type: 'string',
      required: true,
      description: '面板层级，必填。可选值：daily（每日）、weekly（每周）、monthly（每月）',
      enum: ['daily', 'weekly', 'monthly'],
    };

    this.register({
      id: 'review-board.savePanel',
      name: '保存复盘内容',
      description: '保存复盘面板内容：daily 为某日正文（支持 Markdown 与任务清单 [ ]），weekly/monthly 为周/月总结区',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key：daily 为日期 YYYY-MM-DD；weekly 为周 YYYY-Www；monthly 为月 YYYY-MM，必填' },
        { name: 'content', type: 'string', required: true, description: 'Markdown 正文，必填。任务清单用 [ ] 未完成 / [x] 已完成' },
      ],
    }, async (args) => {
      const level = String(args.level) as 'daily' | 'weekly' | 'monthly';
      const key = String(args.key ?? '');
      const content = String(args.content ?? '');
      if (!key) throw new BadRequestException('key 不能为空');
      return this.reviewBoardService.savePanel(level, key, content);
    });

    this.register({
      id: 'review-board.toggleItem',
      name: '勾选复盘任务',
      description: '勾选/取消复盘面板中的任务项，勾选完成会记录完成时间',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key（同保存复盘内容）' },
        { name: 'itemId', type: 'string', required: true, description: '任务项 ID（可从查看面板数据中获取），必填' },
        { name: 'done', type: 'boolean', required: true, description: '是否完成：true 勾选完成 / false 取消' },
      ],
    }, async (args) => {
      return this.reviewBoardService.toggleItem(
        String(args.level) as 'daily' | 'weekly' | 'monthly',
        String(args.key ?? ''),
        String(args.itemId ?? ''),
        !!args.done,
      );
    });

    this.register({
      id: 'review-board.getView',
      name: '查看复盘面板',
      description: '查看复盘面板视图：内容、任务列表（含完成状态与完成时间）、归档快照、未归档子面板、完成统计',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key（同保存复盘内容）' },
      ],
    }, async (args) => {
      return this.reviewBoardService.getBoardView(
        String(args.level) as 'daily' | 'weekly' | 'monthly',
        String(args.key ?? ''),
      );
    });

    this.register({
      id: 'review-board.archive',
      name: '归档复盘面板',
      description: '手动归档：daily 归档到其所属周面板，weekly 归档到其所属月面板（自动归档之外可手动触发）',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key（同保存复盘内容）' },
      ],
    }, async (args) => {
      return this.reviewBoardService.archive(
        String(args.level) as 'daily' | 'weekly' | 'monthly',
        String(args.key ?? ''),
      );
    });

    this.register({
      id: 'review-board.createShareLink',
      name: '创建分享链接',
      description: '创建复盘面板的分享链接：view 为只读链接（外网仅查看），edit 为可编辑链接（外网可勾选任务写回状态）',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key（同保存复盘内容）' },
        { name: 'mode', type: 'string', required: true, description: '链接类型，必填。view=只读 / edit=可编辑', enum: ['view', 'edit'] },
      ],
    }, async (args) => {
      const mode = String(args.mode) === 'edit' ? 'edit' : 'view';
      return this.reviewBoardService.createShareLink(
        String(args.level) as 'daily' | 'weekly' | 'monthly',
        String(args.key ?? ''),
        mode,
      );
    });

    this.register({
      id: 'review-board.exportPublish',
      name: '生成发布包',
      description: '生成复盘面板的自包含 HTML 发布包（可交给 ShareOne 发布公网短链），view 只读 / edit 可编辑（外网勾选后通过评论区提交状态）',
      pluginKey,
      params: [
        levelParam,
        { name: 'key', type: 'string', required: true, description: '面板 key（同保存复盘内容）' },
        { name: 'mode', type: 'string', required: false, description: '发布包类型，默认 view。view=只读 / edit=可编辑', enum: ['view', 'edit'] },
      ],
    }, async (args) => {
      const mode = String(args.mode) === 'edit' ? 'edit' : 'view';
      return this.reviewBoardService.exportPublishBundle(
        String(args.level) as 'daily' | 'weekly' | 'monthly',
        String(args.key ?? ''),
        mode,
      );
    });
  }

  private registerTaskFocusMethods(): void {
    this.register({
      id: 'tasks.getFocusStats',
      name: '查询任务专注统计',
      description: '查询 GTD 任务关联的番茄钟专注统计（每个任务的专注次数与分钟数）',
      pluginKey: 'dsh-plugin-life-dashboard',
      params: [],
    }, async () => {
      return this.tasksService.getFocusStats();
    });
  }

  // ===== 儿童定时播放 =====

  private registerChildTvMethods(): void {
    const pluginKey = 'dsh-plugin-child-tv';

    const resolveScheduleId = (args: Record<string, unknown>): string => {
      const id = typeof args.scheduleId === 'string' ? args.scheduleId : '';
      if (id) return id;
      const name = typeof args.name === 'string' ? args.name : '';
      if (!name) throw new Error('请提供 scheduleId（时段 ID）或 name（时段名称）');
      const found = this.childTvService.getSchedules().find(
        (s) => s.name.includes(name) || name.includes(s.name),
      );
      if (!found) throw new Error(`未找到名称为「${name}」的时段`);
      return found.id;
    };

    this.register({
      id: 'child-tv.listSchedules',
      name: '查询播放时段',
      description: '查询儿童定时播放的全部时段（名称、开始时间、时长、内容来源、启用状态）',
      pluginKey,
      params: [],
    }, async () => {
      const items = this.childTvService.getSchedules();
      return { items, total: items.length };
    });

    this.register({
      id: 'child-tv.playNow',
      name: '立即播放',
      description: '家长远程立即播放指定时段内容（本地文件夹合集/单文件/URL），可传时段名称',
      pluginKey,
      params: [
        { name: 'scheduleId', type: 'string', required: false, description: '时段 ID，与名称二选一' },
        { name: 'name', type: 'string', required: false, description: '时段名称，与 ID 二选一（支持模糊匹配，如"纪录片"）' },
      ],
    }, async (args) => {
      const status = await this.childTvService.playNow(resolveScheduleId(args));
      return {
        success: true,
        playing: status.playing,
        currentTitle: status.currentTitle,
        remainingMinutes: status.remainingMinutes,
      };
    });

    this.register({
      id: 'child-tv.stop',
      name: '停止播放',
      description: '停止当前播放内容并解除随播放的自动锁定',
      pluginKey,
      params: [],
    }, async () => {
      return this.childTvService.stopPlayback('AI 家长指令停止');
    });

    this.register({
      id: 'child-tv.getStatus',
      name: '查询播放状态',
      description: '查询儿童定时播放的实时状态（是否播放、当前内容、剩余分钟、下一时段、锁定状态、mpv 是否可用）',
      pluginKey,
      params: [],
    }, async () => {
      return this.childTvService.getRuntimeStatus();
    });

    this.register({
      id: 'child-tv.lock',
      name: '锁定电脑',
      description: '家长远程锁定电脑（键鼠失效，屏幕保持），用于孩子观看期间防止乱动',
      pluginKey,
      params: [
        { name: 'minutes', type: 'number', required: false, description: '锁定时长（分钟），默认 240，最长 1440' },
      ],
    }, async (args) => {
      const minutes = Number(args.minutes) || this.childTvService.readSettings().defaultLockMinutes;
      return this.childTvService.startLock(minutes, 'manual');
    });

    this.register({
      id: 'child-tv.unlock',
      name: '解锁电脑',
      description: '解除当前锁定（手动锁与随播放自动锁）',
      pluginKey,
      params: [],
    }, async () => {
      return this.childTvService.unlock();
    });

    this.register({
      id: 'child-tv.getStats',
      name: '查询播放统计',
      description: '查询儿童定时播放历史记录（每次播放的内容、开始/结束时间、时长）',
      pluginKey,
      params: [],
    }, async () => {
      const items = this.childTvService.getStats();
      return { items, total: items.length };
    });
  }

  // ===== 系统级方法（不绑定插件，注册即用） =====

  /**
   * 注册系统级方法：不依赖插件安装状态，对所有已登录用户可用。
   * 由依赖方（如 MarketService）在初始化时调用。
   */
  registerSystemMethod(
    method: PluginMethod,
    execute: (args: Record<string, unknown>, userId: string) => Promise<unknown>,
  ): void {
    this.register({ ...method, system: true }, execute);
  }
}
