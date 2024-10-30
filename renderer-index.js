window.onload = () => {
  const signUpButton = document.getElementById('signUpButton');
  const loginButton = document.getElementById('loginButton');

  if (signUpButton) {
    signUpButton.addEventListener('click', () => {
      window.location.href = 'signup_credentials.html';
    });
  }

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }
};