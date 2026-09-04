const form = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
const submitButton = document.querySelector('#submit-button');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const role = data.get('role');
  const email = data.get('email').trim();
  const password = data.get('password');

  submitButton.disabled = true;
  submitButton.textContent = 'Signing in…';

  try {
    const response = await fetch(`/api/login/${role}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Unable to sign in.');
    }

    message.classList.remove('error');
    message.textContent = result.message || 'Sign-in successful.';
    // Replace this with the buyer/seller dashboard route when those pages exist.
    window.location.assign('/');
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.message || 'A network error occurred. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sign in';
  }
});
