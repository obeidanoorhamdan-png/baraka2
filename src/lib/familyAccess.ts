/** Every signed-in family may edit; access to individual rows remains protected by RLS. */
export const familyEditingAllowed = (authenticated: boolean) => authenticated;

export const canInsertFamilyMember = (actor: { id: string | null; canReview: boolean }, ownerId: string) =>
  actor.id !== null && (actor.id === ownerId || actor.canReview);