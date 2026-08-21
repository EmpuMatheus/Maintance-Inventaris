import type { Request, Response, NextFunction } from 'express';
import * as service from './master-data.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

export function list(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query;
      const result = await service.list(resource, {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        search: typeof q.search === 'string' ? q.search : undefined,
        sort: typeof q.sort === 'string' ? q.sort : undefined,
        order: q.order === 'asc' || q.order === 'desc' ? q.order : undefined,
        categoryId: typeof q.categoryId === 'string' ? q.categoryId : undefined,
        siteId: typeof q.siteId === 'string' ? q.siteId : undefined,
        buildingId: typeof q.buildingId === 'string' ? q.buildingId : undefined,
        floorId: typeof q.floorId === 'string' ? q.floorId : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

export function getById(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const row = await service.getById(resource, id);
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  };
}

export function create(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await service.create(resource, req.body);
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  };
}

export function update(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const row = await service.update(resource, id, req.body);
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  };
}

export function deactivate(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const row = await service.deactivate(resource, id);
      if (resource === 'categories') {
        auditFromRequest(req, {
          module: 'MASTER_DATA',
          action: 'DELETE',
          entityType: 'asset_category',
          entityId: id,
          description: `Asset category ${row.code} deleted.`,
          newData: { code: row.code, name: row.name },
        });
      }
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  };
}
