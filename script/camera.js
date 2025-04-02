const videoElement = document.getElementById("video");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");
const ppgDataElement = document.getElementById("ppgData");

let mediaRecorder;
let chunks = [];
let frameData = [];

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;
        videoElement.play();

        // Access the video track to control the flashlight
        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            console.log("Flashlight ON");
        } else {
            console.warn("Torch is not supported on this device.");
        }

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            console.log("Video recorded:", url);
            chunks = [];
        };

    } catch (error) {
        console.error("Error accessing camera:", error);
        alert("Error: Camera access denied or not supported!");
    }
}

// Function to extract frames from video
function extractFrames() {
    let frameCount = 0;

    function captureFrame() {
        if (frameCount >= 300) return;  // Limit to 300 frames (~10s at 30 FPS)
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frame = cv.imread(canvas);
        const meanColor = cv.mean(frame);

        frameData.push({ R: meanColor[0], G: meanColor[1], B: meanColor[2] });
        frameCount++;

        setTimeout(captureFrame, 33); // Capture frames at 30 FPS (every 33ms)
    }

    captureFrame();

    setTimeout(() => {
        let csvData = Papa.unparse(frameData);
        console.log(csvData);
        ppgDataElement.textContent = csvData;
        processPPG(frameData);
    }, 10000);
}

// Process PPG Signal
function processPPG(data) {
    let redChannel = data.map(d => d.R);

    function bandPassFilter(signal) {
        const fps = 30;
        const BPM_L = 60;
        const BPM_H = 220;
        const nyquist = fps / 2;
        const low = (BPM_L / 60) / nyquist;
        const high = (BPM_H / 60) / nyquist;

        let filteredSignal = signal.map(val => val * low); // Placeholder filter
        return filteredSignal;
    }

    let filteredSignal = bandPassFilter(redChannel);

    function plotData(time, signal) {
        const ctx = document.getElementById("plotCanvas").getContext("2d");
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: time,
                datasets: [{ label: 'Filtered Signal', data: signal, borderColor: 'red', borderWidth: 2 }]
            },
            options: { responsive: true }
        });
    }

    let time = Array.from({ length: filteredSignal.length }, (_, i) => i / 30);
    plotData(time, filteredSignal);
}

// Start Recording Button
startBtn.addEventListener("click", () => {
    if (!mediaRecorder) {
        alert("Camera not initialized. Please allow camera access.");
        return;
    }

    mediaRecorder.start();
    extractFrames();
    startBtn.classList.add("hidden");
    statusText.innerText = "Recording..";

    setTimeout(() => {
        mediaRecorder.stop();
        startBtn.classList.remove("hidden");
        statusText.innerText = "Processing PPG Data...";
    }, 10000);
});

// Start the camera when the page loads
startCamera();
