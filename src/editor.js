// Wraps a <textarea>: exposes get/set value and a debounced change callback.
export function createEditor(textarea, { onChange, delay = 150 } = {}) {
  let timer = null
  textarea.addEventListener('input', () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => onChange(textarea.value), delay)
  })
  return {
    getValue: () => textarea.value,
    setValue: (text) => { textarea.value = text },
  }
}
