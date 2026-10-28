import { registerSW } from 'virtual:pwa-register';
import { ENGINE_VERSION } from '@scythe/engine';
import './style.css';

registerSW({ immediate: true });

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>Scythe — setup OK</h1>
  <p class="meta">engine v${ENGINE_VERSION}</p>
`;
