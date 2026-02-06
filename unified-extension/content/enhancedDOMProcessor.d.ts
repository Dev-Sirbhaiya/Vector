/**
 * Enhanced DOM Processor
 *
 * Transforms raw DOM into agent-friendly representations with:
 * - Spatial chunking with metadata
 * - Hierarchical context preservation
 * - Semantic grouping
 * - Relative positioning descriptions
 * - Visual landmarks
 * - Importance scoring
 * - Content container detection (cards, list items, articles)
 * - Button/link association with parent container content
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Uses targeted selectors (not querySelectorAll('*'))
 * - Only computes expensive operations on ~50-100 interactive elements
 * - Limits innerText calls on large containers
 * - Caps container detection count
 */
import type { SimplifiedDOM } from '@shared/types/messages';
/**
 * Main entry point: produce an enhanced SimplifiedDOM from the current page.
 * Uses targeted selectors for performance.
 */
export declare function buildEnhancedDOM(): SimplifiedDOM;
//# sourceMappingURL=enhancedDOMProcessor.d.ts.map