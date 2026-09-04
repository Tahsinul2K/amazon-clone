const form = document.querySelector('#register-form');
const role = document.querySelector('#role');
const addressField = document.querySelector('#business-address-field');
const businessAddress = document.querySelector('#business-address');
const password = document.querySelector('#password');
const confirmPassword = document.querySelector('#confirm-password');
const message = document.querySelector('#form-message');
const submitButton = document.querySelector('#submit-button');

function updateAccountFields() {
  const isSeller = role.value === 'seller';
  addressField.hidden = !isSeller;
  businessAddress.required = isSeller;
}
role.addEventListener('change', updateAccountFields);
updateAccountFields();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.classList.remove('success');
  if (!form.reportValidity()) return;
  if (password.value !== confirmPassword.value) {
    confirmPassword.setCustomValidity('Passwords do not match.');
    form.reportValidity();
    confirmPassword.setCustomValidity('');
    return;
  }
  const data = new FormData(form);
  const accountType = data.get('role');
  const body = { fullName: data.get('fullName').trim(), email: data.get('email').trim(), password: data.get('password') };
  if (accountType === 'seller') body.businessAddress = data.get('businessAddress').trim();
  submitButton.disabled = true;
  try {
    const response = await fetch(`/api/register/${accountType}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Unable to create account.');
    window.location.assign('/');
  } catch (error) {
    message.textContent = error.message || 'A network error occurred. Please try again.';
  } finally { submitButton.disabled = false; }
});
