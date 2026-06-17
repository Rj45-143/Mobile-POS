export const generateTicketNumber = (): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.getTime().toString().slice(-5);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${datePart}${timePart}${randomPart}`;
};
