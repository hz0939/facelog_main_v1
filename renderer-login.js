window.onload = () => {
  const loginButton = document.getElementById('submitLogin');

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      const email = document.getElementById('email').value;

      if (!email) {
        alert('이메일을 입력하세요.');
        return;
      }

      // 이메일을 localStorage에 저장
      localStorage.setItem('userEmail', email);

      // 이메일을 전달하여 얼굴 인증 페이지로 이동
      window.location.href = `antispoofing.html?email=${encodeURIComponent(email)}`;
    });
  }
};