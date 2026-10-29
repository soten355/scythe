import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import '../style.css';
import Game from './Game.svelte';

registerSW({ immediate: true });

mount(Game, { target: document.querySelector('#app')! });
