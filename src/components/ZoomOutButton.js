import { STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { homeIcon } from './icons.js';

/**
 * Bottom-left "back to the whole solar system" button. Big enough to tap
 * easily; hidden on the home view and while the timeline (which has its own
 * Back / Close) is open. Visibility is pure CSS on body[data-view].
 */
export class ZoomOutButton {
  constructor(root) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'glass-btn zoom-out-btn';
    this.el.setAttribute('aria-label', STRINGS.homeAria);
    this.el.title = STRINGS.homeAria;
    this.el.innerHTML = `${homeIcon()}<span>${esc(STRINGS.zoomOut)}</span>`;
    this.el.addEventListener('click', () => bus.emit('view:home'));
    root.appendChild(this.el);
  }
}
