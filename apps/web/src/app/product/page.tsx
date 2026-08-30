/**
 * `/product` is now the root.
 *
 * The overview moved to `/` when the site was made publicly deployable — the
 * console it used to sit beside needs a local harness and cannot be served to a
 * visitor. This redirect keeps every existing link, README reference and shared
 * URL working rather than 404ing them.
 */

import { permanentRedirect } from 'next/navigation';

const ProductRedirect = () => {
  permanentRedirect('/');
};

export default ProductRedirect;
