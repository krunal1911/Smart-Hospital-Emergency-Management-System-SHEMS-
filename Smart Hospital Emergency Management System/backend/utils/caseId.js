// Generates a human-readable temporary Emergency Case ID, e.g. EMG-20260712-4821.
// Format: EMG-YYYYMMDD-<4 random digits>. Collision odds are astronomically
// low for this system's scale, but the controller re-checks uniqueness
// against the database before saving, regenerating if a clash ever occurs.
export const generateCaseNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit number

  return `EMG-${y}${m}${d}-${random}`;
};

export default generateCaseNumber;
