// renderer-signup.js
window.onload = () => {
  const signUpButton = document.getElementById('submitSignUp');

  if (signUpButton) {
    signUpButton.addEventListener('click', () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      // 회원가입 요청을 메인 프로세스로 전송
      window.electronAPI.sendSignUpRequest({ email, password });
    });

    // 회원가입 성공 시 얼굴 등록 페이지로 이동
    window.electronAPI.onSignUpSuccess(() => {
      // 'navigate-to-signup-face' 이벤트를 메인 프로세스에 전송
      window.electronAPI.send('navigate-to-signup-face');
    });

    // 회원가입 실패 시 에러 메시지 표시
    window.electronAPI.onSignUpFailed((message) => {
      alert(`회원가입 실패: ${message}`);
    });
  }
};