const video = document.getElementById("video");
const videoContainer = document.getElementById("videoContainer");
let canvas = null;

var emotiondata = {
  'happy': 0, 
  'neutral': 0, 
  'sad': 0, 
  'angry': 0, 
  'fearful': 0, 
  'disgusted': 0, 
  'surprised': 0, 
  'total': 0,
  'startTime': null,
  'analysisTime': 0
};

// Load face-api models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/model"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/model"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/model"),
  faceapi.nets.faceExpressionNet.loadFromUri("/model"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/model")  // Add SSD MobileNet for better detection
]).then(() => {
  console.log('Face-API models loaded successfully');
  startWebcam();
}).catch(error => {
  console.error('Error loading models:', error);
});

function startWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support webcam access');
    return;
  }

  navigator.mediaDevices
    .getUserMedia({
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
      },
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
      video.play(); // Explicitly start playing
      
      // Wait for video to be loaded
      video.onloadeddata = () => {
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        // Setup canvas and start detection only after video is fully loaded
        setupCanvas();
        startDetection();
      };
      console.log('Webcam started successfully');
    })
    .catch((error) => {
      console.error('Error accessing webcam:', error);
      alert('Unable to access camera. Please check permissions.');
    });
}

// Remove the metadata listener since we're handling it in onloadeddata
video.addEventListener('play', () => {
  if (video.readyState === 4) { // HAVE_ENOUGH_DATA
    setupCanvas();
    startDetection();
  }
});

function setupCanvas() {
  // Create canvas if it doesn't exist
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'overlay';
    
    // Style the canvas to overlay perfectly on video
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    canvas.style.borderRadius = 'var(--border-radius-lg)';
    
    // Append to video container
    videoContainer.appendChild(canvas);
  }
  
  // Set canvas dimensions to match video's intrinsic size
  const displayWidth = video.videoWidth || video.offsetWidth;
  const displayHeight = video.videoHeight || video.offsetHeight;
  
  // Set both intrinsic and display dimensions
  canvas.width = video.videoWidth || displayWidth;
  canvas.height = video.videoHeight || displayHeight;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  
  console.log(`Canvas setup: ${canvas.width}x${canvas.height}`);
}

function startDetection() {
  // Set start time when detection begins
  emotiondata.startTime = Date.now();
  
  const detectInterval = setInterval(async () => {
    if (!video.videoWidth || !video.videoHeight || video.paused) {
      return;
    }
    
    // Update analysis time
    if (emotiondata.startTime) {
      emotiondata.analysisTime = (Date.now() - emotiondata.startTime) / 1000;
    }
    
    try {
      // Try both detectors for better face detection
      let detections;
      try {
        // First try with SSD MobileNet
        detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceExpressions();
          
        if (!detections || detections.length === 0) {
          // Fall back to TinyFaceDetector if no faces found
          detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.3
            }))
            .withFaceLandmarks()
            .withFaceExpressions();
        }
      } catch (err) {
        console.error('Face detection error:', err);
        return;
      }

      // Clear canvas and match dimensions
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (detections.length > 0) {
        // Get display size
        const displaySize = {
          width: video.videoWidth,
          height: video.videoHeight
        };
        
        // Match canvas size and scale detections
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Process emotions from first detection
        const expressions = resizedDetections[0].expressions;
        if (expressions) {
          const maxExpression = Object.keys(expressions).reduce((a, b) => 
            expressions[a] > expressions[b] ? a : b
          );
          
          // Update emotion data
          emotiondata[maxExpression] += 200;
          emotiondata['total'] += 200;
          updateInputValues();
        }
        
        // Draw detection boxes and expressions
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  }, 200);
  
  // Store interval ID for cleanup
  video.detectionInterval = detectInterval;
}

const updateInputValues = () => {
  // Update analysis time display
  const analysisTimeElement = document.querySelector('.analysis-time');
  if (analysisTimeElement) {
    analysisTimeElement.textContent = emotiondata.analysisTime.toFixed(1);
  }
  
  var total = document.getElementById('total').value = emotiondata['total'];

  var happyInput = document.getElementById('happy');
  happyInput.value = emotiondata['happy']

  var sadInput= document.getElementById('sad');
  sadInput.value= emotiondata['sad']

  var angryInput= document.getElementById('angry');
  angryInput.value= emotiondata['angry']

  var disgustedInput= document.getElementById('disgusted');
  disgustedInput.value= emotiondata['disgusted']

  var neutralInput= document.getElementById('neutral');
  neutralInput.value= emotiondata['neutral']

  var surprisedInput= document.getElementById('surprised');
  surprisedInput.value= emotiondata['surprised']

  var fearfulInput= document.getElementById('fearful');
  fearfulInput.value= emotiondata['fearful']
}