import type { AuthUser } from '../shared/types';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      sessionToken?: string;
    }
  }
}

export {};
