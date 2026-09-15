import type { Instrumentation } from 'next';

/**
 * Server side error hook. Next calls this for failures during rendering, in
 * route handlers and in server actions, on every runtime. The tracker needs
 * Prisma, so it is only loaded on the Node runtime and only when asked for.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { captureError } = await import('./lib/errors');
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String((error as { digest: unknown }).digest) : undefined;
  await captureError(error, {
    source: 'server',
    path: request.path,
    context: {
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      digest,
    },
  });
};
