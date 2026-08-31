import { AppError } from '@/middleware/error-handler';
import * as componentRepo from './component.repository';

export async function listAllComponents(params: Record<string, any>) {
  return componentRepo.listAllComponents(params);
}

export async function createComponent(assetId: string, data: {
  componentName: string;
  model: string;
  serialNumber: string;
}) {
  // Validate inputs
  const componentName = String(data.componentName).trim();
  const model = String(data.model).trim();
  const serialNumber = String(data.serialNumber).trim();

  if (!componentName) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Component name is required.');
  }
  if (!model) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Model is required.');
  }
  if (!serialNumber) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Serial number is required.');
  }

  return componentRepo.createComponent(assetId, {
    componentName,
    model,
    serialNumber,
  });
}

export async function getComponentsByAssetId(assetId: string) {
  return componentRepo.getComponentsByAssetId(assetId);
}

export async function getComponentById(id: string) {
  return componentRepo.getComponentById(id);
}

export async function updateComponent(
  id: string,
  data: Partial<{
    componentName: string;
    model: string;
    serialNumber: string;
  }>,
) {
  // Validate inputs if provided
  if (data.componentName !== undefined) {
    const componentName = String(data.componentName).trim();
    if (!componentName) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Component name cannot be empty.');
    }
    data.componentName = componentName;
  }
  if (data.model !== undefined) {
    const model = String(data.model).trim();
    if (!model) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Model cannot be empty.');
    }
    data.model = model;
  }
  if (data.serialNumber !== undefined) {
    const serialNumber = String(data.serialNumber).trim();
    if (!serialNumber) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Serial number cannot be empty.');
    }
    data.serialNumber = serialNumber;
  }

  return componentRepo.updateComponent(id, data);
}

export async function deleteComponent(id: string) {
  return componentRepo.deleteComponent(id);
}

export async function deleteComponentsByAssetId(assetId: string) {
  return componentRepo.deleteComponentsByAssetId(assetId);
}
