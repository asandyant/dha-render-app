(function () {
  const canvas = document.getElementById('signature-pad');
  const hiddenInput = document.getElementById('signatureData');
  const clearButton = document.getElementById('clear-signature');

  if (!canvas || !hiddenInput || !window.SignaturePad) return;

  const resizeCanvas = () => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear();
  };

  const signaturePad = new window.SignaturePad(canvas, {
    backgroundColor: 'rgb(255,255,255)',
    penColor: 'rgb(15,23,42)'
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  clearButton?.addEventListener('click', () => {
    signaturePad.clear();
    hiddenInput.value = '';
  });

  canvas.closest('form')?.addEventListener('submit', () => {
    hiddenInput.value = signaturePad.isEmpty() ? '' : signaturePad.toDataURL('image/png');
  });
})();
