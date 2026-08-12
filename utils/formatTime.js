export function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const minutes = Math.floor(safeSeconds / 60)
  const restSeconds = Math.floor(safeSeconds % 60)
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`
}
