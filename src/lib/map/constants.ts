/**
 * Zoom at which individual prices replace cluster bubbles.
 *
 * Mirrors CLUSTER_MAX_ZOOM in the repository so the client can switch between
 * clusters and prices without a round trip. Kept here rather than imported from
 * the repository because that module is server-only.
 */
export const CLUSTER_MAX_ZOOM = 12.5;
