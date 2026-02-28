export const isDev = () => process.env.NODE_ENV !== "production";

export const dlog = (...args: unknown[]) => {
  if (isDev()) console.log(...args);
};

export const dwarn = (...args: unknown[]) => {
  if (isDev()) console.warn(...args);
};

export const derr = (...args: unknown[]) => {
  if (isDev()) console.error(...args);
};
