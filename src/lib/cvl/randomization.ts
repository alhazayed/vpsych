import { createHash, randomUUID } from "crypto";
import type { CvlArm, CvlReviewerType } from "@/lib/cvl/types";
import { CVL_ARMS } from "@/lib/cvl/types";

export type RandomizationBlock = {
  block_id: string;
  disorder_cluster: string;
  sequence: CvlArm[];
};

/** Deterministic block randomization (seeded). Arms balanced within each block. */
export function buildRandomizationBlocks(input: {
  seed: string;
  disorder_clusters: string[];
  arms?: CvlArm[];
  blocks_per_cluster?: number;
}): RandomizationBlock[] {
  const arms = input.arms ?? [...CVL_ARMS];
  const nBlocks = input.blocks_per_cluster ?? 2;
  const out: RandomizationBlock[] = [];
  let counter = 0;
  for (const cluster of input.disorder_clusters) {
    for (let b = 0; b < nBlocks; b++) {
      const blockSeed = `${input.seed}:${cluster}:${b}`;
      const sequence = shuffleArms(arms, blockSeed);
      out.push({
        block_id: `blk_${hash8(blockSeed)}_${counter++}`,
        disorder_cluster: cluster,
        sequence,
      });
    }
  }
  return out;
}

function shuffleArms(arms: CvlArm[], seed: string): CvlArm[] {
  const arr = [...arms];
  let h = hash32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function hash32(s: string): number {
  return (
    createHash("sha256").update(s).digest().readUInt32BE(0) >>> 0
  );
}

function hash8(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

/** Opaque reviewer token — never store email/name in CVL rating rows. */
export function mintReviewerToken(reviewerType: CvlReviewerType): string {
  return `rvw_${reviewerType.slice(0, 3)}_${randomUUID().replace(/-/g, "")}`;
}

export function allocateArmFromBlocks(
  blocks: RandomizationBlock[],
  disorderCluster: string,
  assignmentIndex: number,
): { arm: CvlArm; block_id: string } {
  const clusterBlocks = blocks.filter(
    (b) => b.disorder_cluster === disorderCluster,
  );
  if (!clusterBlocks.length) {
    const fallback = blocks[0];
    if (!fallback) {
      return { arm: "vpsych_avatar", block_id: "blk_unallocated" };
    }
    const arm = fallback.sequence[assignmentIndex % fallback.sequence.length]!;
    return { arm, block_id: fallback.block_id };
  }
  const block = clusterBlocks[assignmentIndex % clusterBlocks.length]!;
  const arm = block.sequence[assignmentIndex % block.sequence.length]!;
  return { arm, block_id: block.block_id };
}
