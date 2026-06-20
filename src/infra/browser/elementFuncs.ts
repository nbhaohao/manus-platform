// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/external/browser/playwright_browser_fun.py
// 两段 JS 在浏览器上下文里跑（page.evaluate）：
//   GET_INTERACTIVE_ELEMENTS_FUNC — 找出视口内可交互元素，打 data-manus-id 标签，返回 [{index,tag,text}]
//   GET_VISIBLE_CONTENT_FUNC     — 拿视口内可见元素 outerHTML，给 LLM 理解页面内容

export const GET_INTERACTIVE_ELEMENTS_FUNC = `() => {
  const interactiveElements = [];
  const viewportHeight = window.innerHeight;
  const viewportWidth  = window.innerWidth;
  const elements = document.querySelectorAll(
    'button, a, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])'
  );
  let idx = 0;
  for (let i = 0; i < elements.length; i++) {
    const el   = elements[i];
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    const tag  = el.tagName.toLowerCase();
    const text = (el.innerText || el.value || el.placeholder || el.alt || el.title || '[no text]')
                   .trim().slice(0, 100);
    el.setAttribute('data-manus-id', 'manus-element-' + idx);
    interactiveElements.push({ index: idx, tag, text });
    idx++;
  }
  return interactiveElements;
}`;

export const GET_VISIBLE_CONTENT_FUNC = `() => {
  const visible = [];
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const els = document.querySelectorAll('body *');
  for (let i = 0; i < els.length; i++) {
    const el   = els[i];
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) continue;
    if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    if (el.innerText || el.tagName === 'IMG' || el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
      visible.push(el.outerHTML);
    }
  }
  return '<div>' + visible.join(' ') + '</div>';
}`;
