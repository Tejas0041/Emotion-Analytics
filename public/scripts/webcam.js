document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('webcam');
  // Check if the browser supports getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Access the webcam
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;
      })
      .catch((error) => {
        console.error('Error accessing webcam:', error);
      });
  } else {
    console.error('getUserMedia is not supported in this browser');
  }

  const startButton= document.getElementById('start-button');
  const stopButton= document.getElementById('stop-button');

  startButton.addEventListener('click', ()=>{
    startButton.style.display= 'none';
    stopButton.style.display= 'block';
  });
});