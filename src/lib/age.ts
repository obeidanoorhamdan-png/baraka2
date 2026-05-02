export function calculateAge(birthDate: string | Date): number {
  if (!birthDate) return 0;
  const dob = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return Math.max(0, age);
}
