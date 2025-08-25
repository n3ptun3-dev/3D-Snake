export const isMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  // A common regex to detect most mobile devices.
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isPiBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  // A more robust check. The script creates a placeholder window.Pi object.
  // The Pi Browser "activates" it, adding methods like authenticate.
  // A regular browser will have the object but not this function.
  return typeof window.Pi?.authenticate === 'function';
};