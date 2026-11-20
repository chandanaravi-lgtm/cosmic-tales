/**
 * Tiny pub/sub bus. Modules talk through events instead of importing each
 * other, so future features (quiz mode, narration, badges, compare…) can
 * just listen in without rewiring anything.
 *
 * Events used today:
 *   machine:select {id, source}    machine:hover {id|null}
 *   view:home   view:body {id}     view:deepspace
 *   card:open {id}  card:close     timeline:open {id, index?}  timeline:close
 *   timeline:event {id, index, event}
 *   sound:toggle {on}
 */
class EventBus {
  #handlers = new Map();

  on(type, fn) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off(type, fn) {
    this.#handlers.get(type)?.delete(fn);
  }

  emit(type, payload) {
    for (const fn of [...(this.#handlers.get(type) || [])]) {
      try { fn(payload); } catch (e) { console.error(`[bus] ${type} handler failed`, e); }
    }
  }
}

export const bus = new EventBus();
