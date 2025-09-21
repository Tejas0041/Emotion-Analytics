// WORKING Emotion Detection Script
console.log('🎥 Loading emotion detection...');

const video = document.getElementById("video");
const videoContainer = document.getElementById("videoContainer");
let canvas = null;
let isDetectionRunning = false;
let detectionInterval = null;

// Emotion data - this MUST be updated for the form to work
var emotiondata = {
  'happy': 0, 
  'neutral': 0, 
  'sad': 0, 
  'angry': 0, 
  'fearful': 0, 
  'disgusted': 0, 
  'surprised': 0, 
  'total': 0
};

// Load Face-API models with better error handling
let modelsLoaded = false;

async function loadModels() {
  try {
    console.log('📦 Loading Face-API models...');
    
    // Update status
    const modelsStatus = document.getElementById('models-status');
    if (modelsStatus) modelsStatus.innerHTML = '⏳ Loading...';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/model"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/model"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/model"),
      faceapi.nets.faceExpressionNet.loadFromUri("/model"),
    ]);
    
    modelsLoaded = true;
    console.log('✅ Face-API models loaded successfully');
    
    if (modelsStatus) modelsStatus.innerHTML = '✅ Loaded';
    
    return true;
  } catch (error) {
    console.error('❌ Model loading failed:', error);
    
    const modelsStatus = document.getElementById('models-status');
    if (modelsStatus) modelsStatus.innerHTML = '❌ Failed';
    
    return false;
  }
}

// Initialize models on load
loadModels();

// Setup canvas
function setupCanvas() {
  console.log('🎨 Setting up canvas...');
  
  if (!video || !videoContainer) {
    console.error('❌ Video elements missing');
    return false;
  }

  // Remove old canvas
  if (canvas) canvas.remove();
  const oldCanvas = document.getElementById("overlay");
  if (oldCanvas) oldCanvas.remove();

  // Create new canvas
  canvas = document.createElement("canvas");
  canvas.id = "overlay";
  
  // Wait for video dimensions
  function waitForVideo() {
    if (!video.videoWidth || !video.videoHeight) {
      setTimeout(waitForVideo, 100);
      return;
    }
    
    // Get video display dimensions
    const videoDisplayWidth = video.offsetWidth;
    const videoDisplayHeight = video.offsetHeight;
    
    // Set canvas size to match display dimensions (not video dimensions)
    canvas.width = videoDisplayWidth;
    canvas.height = videoDisplayHeight;
    
    // Position canvas to perfectly overlay the video
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${videoDisplayWidth}px;
      height: ${videoDisplayHeight}px;
      pointer-events: none;
      z-index: 1000;
      border-radius: var(--border-radius-lg);
      border: 2px solid red;
    `;
    
    // Ensure container is positioned relative
    videoContainer.style.position = "relative";
    videoContainer.appendChild(canvas);
    
    console.log('✅ Canvas ready:', canvas.width, 'x', canvas.height);
    console.log('📐 Video actual:', video.videoWidth, 'x', video.videoHeight);
    console.log('📐 Display size:', videoDisplayWidth, 'x', videoDisplayHeight);
    
    // Update debug status
    const canvasStatus = document.getElementById('canvas-status');
    if (canvasStatus) {
      canvasStatus.innerHTML = '✅ Ready';
    }
    
    return true;
  }
  
  waitForVideo();
  return true;
}

// Test canvas
function testCanvas() {
  if (!canvas) {
    console.error('❌ No canvas to test');
    return;
  }
  
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw test border around entire canvas
  ctx.strokeStyle = "#FF0000";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  // Draw center cross
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  
  // Draw test text
  ctx.fillStyle = "#FFFF00";
  ctx.font = "bold 24px Arial";
  ctx.fillText("CANVAS TEST", canvas.width / 2 - 80, canvas.height / 2 - 10);
  ctx.fillText(`${canvas.width}x${canvas.height}`, canvas.width / 2 - 60, canvas.height / 2 + 20);
  
  console.log('✅ Test pattern drawn');
  
  // Clear after 3 seconds
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 3000);
}

// MAIN DETECTION FUNCTION
async function detectEmotions() {
  if (!canvas || !isDetectionRunning) return;
  
  try {
    // Use better detection options for improved accuracy
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceExpressions();

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update detection status
    const detectionStatus = document.getElementById('detection-status');
    if (detectionStatus) {
      detectionStatus.innerHTML = detections.length > 0 ? '✅ Face detected' : '🔍 Searching...';
    }

    if (detections.length > 0) {
      console.log(`👤 Found ${detections.length} face(s)`);
      
      // Scale detections to match canvas display size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      
      detections.forEach(detection => {
        const box = detection.detection.box;
        const expressions = detection.expressions;
        
        // Scale the detection box
        const scaledBox = {
          x: box.x * scaleX,
          y: box.y * scaleY,
          width: box.width * scaleX,
          height: box.height * scaleY
        };
        
        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxConfidence = 0;
        
        for (const [emotion, confidence] of Object.entries(expressions)) {
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            dominantEmotion = emotion;
          }
        }
        
        // UPDATE EMOTION DATA - Lower threshold for better detection
        if (maxConfidence > 0.2) {
          emotiondata[dominantEmotion] += 100; // Increase by 100ms each detection
          emotiondata.total += 100;
          
          console.log(`😊 ${dominantEmotion}: ${(maxConfidence * 100).toFixed(1)}% (Total: ${emotiondata.total})`);
          
          // Update form fields in real-time
          updateFormFields();
          
          // Update debug display
          updateDebugDisplay();
        }
        
        // Draw detection box with better visibility
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
        
        // Draw corner markers
        const cornerSize = 20;
        ctx.strokeStyle = "#FF0000";
        ctx.lineWidth = 3;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(scaledBox.x, scaledBox.y + cornerSize);
        ctx.lineTo(scaledBox.x, scaledBox.y);
        ctx.lineTo(scaledBox.x + cornerSize, scaledBox.y);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(scaledBox.x + scaledBox.width - cornerSize, scaledBox.y);
        ctx.lineTo(scaledBox.x + scaledBox.width, scaledBox.y);
        ctx.lineTo(scaledBox.x + scaledBox.width, scaledBox.y + cornerSize);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(scaledBox.x, scaledBox.y + scaledBox.height - cornerSize);
        ctx.lineTo(scaledBox.x, scaledBox.y + scaledBox.height);
        ctx.lineTo(scaledBox.x + cornerSize, scaledBox.y + scaledBox.height);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(scaledBox.x + scaledBox.width - cornerSize, scaledBox.y + scaledBox.height);
        ctx.lineTo(scaledBox.x + scaledBox.width, scaledBox.y + scaledBox.height);
        ctx.lineTo(scaledBox.x + scaledBox.width, scaledBox.y + scaledBox.height - cornerSize);
        ctx.stroke();
        
        // Draw emotion label
        const label = `${dominantEmotion.toUpperCase()} ${(maxConfidence * 100).toFixed(0)}%`;
        ctx.font = "bold 16px Arial";
        
        const textWidth = ctx.measureText(label).width;
        const labelY = scaledBox.y > 30 ? scaledBox.y - 10 : scaledBox.y + scaledBox.height + 25;
        
        // Background for text
        ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
        ctx.fillRect(scaledBox.x, labelY - 20, textWidth + 10, 25);
        
        // Text
        ctx.fillStyle = "#000000";
        ctx.fillText(label, scaledBox.x + 5, labelY - 5);
      });
    } else {
      // No face detected - show message
      ctx.fillStyle = "rgba(255, 165, 0, 0.8)";
      ctx.fillRect(10, 10, 250, 40);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 16px Arial";
      ctx.fillText("Looking for faces...", 20, 35);
    }
  } catch (error) {
    console.error('❌ Detection error:', error);
    const detectionStatus = document.getElementById('detection-status');
    if (detectionStatus) {
      detectionStatus.innerHTML = '❌ Error';
    }
  }
}

// Helper function to update form fields
function updateFormFields() {
  Object.keys(emotiondata).forEach(emotion => {
    const input = document.getElementById(emotion);
    if (input) {
      input.value = emotiondata[emotion];
    }
  });
}

// Helper function to update debug display
function updateDebugDisplay() {
  const debugElements = {
    'debug-happy': emotiondata.happy,
    'debug-neutral': emotiondata.neutral,
    'debug-sad': emotiondata.sad,
    'debug-angry': emotiondata.angry,
    'debug-fearful': emotiondata.fearful,
    'debug-disgusted': emotiondata.disgusted,
    'debug-surprised': emotiondata.surprised,
    'debug-total': emotiondata.total
  };
  
  Object.entries(debugElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// Start detection
function startDetection() {
  if (isDetectionRunning) {
    console.log('⚠️ Already running');
    return;
  }
  
  if (!modelsLoaded) {
    console.log('⚠️ Models not loaded yet, waiting...');
    setTimeout(startDetection, 1000);
    return;
  }
  
  if (!canvas) {
    console.log('⚠️ Canvas not ready, setting up...');
    setupCanvas();
    setTimeout(startDetection, 1000);
    return;
  }
  
  console.log('🚀 Starting detection...');
  isDetectionRunning = true;
  
  // Clear previous data
  Object.keys(emotiondata).forEach(key => {
    emotiondata[key] = 0;
  });
  
  // Update status
  const detectionStatus = document.getElementById('detection-status');
  if (detectionStatus) detectionStatus.innerHTML = '🚀 Starting...';
  
  // Start detection loop with better timing
  detectionInterval = setInterval(detectEmotions, 200); // Slower for better performance
  
  console.log('✅ Detection started');
}

// Stop detection
function stopDetection() {
  console.log('🛑 Stopping detection...');
  isDetectionRunning = false;
  
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  
  // Final update of form fields
  Object.keys(emotiondata).forEach(emotion => {
    const input = document.getElementById(emotion);
    if (input) {
      input.value = emotiondata[emotion];
    }
  });
  
  console.log('📊 Final emotion data:', emotiondata);
  console.log('📊 Total time:', emotiondata.total, 'ms');
}

// Make functions global
window.startDetection = startDetection;
window.stopDetection = stopDetection;
window.setupCanvas = setupCanvas;
window.testCanvas = testCanvas;

// Auto-initialize with better status tracking
if (video) {
  video.addEventListener("loadedmetadata", () => {
    console.log('📹 Video metadata loaded');
    
    const videoStatus = document.getElementById('video-status');
    if (videoStatus) videoStatus.innerHTML = '✅ Loaded';
    
    setTimeout(setupCanvas, 500);
  });
  
  video.addEventListener("playing", () => {
    console.log('▶️ Video playing');
    
    const videoStatus = document.getElementById('video-status');
    if (videoStatus) videoStatus.innerHTML = '▶️ Playing';
    
    setTimeout(() => {
      setupCanvas();
      setTimeout(startDetection, 2000);
    }, 1000);
  });
  
  video.addEventListener("error", (e) => {
    console.error('❌ Video error:', e);
    
    const videoStatus = document.getElementById('video-status');
    if (videoStatus) videoStatus.innerHTML = '❌ Error';
  });
} else {
  console.error('❌ Video element not found');
  
  const videoStatus = document.getElementById('video-status');
  if (videoStatus) videoStatus.innerHTML = '❌ Not found';
}