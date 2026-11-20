export type UserKind = 'platform_staff' | 'tenant_admin' | 'tenant_staff' | 'parent' | 'student';

/** Claims every access token must carry, locally (own JWT issuer) and on AWS (Cognito). */
export interface AuthClaims {
  /** User id (ULID). */
  sub: string;
  scope: 'platform' | 'tenant';
  /** Present when scope is `tenant`. Never taken from request bodies. */
  tenantId?: string;
  kind: UserKind;
  roleIds: string[];
  /**
   * Bumped when the user's role assignment, status or password changes; stale tokens are rejected.
   * Edits to a role's permissions need no bump because permissions are resolved live per request.
   */
  permissionsVersion: number;
  iat: number;
  exp: number;
}
