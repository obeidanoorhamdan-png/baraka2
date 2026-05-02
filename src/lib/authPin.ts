const PIN_AUTH_PREFIX = "Baraka2-PampPIN";

export const pinToAuthPassword = (pin: string) => {
  const clean = pin.replace(/\D/g, "").slice(0, 4);
  return `${PIN_AUTH_PREFIX}-${clean}-${clean.split("").reverse().join("")}`;
};
