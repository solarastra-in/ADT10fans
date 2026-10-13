// Built files carried inside the Vercel bundle, so the function needs nothing else from disk.
// esbuild inlines them: the .html as text, the .json as an object.
import template from '../dist/_template.html';
import firebaseConfig from '../firebase-applet-config.json';

(globalThis as any).__ADT10_TEMPLATE__ = template;
(globalThis as any).__ADT10_FIREBASE__ = firebaseConfig;
