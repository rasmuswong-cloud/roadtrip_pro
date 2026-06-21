import type { ItineraryNode } from '@/models';
import type { ReseplanrareSeedRow } from '@/data/reseplanrareSeed';

export type ReseplanrareImportPlan = {
  existingNodesBySourceRow: Map<number, ItineraryNode>;
  obsoleteNodes: ItineraryNode[];
};

export function planReseplanrareImport(
  nodes: ItineraryNode[],
  seedRows: ReseplanrareSeedRow[],
): ReseplanrareImportPlan {
  const seedRowsById = new Set(seedRows.map((row) => row.sourceRow));
  const existingNodesBySourceRow = new Map<number, ItineraryNode>();
  const obsoleteNodes: ItineraryNode[] = [];

  nodes.filter(isReseplanrareManagedNode).forEach((node) => {
    const sourceRow = getReseplanrareSourceRow(node);

    if (sourceRow === null || !seedRowsById.has(sourceRow)) {
      obsoleteNodes.push(node);
      return;
    }

    if (!existingNodesBySourceRow.has(sourceRow)) {
      existingNodesBySourceRow.set(sourceRow, node);
      return;
    }

    obsoleteNodes.push(node);
  });

  return { existingNodesBySourceRow, obsoleteNodes };
}

export function getReseplanrareSourceRow(node: ItineraryNode): number | null {
  const sourceRow = node.metadata.sourceRow;
  return typeof sourceRow === 'number' && Number.isInteger(sourceRow) ? sourceRow : null;
}

export function isReseplanrareManagedNode(node: ItineraryNode): boolean {
  return node.metadata.source === 'reseplanrare.xlsx' || getReseplanrareSourceRow(node) !== null;
}
