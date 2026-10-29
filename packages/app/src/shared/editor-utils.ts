// Helpers shared by the editors: export popup, HTML escaping, path updates.

let dialog: HTMLDialogElement | null = null;

export function showExport(title: string, note: string, text: string) {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <h3 style="margin-top:0"></h3>
      <p style="font-size:0.85rem;opacity:0.8"></p>
      <textarea readonly></textarea>
      <div class="row"><button data-act="copy">Copy</button><button data-act="close">Close</button></div>`;
    dialog.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      const area = dialog!.querySelector('textarea')!;
      if (btn?.dataset.act === 'close') dialog!.close();
      if (btn?.dataset.act === 'copy') {
        try {
          await navigator.clipboard.writeText(area.value);
        } catch {
          area.select();
          document.execCommand('copy');
        }
        btn.textContent = 'Copied ✓';
      }
    });
    document.body.append(dialog);
  }
  dialog.querySelector('h3')!.textContent = title;
  dialog.querySelector('p')!.textContent = note;
  dialog.querySelector('textarea')!.value = text;
  dialog.querySelector<HTMLElement>('[data-act="copy"]')!.textContent = 'Copy';
  dialog.showModal();
}

/** Escapes text for use inside HTML attributes and content. */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Returns a copy of `obj` with the value at a dotted path (e.g. "sections.0.top.cost") replaced. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const next = JSON.parse(JSON.stringify(obj)) as T;
  const keys = path.split('.');
  const last = keys.pop()!;
  let target = next as Record<string, unknown>;
  for (const k of keys) target = target[k] as Record<string, unknown>;
  target[last] = value;
  return next;
}
