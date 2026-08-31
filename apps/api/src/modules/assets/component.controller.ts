import type { Request, Response, NextFunction } from 'express';
import * as service from './component.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

export async function listAllComponentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const components = await service.listAllComponents(req.query);
    res.json({ success: true, data: components });
  } catch (error) {
    next(error);
  }
}

export async function getComponentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const components = await service.getComponentsByAssetId(req.params.id as string);
    res.json({ success: true, data: components });
  } catch (error) {
    next(error);
  }
}

export async function createComponentController(req: Request, res: Response, next: NextFunction) {
  try {
    const component = await service.createComponent(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'CREATE',
      entityType: 'asset_component',
      entityId: component.id as string,
      description: `Component ${component.componentName} added to asset.`,
      newData: { componentName: component.componentName, model: component.model, serialNumber: component.serialNumber },
    });
    res.status(201).json({ success: true, data: component });
  } catch (error) {
    next(error);
  }
}

export async function updateComponentController(req: Request, res: Response, next: NextFunction) {
  try {
    const component = await service.updateComponent(req.params.componentId as string, req.body);
    if (!component) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'UPDATE',
      entityType: 'asset_component',
      entityId: req.params.componentId as string,
      description: `Component ${component.componentName} updated.`,
      newData: { componentName: component.componentName, model: component.model, serialNumber: component.serialNumber },
    });
    res.json({ success: true, data: component });
  } catch (error) {
    next(error);
  }
}

export async function deleteComponentController(req: Request, res: Response, next: NextFunction) {
  try {
    const component = await service.getComponentById(req.params.componentId as string);
    if (!component) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }
    await service.deleteComponent(req.params.componentId as string);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'DELETE',
      entityType: 'asset_component',
      entityId: req.params.componentId as string,
      description: `Component ${component.componentName} deleted from asset.`,
    });
    res.json({ success: true, message: 'Component deleted' });
  } catch (error) {
    next(error);
  }
}
