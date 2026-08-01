import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        name: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}
