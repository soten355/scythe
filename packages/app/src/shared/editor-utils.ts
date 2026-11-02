// Helpers shared by the editors: export popup, questions and messages, adding to the game, HTML escaping, path updates.
import { BUILT_IN } from '../content/catalog';
import { addToLibrary, type Library, type LibraryKind } from '../content/library';
import { SaveStore } from '../saves/store';

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

let question: HTMLDialogElement | null = null;

/** Asks a yes/no question in the page (not a browser pop-up). Resolves true on Yes. */
export function ask(message: string): Promise<boolean> {
  if (!question) {
    question = document.createElement('dialog');
    question.style.width = 'min(360px, 90vw)';
    question.innerHTML = `
      <p style="margin-top:0"></p>
      <div class="row"><button data-act="no">No</button><button data-act="yes">Yes</button></div>`;
    question.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act) question!.close(act);
    });
    document.body.append(question);
  }
  const d = question;
  d.querySelector('p')!.textContent = message;
  d.returnValue = '';
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'yes'), { once: true }));
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

let notice: HTMLDialogElement | null = null;

/** Shows a message in the page with an OK button. */
export function tell(message: string): Promise<void> {
  if (!notice) {
    notice = document.createElement('dialog');
    notice.style.width = 'min(380px, 90vw)';
    notice.innerHTML = `<p style="margin-top:0"></p><div class="row"><button data-act="ok">OK</button></div>`;
    notice.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) notice!.close();
    });
    document.body.append(notice);
  }
  const d = notice;
  d.querySelector('p')!.textContent = message;
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(), { once: true }));
}

let textQuestion: HTMLDialogElement | null = null;

/** Asks for a line of text in the page. Resolves null on Cancel. */
export function askText(message: string, value: string): Promise<string | null> {
  if (!textQuestion) {
    textQuestion = document.createElement('dialog');
    textQuestion.style.width = 'min(380px, 90vw)';
    textQuestion.innerHTML = `
      <form method="dialog">
        <p style="margin-top:0"></p>
        <input type="text" style="width:100%;box-sizing:border-box;margin-bottom:10px">
        <div class="row"><button value="cancel" formnovalidate>Cancel</button><button value="ok">OK</button></div>
      </form>`;
    document.body.append(textQuestion);
  }
  const d = textQuestion;
  const input = d.querySelector('input')!;
  d.querySelector('p')!.textContent = message;
  input.value = value;
  d.returnValue = '';
  d.showModal();
  input.select();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'ok' && input.value.trim() ? input.value.trim() : null), { once: true }));
}

/**
 * Adds maps, factions, mats or cards to the player's library, for
 * the new game screen, and says what happened (`said` words it, given the
 * names added, when there's at least one). `replace`: that kind is replaced
 * as a whole rather than added to (a deck of cards).
 */
export async function addToGame(content: Library, said?: (added: string[]) => string, replace?: LibraryKind): Promise<void> {
  const store = new SaveStore();
  try {
    const before = await store.library();
    const { library, added } = addToLibrary(replace ? { ...before, [replace]: [] } : before, BUILT_IN, content);
    await store.putLibrary(library);
    await tell(
      added.length
        ? (said?.(added) ?? `Added ${added.join(', ')}. It can be picked on the new game screen.`)
        : 'Already in the game: this is exactly like one there now.',
    );
  } catch {
    await tell("It couldn't be added: this device's storage isn't available.");
  }
}
