import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PluginsService } from './plugins.service';

const mockDb = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
};

describe('PluginsService', () => {
  let service: PluginsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        { provide: DRIZZLE_DATABASE, useValue: mockDb },
      ],
    }).compile();
    service = module.get<PluginsService>(PluginsService);
  });

  describe('installPlugin', () => {
    it('should throw NotFound when plugin does not exist', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
          insert: jest.fn().mockReturnThis(),
        };
        return fn(tx);
      });

      await expect(service.installPlugin('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw Conflict when plugin already enabled', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([
            {
              id: 'test-id',
              pluginKey: 'test-plugin',
              name: 'Test',
              enabled: true,
            },
          ]),
          insert: jest.fn().mockReturnThis(),
        };
        return fn(tx);
      });

      await expect(service.installPlugin('test-plugin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should install plugin successfully when disabled', async () => {
      const mockRow = {
        id: 'test-id',
        pluginKey: 'dsh-plugin-child-resources',
        name: '儿童资料站',
        description: 'test',
        enabled: true,
        version: '1.0.0',
        config: { cardTitle: 'x', cardIcon: 'y', routePath: '/z', gradientFrom: '#000', gradientTo: '#fff', cardDescription: 'd', category: 'edu' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx: any = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{ ...mockRow, enabled: false }]),
          insert: jest.fn().mockReturnThis(),
          onConflictDoUpdate: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([mockRow]),
          values: jest.fn().mockReturnThis(),
        };
        return fn(tx);
      });

      const result = await service.installPlugin('dsh-plugin-child-resources');
      expect(result.pluginKey).toBe('dsh-plugin-child-resources');
      expect(result.enabled).toBe(true);
    });

    it('should refuse to uninstall core plugin', async () => {
      await expect(
        service.uninstallPlugin('dsh-plugin-life-dashboard'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailablePlugins', () => {
    it('should return all plugins from database with installed flag', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      (mockDb as any).where?.mockReturnThis();
      const mockRows = [
        {
          id: '1',
          pluginKey: 'dsh-plugin-life-dashboard',
          name: 'Life Dashboard',
          description: '',
          enabled: true,
          version: '1.0.0',
          config: { cardTitle: 'A', cardIcon: 'b', routePath: '/', gradientFrom: '#000', gradientTo: '#fff', cardDescription: 'd', category: 'core' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          pluginKey: 'dsh-plugin-child-resources',
          name: 'Child Resources',
          description: '',
          enabled: false,
          version: '1.0.0',
          config: { cardTitle: 'B', cardIcon: 'c', routePath: '/child', gradientFrom: '#000', gradientTo: '#fff', cardDescription: 'e', category: 'edu' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockDb.select.mockReturnValue({ from: jest.fn().mockResolvedValue(mockRows) });

      const result = await service.getAvailablePlugins();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].installed).toBe(true);
      expect(result.items[1].installed).toBe(false);
      expect(result.items[0].isCore).toBe(true);
      expect(result.items[1].isCore).toBe(false);
    });
  });
});

import { BadRequestException } from '@nestjs/common';
