// Camp contact numbers (E.164, no + or spaces for wa.me links)
export const ADMIN_WHATSAPP = "972592244588";   // +972 59-224-4588
export const SUPPORT_WHATSAPP = "972595440227"; // +972 59-544-0227

export const ADMIN_WHATSAPP_DISPLAY = "+972 59-224-4588";
export const SUPPORT_WHATSAPP_DISPLAY = "+972 59-544-0227";

export const waLink = (number: string, text?: string) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
