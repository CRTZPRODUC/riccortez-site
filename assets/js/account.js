// Account page: login / sign-up UI only. Nothing is submitted anywhere.
// Supabase Auth replaces the submit handler below in the next phase.
import { boot, icon, $, $$ } from './app.js';

boot({ active: 'conta' });

const tabs = $$('[data-auth-tab]');
const forms = $$('[data-auth-form]');

function show(which) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.authTab === which)));
  forms.forEach((f) => { f.hidden = f.dataset.authForm !== which; });
}

tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.authTab)));
if (location.hash === '#criar') show('signup');

$$('[data-pw-toggle]').forEach((b) => b.addEventListener('click', () => {
  const input = document.getElementById(b.dataset.pwToggle);
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  b.textContent = reveal ? 'Ocultar' : 'Mostrar';
  b.setAttribute('aria-label', reveal ? 'Ocultar senha' : 'Mostrar senha');
}));

const note = (form, msg) => {
  $('[data-note]', form).innerHTML = `${icon('info', 18)}<span>${msg}</span>`;
};

forms.forEach((form) => form.addEventListener('submit', (e) => {
  e.preventDefault();
  form.classList.add('was-submitted');
  const invalid = $$('input', form).find((i) => !i.checkValidity());
  if (invalid) {
    invalid.focus();
    note(form, 'Confira os campos destacados.');
    return;
  }
  note(form, 'Modelo visual: o login com Supabase Auth será ligado na próxima fase. Nenhum dado foi enviado.');
}));

$('[data-forgot]').addEventListener('click', (e) => {
  e.preventDefault();
  note($('[data-auth-form="login"]'), 'A recuperação de senha por e-mail chega com o Supabase Auth na próxima fase.');
});
