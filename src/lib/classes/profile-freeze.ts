export type ProfileFreezeBlock = {
  groupId: string;
  status: "active" | "trial" | "frozen";
  frozenOn?: string | null;
};

function held(block: ProfileFreezeBlock): boolean {
  return block.status === "frozen" || Boolean(block.frozenOn);
}

/** Which sub-classes a profile Freeze acts on, and which an Activate acts on. */
export function profileFreezePlan(blocks: ProfileFreezeBlock[]): {
  freezeGroupIds: string[];
  activateGroupIds: string[];
} {
  return {
    freezeGroupIds: blocks.filter((block) => !held(block)).map((block) => block.groupId),
    activateGroupIds: blocks.filter(held).map((block) => block.groupId),
  };
}
