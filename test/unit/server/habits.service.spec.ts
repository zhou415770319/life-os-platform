import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { HabitsService } from './habits.service';

const mockDb = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  desc: jest.fn().mockReturnThis(),
};

describe('HabitsService', () => {
  let service: HabitsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HabitsService,
        { provide: DRIZZLE_DATABASE, useValue: mockDb },
      ],
    }).compile();
    service = module.get<HabitsService>(HabitsService);
  });

  describe('getHabits', () => {
    it('should return empty list when no habits', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getHabits();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return habits with correct shape', async () => {
      const mockRows = [
        {
          id: 'h1',
          name: '跑步',
          icon: '🏃',
          color: '#ef4444',
          frequency: 'daily',
          streakCount: 5,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue(mockRows),
      });

      const result = await service.getHabits();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('跑步');
      expect(result.items[0].streakCount).toBe(5);
      expect(typeof result.items[0].id).toBe('string');
    });
  });

  describe('toggleHabitRecord', () => {
    it('should create record when not exists', async () => {
      mockDb.transaction = jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx: any = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
          insert: jest.fn().mockReturnThis(),
          into: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          onConflictDoNothing: jest.fn().mockResolvedValue([{ id: 'r1' }]),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ id: 'h1', streakCount: 6 }]),
        };
        return fn(tx);
      });

      const result = await service.toggleHabitRecord('h1', '2024-01-01');
      expect(result).toBeDefined();
    });
  });

  describe('createHabit', () => {
    it('should create habit with default streak 0', async () => {
      const mockRow = {
        id: 'new-habit',
        name: '读书',
        icon: '📚',
        color: '#3b82f6',
        frequency: 'daily',
        streakCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.insert.mockReturnThis();
      mockDb.into = jest.fn().mockReturnThis();
      mockDb.values.mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockRow]),
      });

      const result = await service.createHabit({ name: '读书', icon: '📚' });
      expect(result.name).toBe('读书');
      expect(result.streakCount).toBe(0);
    });
  });
});
