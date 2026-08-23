import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

function contextFor(user: unknown): ExecutionContext {
  const handler = () => undefined;
  const controller = class TestController {};

  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ crmUser: user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows a user with the declared permission', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('invoice.view');
    const guard = new PermissionGuard(reflector);

    expect(
      guard.canActivate(
        contextFor({ isSuper: false, permissions: new Set(['invoice.view']) }),
      ),
    ).toBe(true);
  });

  it('allows super users without the declared permission', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('invoice.delete');
    const guard = new PermissionGuard(reflector);
    const hasPermission = jest.fn(() => {
      throw new Error('super users must not perform permission checks');
    });

    expect(
      guard.canActivate(
        contextFor({ isSuper: true, permissions: { has: hasPermission } }),
      ),
    ).toBe(true);
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('denies an authenticated user without the declared permission', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('invoice.delete');
    const guard = new PermissionGuard(reflector);

    expect(() =>
      guard.canActivate(
        contextFor({ isSuper: false, permissions: new Set(['invoice.view']) }),
      ),
    ).toThrow('Insufficient permission');
  });
});
