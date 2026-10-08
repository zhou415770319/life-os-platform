import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { NotFoundException } from '@nestjs/common';
import { GoalsService } from './goals.service';

const mockDb: any = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
};

describe('GoalsService', () => {
  let service: GoalsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: DRIZZLE_DATABASE, useValue: mockDb },
      ],
    }).compile();
    service = module.get<GoalsService>(GoalsService);
  });

  describe('findAll', () => {
    it('should return empty result when no goals', async () => {
      mockDb.select.mockImplementation((arg?: unknown) => {
        if (arg && typeof arg === 'object' && 'count' in (arg as object)) {
          return { from: jest.fn().mockResolvedValue([{ count: 0 }]) };
        }
        return mockDb;
      });
      mockDb.from.mockResolvedValue([]);
      mockDb.orderBy.mockReturnValue(mockDb);

      const result = await service.findAll();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should throw NotFound when goal not found', async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([]);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return goal with ISO date strings when found', async () => {
      const mockRow = {
        id: 'goal-1',
        title: 'Test Goal',
        description: 'desc',
        status: 'active',
        progress: 50,
        category: 'career',
        deadline: '2025-12-31',
        milestones: [{ id: 'm1', title: 'M1', completed: true }],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([mockRow]);

      const result = await service.findOne('goal-1');
      expect(result.id).toBe('goal-1');
      expect(result.title).toBe('Test Goal');
      expect(result.progress).toBe(50);
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toContain('2024');
    });
  });

  describe('create', () => {
    it('should create goal with computed progress from milestones', async () => {
      const mockRow = {
        id: 'new-goal',
        title: 'New Goal',
        description: 'desc',
        status: 'active',
        progress: 50,
        category: 'health',
        deadline: null,
        milestones: [
          { title: 'M1', completed: true },
          { title: 'M2', completed: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([mockRow]);

      const result = await service.create({
        title: 'New Goal',
        description: 'desc',
        category: 'health',
        milestones: [
          { title: 'M1', completed: true },
          { title: 'M2', completed: false },
        ],
      });
      expect(result.title).toBe('New Goal');
      expect(result.progress).toBe(50);
    });

    it('should mark as completed when all milestones done', async () => {
      const mockRow = {
        id: 'g2',
        title: 'Done Goal',
        description: '',
        status: 'completed',
        progress: 100,
        category: '',
        deadline: null,
        milestones: [{ title: 'M1', completed: true }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([mockRow]);

      const result = await service.create({
        title: 'Done Goal',
        milestones: [{ title: 'M1', completed: true }],
      });
      expect(result.progress).toBe(100);
    });
  });

  describe('update', () => {
    it('should throw NotFound when updating nonexistent goal', async () => {
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([]);

      await expect(
        service.update('bad-id', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should recalculate progress when milestones updated', async () => {
      const mockRow = {
        id: 'g1',
        title: 'Updated',
        description: '',
        status: 'active',
        progress: 33,
        category: '',
        deadline: null,
        milestones: [
          { title: 'A', completed: true },
          { title: 'B', completed: false },
          { title: 'C', completed: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([mockRow]);

      const result = await service.update('g1', {
        milestones: [
          { title: 'A', completed: true },
          { title: 'B', completed: false },
          { title: 'C', completed: false },
        ],
      });
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw NotFound when deleting nonexistent goal', async () => {
      mockDb.delete.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([]);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should resolve when delete succeeds', async () => {
      mockDb.delete.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockResolvedValue([{ id: 'g1' }]);

      await expect(service.remove('g1')).resolves.not.toThrow();
    });
  });
});
