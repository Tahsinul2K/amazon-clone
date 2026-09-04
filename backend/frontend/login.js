const form = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
const submitButton = document.querySelector('#submit-button');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  submitButton.disabled = true;
  try {
    const response = await fetch(`/api/login/${data.get('role')}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email').trim(), password: data.get('password') })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    message.classList.add('success');
    message.textContent = result.message || 'Sign-in successful.';
  } catch (error) {
    message.textContent = error.message || 'A network error occurred. Please try again.';
  } finally { submitButton.disabled = false; }
});
