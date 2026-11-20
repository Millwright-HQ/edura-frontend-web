import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Matches the password rules observed on SkillsBridge (docs/02). The cap limits hashing cost. */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[0-9]/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a special character');

export const personNameSchema =z.string().trim().min(1).max(60).regex(/^[^#]+$/, 'Invalid name');

export const loginSchema = z.strictObject({
  host: z.string().min(1).max(300),
  email: emailSchema,
  // Not passwordSchema: older or wrong passwords must fail as bad credentials, not validation.
  password: z.string().min(1).max(128),
  keepSignedIn: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Sign-in can stop half way: the password was right but a code from the authenticator app is needed. */
export interface MfaChallengeDto {
  /** The person has MFA on: ask for a code. */
  mfaRequired?: true;
  /** The academy requires MFA and this person has not set it up yet: take them through setup. */
  mfaEnrolRequired?: true;
  /** A pass that lasts five minutes. Not a session. */
  mfaToken: string;
}
export type LoginResult = TokenPair | MfaChallengeDto;

const mfaToken = z.string().min(20).max(1000);
const mfaCode = z.string().trim().min(6).max(20);
export const mfaVerifySchema = z.strictObject({ mfaToken, code: mfaCode });
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export const mfaStartSchema = z.strictObject({ mfaToken });
export type MfaStartInput = z.infer<typeof mfaStartSchema>;
export const mfaCodeSchema = z.strictObject({ code: mfaCode });
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

export interface MfaSetupDto {
  /** Typed into the authenticator app by hand. */
  secret: string;
  /** The same thing as a link some apps open directly. */
  otpauthUrl: string;
}
export interface MfaStatusDto {
  enabled: boolean;
  /** True when this person's role requires it, so it cannot be turned off. */
  required: boolean;
  recoveryCodesLeft: number;
}
export interface MfaEnabledDto {
  /** Shown once. Each works one time if the phone is lost. */
  recoveryCodes: string[];
  /** Present when setup happened during sign-in: the session starts now. */
  tokens?: TokenPair;
}

export const refreshSchema = z.strictObject({ refreshToken: z.string().min(1).max(512) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.strictObject({
  host: z.string().min(1).max(300),
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.strictObject({
  token: z.string().min(1).max(512),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const roleInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(60).regex(/^[^#]+$/, 'Invalid name'),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.string().max(100)).max(200),
});
export type RoleInput = z.infer<typeof roleInputSchema>;

/** System role ids are snake_case names; custom role ids are ULIDs. */
export const roleIdSchema = z.string().regex(/^[A-Za-z0-9_]{1,40}$/, 'Invalid role id');

const roleIdsSchema = z.array(roleIdSchema).min(1).max(20);

export const createStaffSchema = z.strictObject({
  email: emailSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  roleIds: roleIdsSchema,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const setStaffRolesSchema = z.strictObject({ roleIds: roleIdsSchema });
export type SetStaffRolesInput = z.infer<typeof setStaffRolesSchema>;

export const createTenantAdminSchema = z.strictObject({
  email: emailSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
});
export type CreateTenantAdminInput = z.infer<typeof createTenantAdminSchema>;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(2048).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface TokenPair {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
  /** Epoch milliseconds when the session ends. */
  sessionExpiresAt: number;
  /** True for "keep me signed in": the session should survive closing the browser. */
  persistent: boolean;
}
