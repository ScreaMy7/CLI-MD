export function viewport(lines, requestedOffset, requestedHeight) {
  const content = lines.length === 0 ? [''] : lines;
  const height = Math.max(1, Math.floor(requestedHeight));
  const maximumOffset = Math.max(0, content.length - height);
  const offset = Math.min(maximumOffset, Math.max(0, Math.floor(requestedOffset)));
  const visible = content.slice(offset, offset + height);
  return {
    lines: visible,
    offset,
    start: offset + 1,
    end: offset + visible.length,
    total: content.length,
    height,
    maximumOffset,
  };
}

export function moveViewport(offset, key, pageHeight, totalLines) {
  const page = Math.max(1, pageHeight);
  const maximumOffset = Math.max(0, totalLines - page);
  let next = offset;
  if (key === 'up') next -= 1;
  if (key === 'down') next += 1;
  if (key === 'page-up') next -= page;
  if (key === 'page-down') next += page;
  if (key === 'top') next = 0;
  if (key === 'bottom') next = maximumOffset;
  return Math.min(maximumOffset, Math.max(0, next));
}
