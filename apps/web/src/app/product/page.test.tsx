/**
 * The `/product` redirect, which is the only behaviour on this route.
 *
 * Asserted rather than eyeballed because the target is a bare string: pointing it
 * at the wrong path still compiles, still renders, and still returns a 308.
 */

import { describe, expect, it, vi } from 'vitest';

const permanentRedirect = vi.fn();
vi.mock('next/navigation', () => ({ permanentRedirect }));

const { default: ProductRedirect } = await import('./page');

describe('/product', () => {
  it('permanently redirects to the overview at the root', () => {
    ProductRedirect();

    // A temporary redirect would leave the old URL indexed and shared; the
    // overview moved for good when the console took over `/console`.
    expect(permanentRedirect).toHaveBeenCalledWith('/');
  });

  it('renders nothing of its own', () => {
    expect(ProductRedirect()).toBeUndefined();
  });
});
