const video = document.getElementById("video");

var emotiondata= {'happy': 0, 'neutral': 0, 'sad':0, 'angry':0, 'fearful': 0, 'disgusted':0, 'surprised': 0, 'total': 0};

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/model"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/model"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/model"),
  faceapi.nets.faceExpressionNet.loadFromUri("/model"),
]).then(webCam);

function webCam() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((error) => {
      console.log(error);
    });
}

video.addEventListener("play", () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  faceapi.matchDimensions(canvas, { height: video.height, width: video.width });

  setInterval(async () => {
    const detection = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    // const { expressions } = detection;
    // const maxExpression = Object.keys(expressions).reduce((a, b) => (expressions[a] > expressions[b] ? a : b));

    // detection.expressions = { [maxExpression]: expressions[maxExpression] };


    const resizedWindow = faceapi.resizeResults(detection, {
      height: video.height,
      width: video.width,
    });

    faceapi.draw.drawDetections(canvas, resizedWindow);
    // faceapi.draw.drawFaceLandmarks(canvas, resizedWindow);
    faceapi.draw.drawFaceExpressions(canvas, resizedWindow);
    if(detection[0]){
      const exp= detection[0].expressions;
      const maxExpression = Object.keys(exp).reduce((a, b) => exp[a] > exp[b] ? a : b);
      emotiondata[maxExpression]+=200;
      emotiondata['total']+=200;

      updateInputValues();
      // console.log(JSON.stringify(emotiondata));
    }
  }, 200);
});

const updateInputValues= ()=>{
  var total= document.getElementById('total').value= emotiondata['total'];

  var happyInput= document.getElementById('happy');
  happyInput.value= emotiondata['happy']

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