const videoElement = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ppgChartCtx = document.getElementById("ppgChart").getContext("2d");

let mediaRecorder;
let chunks = [];
let rawPPG = [];
let timestamps = [];
let startTime;

// Create Chart.js PPG graph
const ppgChart = new Chart(ppgChartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Red Channel Intensity',
            data: [],
            borderColor: 'red',
            borderWidth: 2,
            fill: false,
            pointRadius: 1,
            tension: 0.2
        }]
    },
    options: {
        scales: {
            x: { title: { display: true, text: 'Time (ms)' } },
            y: { title: { display: true, text: 'Red Intensity' }, min: 0, max: 255 }
        }
    }
});

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;

        // Enable Flashlight (Torch)
        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            console.log("Flashlight ON");
        } else {
            console.warn("Torch is not supported on this device.");
        }

        // Setup MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            console.log("Video recorded:", URL.createObjectURL(blob));
            processVideoFrames(stream);
            chunks = [];
        };

    } catch (error) {
        console.error("Error accessing camera:", error);
    }
}

function processVideoFrames(stream) {
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);

    rawPPG = [];
    timestamps = [];
    startTime = Date.now();

    function captureFrame() {
        imageCapture.grabFrame().then((imageBitmap) => {
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

            const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let totalRed = 0, pixelCount = frameData.data.length / 4;

            for (let i = 0; i < frameData.data.length; i += 4) {
                totalRed += frameData.data[i];  // Extract Red Channel
            }

            let avgRed = totalRed / pixelCount;
            let elapsedTime = Date.now() - startTime;

            rawPPG.push(avgRed);
            timestamps.push(elapsedTime);

            // Update Chart
            ppgChart.data.labels.push(elapsedTime);
            ppgChart.data.datasets[0].data.push(avgRed);
            ppgChart.update();

        }).catch(error => console.error("Frame capture error:", error));
    }

    let frameCaptureInterval = setInterval(captureFrame, 100);  // Capture every 100ms

    setTimeout(() => {
        clearInterval(frameCaptureInterval);
        console.log("PPG Signal Extraction Complete");
        statusText.innerText = "PPG Signal Extraction Complete";
    }, 15000);
}

// Start Recording
startBtn.addEventListener("click", () => {
    mediaRecorder.start();
    startBtn.classList.add("hidden");
    statusText.innerText = "Recording...";

    setTimeout(() => {
        mediaRecorder.stop();
        startBtn.classList.remove("hidden");
        statusText.innerText = "Processing PPG Data...";
    }, 15000);
});

startCamera();
