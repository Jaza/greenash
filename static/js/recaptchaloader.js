ready(() => {
  const submitButton = document.getElementById('submit-after-recaptcha');

  if (submitButton == null) {
    return;
  }

  window.originalSubmitFormButtonText = submitButton.textContent;
  submitButton.textContent = 'Prepare to ' + window.originalSubmitFormButtonText;

  submitButton.addEventListener("click", e => {
    if (submitButton.textContent === window.originalSubmitFormButtonText) {
      return;
    }

    const agreeToCookiesMessage =
      'This will load Google reCAPTCHA, which will set cookies. Sadly, you will ' +
      'not be able to submit this form unless you agree. GDPR, not to mention ' +
      'basic human decency, dictates that you have a choice and a right to protect ' +
      'your privacy from the corporate overlords. Do you agree?';

    if (window.confirm(agreeToCookiesMessage)) {
      const recaptchaScript = document.createElement('script');
      recaptchaScript.setAttribute(
        'src',
        'https://www.google.com/recaptcha/api.js?onload=recaptchaOnloadCallback&render=explicit');
      recaptchaScript.setAttribute('async', '');
      recaptchaScript.setAttribute('defer', '');
      document.head.appendChild(recaptchaScript);
    }

    e.preventDefault();
  });
});
