// play.html (older links and home-screen icons) opens the same app as index.html.
import '../shared/fill-screen';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import '../style.css';
import App from '../App.svelte';

registerSW({ immediate: true });

mount(App, { target: document.querySelector('#app')! });
