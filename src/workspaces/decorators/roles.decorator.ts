import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../../prisma/generated/client';

export const ROLES_KEY = 'workspace_roles';
// Принимает список ролей, которым РАЗРЕШЕН доступ к эндпоинту
export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(ROLES_KEY, roles);
