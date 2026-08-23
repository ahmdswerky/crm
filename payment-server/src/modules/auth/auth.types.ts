export interface CrmAuthUser {
  readonly id: number;
  readonly isSuper: boolean;
  readonly roles: readonly string[];
  readonly permissions: ReadonlySet<string>;
}

export interface AuthenticatedRequest {
  readonly headers: {
    readonly authorization?: string;
  };
  crmUser?: CrmAuthUser;
}
